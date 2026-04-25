function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRainfallMultiplier(rainfallMm) {
  if (rainfallMm < 2) return 0.9;
  if (rainfallMm <= 10) return 1.0;
  if (rainfallMm <= 20) return 1.15;
  return 1.3;
}

function getSatelliteScore(satelliteRisk) {
  const key = String(satelliteRisk || '').toUpperCase();
  if (key === 'HIGH') return 85;
  if (key === 'MEDIUM') return 55;
  return 25;
}

function getSensorScore(sensorStatus) {
  const key = String(sensorStatus || '').toUpperCase();
  if (key === 'CONFIRMED') return 95;
  if (key === 'ABNORMAL') return 80;
  if (key === 'WATCHLIST') return 45;
  return 20;
}

function getRiskLevel(score) {
  if (score <= 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  if (score <= 80) return 'HIGH';
  return 'CRITICAL';
}

function getCitizenAction(level) {
  if (level === 'CRITICAL') return 'Do not use or contact river water. Follow municipality instructions';
  if (level === 'HIGH') return 'Avoid river contact and warn nearby users';
  if (level === 'MEDIUM') return 'Avoid direct river contact and monitor alerts';
  return 'Stay informed';
}

function getMunicipalityAction(level) {
  if (level === 'CRITICAL') return 'Issue public warning, coordinate inspection, and prepare emergency response';
  if (level === 'HIGH') return 'Dispatch inspection team and prepare public advisory';
  if (level === 'MEDIUM') return 'Prepare inspection team and monitor reports';
  return 'Continue monitoring';
}

function toEtaLabel(etaMinutes) {
  const safeMinutes = Math.max(1, Math.round(etaMinutes));
  if (safeMinutes < 60) return `${safeMinutes} minutes`;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function predictFuturePollution(eventData) {
  const {
    river,
    station,
    downstreamTargets = [],
    waterVelocityKmh = 0,
    rainfallMm = 0,
    satelliteRisk = 'LOW',
    sensorStatus = 'NORMAL',
    sigmaDeviation = 0,
    baselineConfidence = 0.7,
  } = eventData || {};

  const rainfallMultiplier = getRainfallMultiplier(rainfallMm);
  const satelliteScore = getSatelliteScore(satelliteRisk);
  let sensorScore = getSensorScore(sensorStatus);

  // Early-warning logic: keep sensitivity when satellite is high but sensors are still normal.
  if (String(satelliteRisk).toUpperCase() === 'HIGH' && String(sensorStatus).toUpperCase() === 'NORMAL') {
    sensorScore = Math.max(sensorScore, 35);
  }

  const sigmaDeviationScore = clamp((sigmaDeviation / 4) * 100, 0, 100);
  const rainfallScore = clamp((rainfallMm / 20) * 100, 0, 100);

  const baseRisk =
    satelliteScore * 0.45 +
    sensorScore * 0.15 +
    sigmaDeviationScore * 0.25 +
    rainfallScore * 0.15;

  const forecast = downstreamTargets.map((target) => {
    const distanceKm = Number(target.distanceKm || 0);
    const velocity = Math.max(0.1, Number(waterVelocityKmh || 0));
    const etaMinutes = (distanceKm / velocity) * 60;
    const riskDecay = Math.max(0.55, 1 - distanceKm * 0.025);
    const futureRiskScore = clamp(baseRisk * riskDecay * rainfallMultiplier, 0, 100);
    const futureRiskLevel = getRiskLevel(futureRiskScore);

    return {
      targetId: target.id,
      targetName: target.name,
      municipality: target.municipality,
      distanceKm,
      etaMinutes: Math.round(etaMinutes),
      etaLabel: toEtaLabel(etaMinutes),
      futureRiskScore: Number(futureRiskScore.toFixed(1)),
      futureRiskLevel,
      populationEstimate: Number(target.populationEstimate || 0),
      recommendedCitizenAction: getCitizenAction(futureRiskLevel),
      recommendedMunicipalityAction: getMunicipalityAction(futureRiskLevel),
    };
  });

  const highestRiskTarget = forecast.reduce((best, item) => {
    if (!best) return item;
    return item.futureRiskScore > best.futureRiskScore ? item : best;
  }, null);

  const totalPeoplePotentiallyAffected = forecast.reduce((sum, item) => sum + item.populationEstimate, 0);

  let modelConfidence = Number(baselineConfidence || 0);
  if (satelliteRisk) modelConfidence += 0.03;
  if (sigmaDeviation > 3) modelConfidence += 0.04;
  if (typeof rainfallMm === 'number') modelConfidence += 0.02;
  if (typeof waterVelocityKmh === 'number' && waterVelocityKmh > 0) modelConfidence += 0.02;
  if (downstreamTargets.length > 0) modelConfidence += 0.02;
  modelConfidence = clamp(modelConfidence, 0, 0.95);

  const topTarget = highestRiskTarget || forecast[0];
  const publicMessage = topTarget
    ? `Pollution risk may reach ${topTarget.targetName} in ${topTarget.etaMinutes} minutes. Avoid river contact and follow updates.`
    : 'No downstream targets currently available for forecast.';

  return {
    model: 'WaterWatch Future Pollution Forecast Model',
    claim: 'Risk prediction, not final proof',
    river,
    station,
    generatedAt: new Date().toISOString(),
    currentEvent: {
      satelliteRisk,
      sensorStatus,
      sigmaDeviation,
      rainfallMm,
      waterVelocityKmh,
      baselineConfidence,
    },
    forecast,
    highestRiskTarget,
    totalPeoplePotentiallyAffected,
    modelConfidence: Number(modelConfidence.toFixed(2)),
    publicMessage,
    municipalityMessage:
      'WaterWatch predicts downstream risk for multiple areas. Prioritize inspection upstream and prepare public communication.',
  };
}

const demoEvent = {
  river: 'Vardar',
  station: 'Vardar: Veles to Skopje',
  eventLocation: {
    lat: 41.97,
    lng: 21.55,
  },
  downstreamTargets: [
    {
      id: 'skopje-west',
      name: 'Skopje West',
      municipality: 'Karpos',
      distanceKm: 6.5,
      populationEstimate: 58000,
    },
    {
      id: 'skopje-center',
      name: 'Skopje Center',
      municipality: 'Centar',
      distanceKm: 11.2,
      populationEstimate: 45000,
    },
    {
      id: 'skopje-east',
      name: 'Skopje East',
      municipality: 'Aerodrom / Gazi Baba',
      distanceKm: 17.8,
      populationEstimate: 93000,
    },
  ],
  waterVelocityKmh: 4.2,
  rainfallMm: 12,
  satelliteRisk: 'HIGH',
  sensorStatus: 'NORMAL',
  sigmaDeviation: 3.7,
  baselineConfidence: 0.82,
};

const demoForecast = predictFuturePollution(demoEvent);
console.assert(demoForecast.forecast.length === 3, 'forecast has 3 targets');
console.assert(demoForecast.modelConfidence <= 0.95, 'model confidence is <= 0.95');
console.assert(Boolean(demoForecast.highestRiskTarget), 'highestRiskTarget exists');
console.assert(
  demoForecast.forecast[0].etaMinutes === Math.round((6.5 / 4.2) * 60),
  'etaMinutes is calculated correctly'
);
console.assert(
  demoForecast.forecast.every((item) => item.futureRiskScore <= 100),
  'no futureRiskScore is above 100'
);
