const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function get<T>(pathWithQuery: string): Promise<T> {
  const res = await fetch(`${API_URL}${pathWithQuery}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const API_BASE = API_URL;
