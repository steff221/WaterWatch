const HIGH_RISK_TYPES = ['chemical_smell', 'oil_spill', 'dead_fish', 'sewage', 'foam'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateEvidenceScore(report) {
  const data = report || {};
  let score = 0.25;

  if ((data.photoCount || 0) > 0) score += 0.15;
  if (data.hasVoiceNote) score += 0.08;
  if (data.hasLocation) score += 0.1;
  if (String(data.reporterType || '').toLowerCase() === 'hiker') score += 0.05;
  if ((data.confirmations || 0) >= 3) score += 0.1;
  if ((data.confirmations || 0) >= 5) score += 0.15;
  if (data.satelliteCovered) score += 0.1;
  if (data.sensorCovered) score += 0.1;
  if (HIGH_RISK_TYPES.includes(String(data.reportType || '').toLowerCase())) score += 0.1;
  if (String(data.severity || '').toUpperCase() === 'HIGH') score += 0.05;
  if (String(data.severity || '').toUpperCase() === 'CRITICAL') score += 0.1;

  return clamp(Number(score.toFixed(2)), 0, 0.95);
}

export function getEvidenceLabel(score) {
  if (score <= 0.39) return 'Weak signal';
  if (score <= 0.59) return 'Needs confirmation';
  if (score <= 0.79) return 'Strong community signal';
  return 'Municipality review recommended';
}

export function shouldEscalateToMunicipality(report) {
  const data = report || {};
  const evidenceScore = calculateEvidenceScore(data);
  const severity = String(data.severity || '').toUpperCase();
  const reportType = String(data.reportType || '').toLowerCase();
  const confirmations = data.confirmations || 0;

  if (evidenceScore >= 0.8) return true;
  if (severity === 'CRITICAL') return true;
  if (['chemical_smell', 'oil_spill', 'dead_fish', 'sewage'].includes(reportType) && confirmations >= 3) {
    return true;
  }
  return false;
}

const strongHikerReport = {
  photoCount: 3,
  hasVoiceNote: true,
  hasLocation: true,
  confirmations: 5,
  reporterType: 'hiker',
  satelliteCovered: false,
  sensorCovered: false,
  severity: 'HIGH',
  reportType: 'chemical_smell',
};
const weakReport = {
  photoCount: 0,
  hasVoiceNote: false,
  hasLocation: false,
  confirmations: 0,
  reporterType: 'citizen',
  satelliteCovered: false,
  sensorCovered: false,
  severity: 'LOW',
  reportType: 'trash_buildup',
};

console.assert(calculateEvidenceScore(strongHikerReport) >= 0.8, 'strong hiker report reaches at least 0.80');
console.assert(shouldEscalateToMunicipality(strongHikerReport), 'small river report without satellite coverage can still escalate');
console.assert(!shouldEscalateToMunicipality(weakReport), 'weak report does not escalate');
console.assert(calculateEvidenceScore({ ...strongHikerReport, confirmations: 99, satelliteCovered: true, sensorCovered: true }) <= 0.95, 'score never exceeds 0.95');
