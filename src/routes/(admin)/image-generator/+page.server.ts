import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions } from './$types';

const MODEL = 'gemini-2.5-flash-image-preview';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const BASE_PROMPT = [
  'Regenerate this image as a premium, photorealistic ecommerce product photo.',
  'Clean seamless white studio background, soft diffused lighting, subtle contact shadow beneath the product.',
  'Keep the product identity, shape, color, labeling, and proportions faithful to the input — do not invent new branding or text.',
  'Sharp focus, centered composition, no props, no hands, no watermarks, no text overlays.',
  'Output a single square image suitable for a product detail page.'
].join(' ');

interface GenerateResult {
  imageDataUrl: string;
  originalDataUrl: string;
  context: string | null;
}

export const actions: Actions = {
  default: async ({ request }) => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return fail(500, {
        message: 'GEMINI_API_KEY is not configured on the server.'
      });
    }

    const form = await request.formData();
    const file = form.get('image');
    const contextRaw = form.get('context');
    const context = typeof contextRaw === 'string' ? contextRaw.trim() : '';

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { message: 'Upload an image to start from.' });
    }
    if (file.size > MAX_BYTES) {
      return fail(400, { message: 'Image must be 10 MB or smaller.' });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return fail(400, { message: 'Image must be JPEG, PNG, or WebP.' });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const originalDataUrl = `data:${file.type};base64,${base64}`;

    const prompt = context ? `${BASE_PROMPT}\n\nExtra context from the operator: ${context}` : BASE_PROMPT;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inline_data: { mime_type: file.type, data: base64 } }
              ]
            }
          ],
          generationConfig: { responseModalities: ['IMAGE'] }
        })
      });
    } catch (err) {
      return fail(502, {
        message: `Could not reach Gemini: ${(err as Error).message}`,
        context
      });
    }

    if (!response.ok) {
      const text = await response.text();
      return fail(response.status, {
        message: `Gemini returned ${response.status}: ${text.slice(0, 400)}`,
        context
      });
    }

    const body = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: { text?: string; inline_data?: { mime_type: string; data: string } }[];
        };
      }[];
      promptFeedback?: { blockReason?: string };
    };

    if (body.promptFeedback?.blockReason) {
      return fail(400, {
        message: `Gemini blocked the request: ${body.promptFeedback.blockReason}`,
        context
      });
    }

    const parts = body.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inline_data?.data);
    if (!imagePart?.inline_data) {
      const textPart = parts.find((p) => p.text)?.text;
      return fail(502, {
        message: textPart
          ? `Gemini did not return an image. It said: ${textPart.slice(0, 300)}`
          : 'Gemini did not return an image.',
        context
      });
    }

    const result: GenerateResult = {
      imageDataUrl: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`,
      originalDataUrl,
      context: context || null
    };
    return result;
  }
};
