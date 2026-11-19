// Best-effort, per-Worker-instance limits. Not a distributed DDoS firewall.
// Cloudflare supplies CF-Connecting-IP; never use client-controlled X-Forwarded-For.
const WINDOW_MS = 60_000;
const MAX_CLIENTS = 5_000;
type Entry = { count: number; expiresAt: number };

export function createRequestLimiter() {
  const entries = new Map<string, Entry>();
  let nextCleanup = 0;

  return (request: Request, now = Date.now()): Response | null => {
    const path = new URL(request.url).pathname;
    // Keep static files outside the application request budget.
    if (path.startsWith('/assets/') || path === '/favicon.ico' || path === '/robots.txt') return null;
    const group = path === '/api/admin-usuarios' ? 'admin' : path.startsWith('/api/') ? 'api' : 'page';
    const limit = group === 'admin' ? 10 : group === 'api' ? 60 : 120;
    const ip = request.headers.get('cf-connecting-ip');
    // Without the hosting-provided IP, use a shared budget, never a spoofable fallback.
    const key = `${group}:${ip && ip.length <= 64 ? ip : 'unknown'}`;

    if (now >= nextCleanup) {
      for (const [k, entry] of entries) if (entry.expiresAt <= now) entries.delete(k);
      nextCleanup = now + WINDOW_MS;
    }

    const blocked = (seconds: number) => new Response(
      JSON.stringify({ erro: 'Muitos pedidos em pouco tempo. Aguarde e tente novamente.' }),
      { status: 429, headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': String(seconds),
        'x-content-type-options': 'nosniff',
      } },
    );

    let entry = entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      // Fail closed rather than evicting active budgets or allocating unbounded memory.
      if (!entry && entries.size >= MAX_CLIENTS) return blocked(60);
      entry = { count: 0, expiresAt: now + WINDOW_MS };
      entries.set(key, entry);
    }
    if (entry.count >= limit) return blocked(Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)));
    entry.count += 1;
    return null;
  };
}

export const limitRequest = createRequestLimiter();