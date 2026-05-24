import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseAdminClient } from '$lib/supabase.server';
import {
  deleteProductImage,
  getFirstProductImagePath,
  uploadProductImage
} from '$lib/server/product-images';

const MODEL = 'gemini-2.5-flash-image';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

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

function formatSafetyCategory(category: string | undefined): string {
  if (!category) return '';
  return category
    .replace(/^HARM_CATEGORY_/, '')
    .toLowerCase()
    .replace(/_/g, ' ');
}

function explainMissingImage(args: {
  finishReason: string | undefined;
  textPart: string | undefined;
  blocked: string[] | undefined;
}): string {
  const { finishReason, textPart, blocked } = args;
  const blockedSuffix = blocked && blocked.length > 0 ? ` (${blocked.join(', ')})` : '';

  switch (finishReason) {
    case 'IMAGE_SAFETY':
    case 'SAFETY':
      return `Gemini blocked the image for safety reasons${blockedSuffix}. Try a different photo or remove sensitive context.`;
    case 'IMAGE_PROHIBITED_CONTENT':
    case 'PROHIBITED_CONTENT':
      return 'Gemini refused to generate this image because the request was flagged as prohibited content.';
    case 'IMAGE_RECITATION':
    case 'RECITATION':
      return 'Gemini refused to generate the image because the output was too close to copyrighted material.';
    case 'IMAGE_OTHER':
    case 'OTHER':
      return textPart
        ? `Gemini did not return an image. It said: ${textPart.slice(0, 300)}`
        : 'Gemini did not return an image (reason: OTHER). Try regenerating or use a different source photo.';
    case 'MAX_TOKENS':
      return 'Gemini hit the output token limit before producing an image. Try a shorter context or simpler prompt.';
    case 'BLOCKLIST':
      return 'Gemini blocked the request because the prompt contained terms on its blocklist.';
    case 'SPII':
      return 'Gemini blocked the request because it detected sensitive personal information in the prompt or image.';
    default:
      if (textPart) {
        return `Gemini did not return an image. It said: ${textPart.slice(0, 300)}`;
      }
      if (finishReason) {
        return `Gemini did not return an image (finishReason: ${finishReason}). Try again or use a different source photo.`;
      }
      return 'Gemini did not return an image. Try regenerating or use a different source photo.';
  }
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, manufacturer')
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(1000);

  if (error) {
    console.error('[image-generator] failed to load products', error);
    return { products: [] };
  }

  return { products: data ?? [] };
};

export const actions: Actions = {
  generate: async ({ request }) => {
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
      return fail(400, { message: 'Image must be JPEG, PNG, WebP, or AVIF.' });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const originalDataUrl = `data:${file.type};base64,${base64}`;

    const prompt = context
      ? `${BASE_PROMPT}\n\nExtra context from the operator: ${context}`
      : BASE_PROMPT;

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
              parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data: base64 } }]
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
      let detail = text.slice(0, 400);
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; status?: string } };
        if (parsed.error?.message) {
          detail = parsed.error.message;
        }
      } catch {
        // not JSON, keep raw text
      }
      console.error('[image-generator] Gemini HTTP error', response.status, text);
      return fail(response.status, {
        message: `Gemini returned ${response.status}: ${detail}`,
        context
      });
    }

    type InlineData = { mimeType?: string; mime_type?: string; data: string };
    type Part = { text?: string; inlineData?: InlineData; inline_data?: InlineData };
    const body = (await response.json()) as {
      candidates?: {
        content?: { parts?: Part[] };
        finishReason?: string;
        safetyRatings?: { category?: string; probability?: string; blocked?: boolean }[];
      }[];
      promptFeedback?: {
        blockReason?: string;
        blockReasonMessage?: string;
        safetyRatings?: { category?: string; probability?: string; blocked?: boolean }[];
      };
    };

    const getInline = (p: Part): InlineData | undefined => p.inlineData ?? p.inline_data;
    const getMime = (d: InlineData): string => d.mimeType ?? d.mime_type ?? 'image/png';

    if (body.promptFeedback?.blockReason) {
      const blocked = body.promptFeedback.safetyRatings
        ?.filter((r) => r.blocked)
        .map((r) => formatSafetyCategory(r.category))
        .filter(Boolean);
      const detail =
        body.promptFeedback.blockReasonMessage ??
        (blocked && blocked.length > 0 ? `flagged categories: ${blocked.join(', ')}` : null);
      return fail(400, {
        message: `Gemini blocked the request (${body.promptFeedback.blockReason})${detail ? ` — ${detail}` : ''}. Try a different photo or adjust the context.`,
        context
      });
    }

    const candidate = body.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const imageData = parts.map(getInline).find((d): d is InlineData => !!d?.data);

    if (!imageData) {
      const finishReason = candidate?.finishReason;
      const textPart = parts.find((p) => p.text)?.text?.trim();
      const blocked = candidate?.safetyRatings
        ?.filter((r) => r.blocked)
        .map((r) => formatSafetyCategory(r.category))
        .filter(Boolean);

      console.error('[image-generator] No image in Gemini response', {
        finishReason,
        textPart,
        safetyRatings: candidate?.safetyRatings,
        candidateCount: body.candidates?.length ?? 0,
        partKeys: parts.map((p) => Object.keys(p))
      });

      const message = explainMissingImage({ finishReason, textPart, blocked });
      return fail(502, { message, context });
    }

    const result: GenerateResult = {
      imageDataUrl: `data:${getMime(imageData)};base64,${imageData.data}`,
      originalDataUrl,
      context: context || null
    };
    return result;
  },

  attach: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const productId = form.get('productId');
    const imageDataUrl = form.get('imageDataUrl');

    if (typeof productId !== 'string' || !productId) {
      return fail(400, { attach: { ok: false, message: 'Pick a product to save to.' } });
    }
    if (typeof imageDataUrl !== 'string') {
      return fail(400, { attach: { ok: false, message: 'No generated image to save.' } });
    }

    const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) {
      return fail(400, { attach: { ok: false, message: 'Generated image format is unsupported.' } });
    }
    const mime = match[1]!;
    const base64 = match[2]!;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      return fail(400, { attach: { ok: false, message: 'Generated image is empty.' } });
    }
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const file = new File([buffer], `generated-${Date.now()}.${ext}`, { type: mime });

    const productRes = await supabase
      .from('products')
      .select('id, name, sku, image_paths')
      .eq('id', productId)
      .maybeSingle();
    if (productRes.error || !productRes.data) {
      return fail(404, { attach: { ok: false, message: 'Product not found.' } });
    }
    const previousImagePath = getFirstProductImagePath(productRes.data.image_paths);

    const storage = createSupabaseAdminClient();
    const upload = await uploadProductImage(storage, productId, file);
    if (upload.error || !upload.path) {
      return fail(500, {
        attach: { ok: false, message: upload.error ?? 'Failed to upload image.' }
      });
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({ image_paths: [upload.path] })
      .eq('id', productId);
    if (updateError) {
      await deleteProductImage(storage, upload.path);
      return fail(500, { attach: { ok: false, message: updateError.message } });
    }

    if (previousImagePath && previousImagePath !== upload.path) {
      await deleteProductImage(storage, previousImagePath);
    }

    return {
      attach: {
        ok: true,
        productId: productRes.data.id,
        productName: productRes.data.name,
        productSku: productRes.data.sku
      }
    };
  }
};
