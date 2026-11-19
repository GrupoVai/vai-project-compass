import { describe, expect, it } from 'vitest';
import { createRequestLimiter } from '../lib/request-limiter';

const request = (path: string, ip = '192.0.2.1') => new Request(`https://example.test${path}`, {
  headers: { 'cf-connecting-ip': ip },
});

describe('Application request budgets', () => {
  it.each([['/', 120], ['/api/arquivo', 60], ['/api/admin-usuarios', 10]] as const)(
    'allows exactly the budget for %s and then returns 429', (path, budget) => {
      const check = createRequestLimiter();
      for (let i = 0; i < budget; i++) expect(check(request(path), 0)).toBeNull();
      const result = check(request(path), 0);
      expect(result?.status).toBe(429);
      expect(result?.headers.get('retry-after')).toBe('60');
    },
  );
  it('reopens the budget after one minute without blocked requests extending it', () => {
    const check = createRequestLimiter();
    for (let i = 0; i < 10; i++) check(request('/api/admin-usuarios'), 0);
    expect(check(request('/api/admin-usuarios'), 59_000)?.headers.get('retry-after')).toBe('1');
    expect(check(request('/api/admin-usuarios'), 60_000)).toBeNull();
  });
  it('isolates IP addresses and administrative budgets', () => {
    const check = createRequestLimiter();
    for (let i = 0; i < 10; i++) check(request('/api/admin-usuarios'), 0);
    expect(check(request('/api/admin-usuarios'), 0)?.status).toBe(429);
    expect(check(request('/api/admin-usuarios', '192.0.2.2'), 0)).toBeNull();
    expect(check(request('/api/arquivo'), 0)).toBeNull();
  });
  it('does not allow spoofed forwarded headers to bypass the missing-IP budget', () => {
    const check = createRequestLimiter();
    for (let i = 0; i < 11; i++) {
      const result = check(new Request('https://example.test/api/admin-usuarios', {
        headers: { 'x-forwarded-for': `192.0.2.${i}` },
      }), 0);
      expect(result?.status ?? 200).toBe(i < 10 ? 200 : 429);
    }
  });
  it('bounds memory and releases expired entries', () => {
    const check = createRequestLimiter();
    for (let i = 0; i < 5000; i++) expect(check(request('/', `client-${i}`), 0)).toBeNull();
    expect(check(request('/', 'new-client'), 0)?.status).toBe(429);
    expect(check(request('/', 'new-client'), 60_000)).toBeNull();
  });
  it('does not count static asset requests', () => {
    const check = createRequestLimiter();
    for (let i = 0; i < 150; i++) expect(check(request('/assets/app.js'), 0)).toBeNull();
    expect(check(request('/'), 0)).toBeNull();
  });
});