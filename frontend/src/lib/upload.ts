import { API_BASE_URL } from './constants';

/**
 * Upload an image file and return its public URL.
 * `kind` selects the endpoint: 'image' (logo/product, requires inv:manage
 * or settings:manage) or 'avatar' (any authenticated user).
 */
export async function uploadImage(file: File, kind: 'image' | 'avatar' = 'image'): Promise<string> {
  const form = new FormData();
  form.append('image', file);

  const res = await fetch(`${API_BASE_URL}/uploads/${kind}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || json?.message || 'Image upload failed');
  }
  return json.data.url as string;
}
