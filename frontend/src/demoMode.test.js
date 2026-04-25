import { mockSentinelResult, parseAuthStatus, resolveScrapeMode } from './demoMode';

describe('auth status parser', () => {
  test('handles auth_ok', () => {
    const parsed = parseAuthStatus({
      configured: true,
      authenticated: true,
      status: 'auth_ok',
      message: 'Copernicus OAuth authentication successful.',
      tokenExpiresAt: '2026-04-26T00:00:00Z',
    });

    expect(parsed.configured).toBe(true);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.status).toBe('auth_ok');
    expect(parsed.tokenExpiresAt).toBe('2026-04-26T00:00:00Z');
  });

  test('handles auth_failed', () => {
    const parsed = parseAuthStatus({
      configured: true,
      authenticated: false,
      status: 'auth_failed',
      message: 'Copernicus auth failed: invalid_client.',
    });

    expect(parsed.configured).toBe(true);
    expect(parsed.authenticated).toBe(false);
    expect(parsed.status).toBe('auth_failed');
    expect(parsed.message).toContain('invalid_client');
  });
});

describe('demo mode scrape fallback', () => {
  test('demo mode returns mock sentinel result payload', () => {
    expect(mockSentinelResult.river).toBe('Vardar');
    expect(mockSentinelResult.station).toBe('Vardar: Veles to Skopje');
    expect(mockSentinelResult.source).toContain('Mock Sentinel-2 demo result');
  });

  test('scrape flow does not block when auth failed and demo mode is enabled', () => {
    const mode = resolveScrapeMode(
      { configured: true, authenticated: false, status: 'auth_failed' },
      true
    );
    expect(mode).toBe('demo');
  });
});
