const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function get<T>(pathWithQuery: string): Promise<T> {
  const res = await fetch(`${API_URL}${pathWithQuery}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Reseeds the (fictional) agent roster via the reset-agents endpoint. That endpoint returns
// an HTML confirmation page, so we don't parse the body — just check the status. The key is a
// soft guard on a reseedable, demo-only table, and the console is access-gated anyway.
export async function reseedAgents(): Promise<void> {
  const res = await fetch(`${API_URL}/reset-agents?key=bobs-reset-2025`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export const API_BASE = API_URL;
