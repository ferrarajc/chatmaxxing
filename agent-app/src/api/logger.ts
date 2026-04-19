const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type Level = 'INFO' | 'WARN' | 'ERROR';

function serializeError(e: unknown): unknown {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  try {
    return JSON.parse(JSON.stringify(e, Object.getOwnPropertyNames(e as object)));
  } catch {
    return String(e);
  }
}

export async function clientLog(
  level: Level,
  context: string,
  data: unknown,
): Promise<void> {
  const payload = {
    level,
    context,
    data: data instanceof Error || (data !== null && typeof data === 'object' && !(data instanceof Array))
      ? serializeError(data)
      : data,
    ts: new Date().toISOString(),
  };
  try {
    await fetch(`${API_URL}/client-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget — never let logging break the app
  }
}

export const log = {
  info: (ctx: string, data: unknown) => clientLog('INFO', ctx, data),
  warn: (ctx: string, data: unknown) => clientLog('WARN', ctx, data),
  error: (ctx: string, data: unknown) => clientLog('ERROR', ctx, data),
};
