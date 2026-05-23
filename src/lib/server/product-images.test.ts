import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRODUCT_IMAGES_BUCKET,
  PRODUCT_IMAGE_MAX_BYTES,
  deleteProductImage,
  getFirstProductImagePath,
  getProductImageFile,
  getProductImagePublicUrl,
  uploadProductImage,
  validateProductImage
} from './product-images';

function makeFile({
  name = 'pic.png',
  type = 'image/png',
  size = 1024
}: { name?: string; type?: string; size?: number } = {}): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('getProductImageFile', () => {
  it('returns null for non-File entries', () => {
    expect(getProductImageFile(null)).toBeNull();
    expect(getProductImageFile('string-value')).toBeNull();
  });

  it('returns null for empty File', () => {
    const empty = new File([], 'empty.png', { type: 'image/png' });
    expect(getProductImageFile(empty)).toBeNull();
  });

  it('returns the File when non-empty', () => {
    const file = makeFile();
    expect(getProductImageFile(file)).toBe(file);
  });
});

describe('validateProductImage', () => {
  it('accepts allowed MIME types', () => {
    expect(validateProductImage(makeFile({ type: 'image/png' }))).toBeNull();
    expect(validateProductImage(makeFile({ type: 'image/jpeg' }))).toBeNull();
    expect(validateProductImage(makeFile({ type: 'image/webp' }))).toBeNull();
  });

  it('rejects unsupported MIME types', () => {
    expect(validateProductImage(makeFile({ type: 'image/gif' }))).toMatch(/JPEG/);
  });

  it('rejects files over the size limit', () => {
    const oversized = makeFile({ size: PRODUCT_IMAGE_MAX_BYTES + 1 });
    expect(validateProductImage(oversized)).toMatch(/10 MB/);
  });
});

describe('getFirstProductImagePath', () => {
  it('returns null when input is not an array', () => {
    expect(getFirstProductImagePath(null)).toBeNull();
    expect(getFirstProductImagePath('foo')).toBeNull();
    expect(getFirstProductImagePath({})).toBeNull();
  });

  it('returns the first non-empty trimmed string', () => {
    expect(getFirstProductImagePath(['  first  ', 'second'])).toBe('first');
    expect(getFirstProductImagePath(['', '  next  '])).toBe('next');
  });

  it('returns null when array has no usable string', () => {
    expect(getFirstProductImagePath([null, undefined, '', 5])).toBeNull();
  });
});

describe('getProductImagePublicUrl', () => {
  function mockSupabase(publicUrl: string): {
    supabase: SupabaseClient;
    fromMock: ReturnType<typeof vi.fn>;
  } {
    const fromMock = vi.fn().mockReturnValue({
      getPublicUrl: vi.fn(() => ({ data: { publicUrl } }))
    });
    return {
      supabase: { storage: { from: fromMock } } as unknown as SupabaseClient,
      fromMock
    };
  }

  it('returns null when path is missing', () => {
    const { supabase } = mockSupabase('http://example.com/x');
    expect(getProductImagePublicUrl(supabase, null)).toBeNull();
    expect(getProductImagePublicUrl(supabase, undefined)).toBeNull();
    expect(getProductImagePublicUrl(supabase, '')).toBeNull();
  });

  it('queries the products bucket and returns publicUrl', () => {
    const { supabase, fromMock } = mockSupabase('http://example.com/products/x.png');
    expect(getProductImagePublicUrl(supabase, 'products/x.png')).toBe(
      'http://example.com/products/x.png'
    );
    expect(fromMock).toHaveBeenCalledWith(PRODUCT_IMAGES_BUCKET);
  });
});

describe('uploadProductImage', () => {
  function mockSupabase(uploadResult: { error: { message: string } | null }): {
    supabase: SupabaseClient;
    fromMock: ReturnType<typeof vi.fn>;
  } {
    const fromMock = vi.fn().mockReturnValue({
      upload: vi.fn(async () => uploadResult)
    });
    return {
      supabase: { storage: { from: fromMock } } as unknown as SupabaseClient,
      fromMock
    };
  }

  it('rejects invalid files before calling storage', async () => {
    const { supabase, fromMock } = mockSupabase({ error: null });
    const result = await uploadProductImage(supabase, 'prod-1', makeFile({ type: 'image/gif' }));
    expect(result.path).toBeNull();
    expect(result.error).toMatch(/JPEG/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('uploads with a generated path and returns it', async () => {
    const { supabase } = mockSupabase({ error: null });
    const result = await uploadProductImage(supabase, 'prod-1', makeFile({ type: 'image/png' }));
    expect(result.path).toMatch(/^products\/prod-1\/preview-\d+\.png$/);
    expect(result.error).toBeNull();
  });

  it('propagates storage errors', async () => {
    const { supabase } = mockSupabase({ error: { message: 'bucket missing' } });
    const result = await uploadProductImage(supabase, 'prod-1', makeFile());
    expect(result.path).toBeNull();
    expect(result.error).toBe('bucket missing');
  });
});

describe('deleteProductImage', () => {
  it('does nothing for empty path', async () => {
    const remove = vi.fn();
    const supabase = {
      storage: { from: vi.fn().mockReturnValue({ remove }) }
    } as unknown as SupabaseClient;
    await deleteProductImage(supabase, null);
    expect(remove).not.toHaveBeenCalled();
  });

  it('calls remove with the path', async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const supabase = {
      storage: { from: vi.fn().mockReturnValue({ remove }) }
    } as unknown as SupabaseClient;
    await deleteProductImage(supabase, 'products/x.png');
    expect(remove).toHaveBeenCalledWith(['products/x.png']);
  });

  it('warns but does not throw on remove error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const remove = vi.fn(async () => ({ error: { message: 'denied' } }));
    const supabase = {
      storage: { from: vi.fn().mockReturnValue({ remove }) }
    } as unknown as SupabaseClient;
    await expect(deleteProductImage(supabase, 'products/x.png')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
