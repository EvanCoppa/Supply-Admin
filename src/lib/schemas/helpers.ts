import { z, type ZodTypeAny } from 'zod';

export type ParseSuccess<T> = { success: true; data: T };
export type ParseFailure = {
  success: false;
  message: string;
  fieldErrors: Record<string, string[]>;
};
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

function formDataToObject(form: FormData): Record<string, string | string[] | undefined> {
  const obj: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key).map((v) => (typeof v === 'string' ? v : ''));
    obj[key] = values.length > 1 ? values : values[0];
  }
  return obj;
}

export function parseForm<T extends ZodTypeAny>(
  schema: T,
  form: FormData
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(formDataToObject(form));
  if (result.success) return { success: true, data: result.data };
  const flat = result.error.flatten();
  const fieldErrors = flat.fieldErrors as Record<string, string[]>;
  const firstFieldMessage = Object.values(fieldErrors).flat()[0];
  const message = firstFieldMessage ?? flat.formErrors[0] ?? 'Invalid input.';
  return { success: false, message, fieldErrors };
}

export const optionalTrimmed = z
  .union([z.string(), z.undefined()])
  .transform((v) => {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  });

export const requiredTrimmed = (message = 'Required.') =>
  z
    .string({ required_error: message, invalid_type_error: message })
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message });

export const optionalNumber = z
  .union([z.string(), z.number(), z.undefined()])
  .transform((v, ctx) => {
    if (v === undefined || v === '' || v === null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a number.' });
      return z.NEVER;
    }
    return n;
  });

export const requiredNumber = (message = 'Must be a number.') =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    if (v === '' || v === undefined || v === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return n;
  });

export const checkbox = z
  .union([z.string(), z.undefined()])
  .transform((v) => v === 'on' || v === 'true' || v === '1');

export const stringArray = z
  .union([z.string(), z.array(z.string()), z.undefined()])
  .transform((v) => {
    if (!v) return [] as string[];
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((s) => s.trim()).filter((s) => s.length > 0);
  });

export const enumWithDefault = <T extends readonly [string, ...string[]]>(
  values: T,
  defaultValue: T[number],
  message = 'Invalid value.'
) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? defaultValue : v),
    z.enum(values, { errorMap: () => ({ message }) })
  );
