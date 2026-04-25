export const mockSentinelResult = {
  source: 'Mock Sentinel-2 demo result',
  river: 'Vardar',
  station: 'Vardar: Veles to Skopje',
  satelliteRisk: 'HIGH',
  sensorStatus: 'NORMAL',
  combinedRisk: 'MEDIUM-HIGH',
  confidence: 0.82,
  deviation: '3.7 sigma above baseline',
  etaMinutes: 18,
  recommendedAction: 'Warn nearby users and inspect upstream segment',
  explanation:
    'Satellite-style anomaly detected upstream while downstream sensor remains normal. This is a risk signal, not final proof.',
};

export function parseAuthStatus(rawStatus) {
  const normalized = rawStatus || {};
  const status = normalized.status || 'auth_checking';
  const configured = Boolean(normalized.configured);
  const authenticated = Boolean(normalized.authenticated);
  const tokenExpiresAt = normalized.tokenExpiresAt || null;
  const message = normalized.message || 'Checking Copernicus OAuth status...';

  return { configured, authenticated, status, message, tokenExpiresAt };
}

export function shouldAutoEnableDemoMode(auth) {
  return auth?.status === 'auth_failed';
}

export function resolveScrapeMode(auth, demoMode) {
  if (auth?.authenticated) return 'live';
  if (demoMode) return 'demo';
  return 'blocked';
}
