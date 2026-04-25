import React, { useEffect, useMemo, useState } from 'react';
import { europeanRivers } from '../data/europeanRiversData';
import { fetchRiverSatelliteSignal, fetchSupportedCollections, parseSatelliteResult } from '../services/copernicusSentinelService';
import { predictFuturePollution } from '../utils/pollutionForecastModel';

const FILTERS = [
  'All',
  'Copernicus-ready',
  'Cross-border',
  'Urban pressure',
  'Industrial pressure',
  'Agricultural runoff',
  'Citizen reports needed',
  'Small river gaps',
  'Municipality-ready',
];

function badgeForSource(sourceType) {
  if (sourceType === 'citizen_verified') return 'CITIZEN VERIFIED';
  if (sourceType === 'municipality') return 'MUNICIPALITY VERIFIED';
  if (sourceType === 'sensor') return 'SENSOR VERIFIED';
  if (sourceType === 'copernicus_signal') return 'LIVE COPERNICUS';
  return 'DEMO DATA';
}

function statusBadgeClass(text) {
  const key = String(text || '').toUpperCase();
  if (key.includes('SAFE')) return 'safe';
  if (key.includes('WATCH')) return 'watch';
  if (key.includes('RISK')) return 'risky';
  if (key.includes('HIGH')) return 'high';
  if (key.includes('CRITICAL')) return 'critical';
  if (key.includes('DEMO')) return 'demo';
  if (key.includes('LIVE COPERNICUS')) return 'live';
  if (key.includes('MUNICIPALITY VERIFIED')) return 'municipality';
  if (key.includes('CITIZEN VERIFIED')) return 'citizen';
  if (key.includes('SENSOR VERIFIED')) return 'sensor';
  return '';
}

const EuropeanRivers = () => {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(europeanRivers[0]);
  const [satSignal, setSatSignal] = useState(null);
  const [loadingSignal, setLoadingSignal] = useState(false);
  const [mockCaseOpened, setMockCaseOpened] = useState(false);
  const [mockReport, setMockReport] = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [signalError, setSignalError] = useState('');
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    const loadCollections = async () => {
      const data = await fetchSupportedCollections();
      setCollections(data);
    };
    loadCollections();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'All') return europeanRivers;
    if (filter === 'Copernicus-ready') return europeanRivers.filter((r) => r.copernicusCollections.length > 0);
    if (filter === 'Cross-border') return europeanRivers.filter((r) => r.countries.length > 1);
    if (filter === 'Urban pressure') return europeanRivers.filter((r) => r.knownRiskCategories.some((c) => c.includes('urban')));
    if (filter === 'Industrial pressure') return europeanRivers.filter((r) => r.knownRiskCategories.some((c) => c.includes('industrial')));
    if (filter === 'Agricultural runoff') return europeanRivers.filter((r) => r.knownRiskCategories.some((c) => c.includes('agricultural')));
    if (filter === 'Citizen reports needed') return europeanRivers.filter((r) => r.citizenReportPriority === 'High' || r.citizenReportPriority === 'Very High');
    if (filter === 'Small river gaps') return europeanRivers.filter((r) => r.name === 'Sateska' || r.name === 'Vardar');
    if (filter === 'Municipality-ready') return europeanRivers.filter((r) => r.municipalityWorkflowReadiness === 'Ready' || r.municipalityWorkflowReadiness === 'Active');
    return europeanRivers;
  }, [filter]);

  const onFetchSignal = async (mode) => {
    setLoadingSignal(true);
    setSignalError('');
    setSatSignal(null);
    const raw = await fetchRiverSatelliteSignal(selected, mode);
    const parsed = parseSatelliteResult(raw);
    if (!raw) {
      setSignalError('Could not load Copernicus satellite signal. Try again or use demo flow.');
    }
    setSatSignal({ ...raw, ...parsed, requestMode: mode });
    setLoadingSignal(false);
  };

  const onRunForecast = () => {
    const result = predictFuturePollution({
      river: selected.name,
      station: `${selected.name} main monitoring segment`,
      eventLocation: { lat: selected.coordinatesDemo[0], lng: selected.coordinatesDemo[1] },
      downstreamTargets: [
        { id: `${selected.id}-t1`, name: `${selected.name} downstream zone A`, municipality: selected.majorCities[0] || 'Local municipality', distanceKm: 8, populationEstimate: 60000 },
        { id: `${selected.id}-t2`, name: `${selected.name} downstream zone B`, municipality: selected.majorCities[1] || 'Regional municipality', distanceKm: 15, populationEstimate: 90000 },
      ],
      waterVelocityKmh: 4.1,
      rainfallMm: 10,
      satelliteRisk: 'HIGH',
      sensorStatus: 'NORMAL',
      sigmaDeviation: 3.2,
      baselineConfidence: 0.82,
    });
    setForecastResult(result);
  };

  return (
    <div className="module-wrap">
      <div className="module-title">European Rivers Monitoring Layer</div>
      <div className="module-sub">Copernicus-ready river intelligence for public water safety.</div>
      <div className="module-badges">
        <span className="module-badge live">Space4Water-inspired, Copernicus-powered, locally verified.</span>
      </div>
      <div className="module-card">
        <div className="module-line">These rivers are included as a Copernicus-ready monitoring demo layer. Satellite-derived risk indicators are not final proof of pollution and require local confirmation.</div>
        <div className="module-line">WaterWatch uses Copernicus satellite data as a risk signal. Pollution confirmation requires citizen evidence, sensors, laboratory checks, or municipality verification.</div>
      </div>
      <div className="module-card">
        <div className="module-card-title">Space4Water connection</div>
        <div className="module-line">Space4Water promotes the use of space technologies for water-related challenges. WaterWatch applies that idea in a practical citizen and municipality platform by combining Copernicus satellite signals with local evidence and response workflows.</div>
      </div>
      <div className="module-grid three-cols">
        <div className="module-card">
          <div className="module-card-title">Filters</div>
          {FILTERS.map((f) => (
            <button key={f} className={`module-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
          <div className="module-line">Showing: {filtered.length} rivers</div>
        </div>
        <div className="module-card">
          <div className="module-card-title">Rivers</div>
          {filtered.map((river) => (
            <div key={river.id} className={`river-list-item ${selected.id === river.id ? 'active' : ''}`} onClick={() => setSelected(river)}>
              <strong>{river.name}</strong> · {river.status}
            </div>
          ))}
        </div>
        <div className="module-card">
          <div className="module-card-title">{selected.name}</div>
          <div className="module-badges">
            <span className={`module-badge ${statusBadgeClass(selected.status)}`}>{selected.status}</span>
            <span className={`module-badge ${statusBadgeClass(badgeForSource(selected.sourceType))}`}>{badgeForSource(selected.sourceType)}</span>
            {selected.demoOnly && <span className="module-badge demo">DEMO DATA</span>}
          </div>
          <div className="module-line">Countries: {selected.countries.join(', ')}</div>
          <div className="module-line">Basin/Sea: {selected.basin}</div>
          <div className="module-line">Approximate length: {selected.approximateLengthKm ?? 'unknown'} km</div>
          <div className="module-line">Major cities: {selected.majorCities.join(', ')}</div>
          <div className="module-line">Monitoring type: {selected.monitoringType}</div>
          <div className="module-line">Available satellite sources: {selected.copernicusCollections.join(', ')}</div>
          <div className="module-line">Supported/available Copernicus data layers: {collections.map((c) => c.id).join(', ') || 'Loading...'}</div>
          <div className="module-line">Citizen-report priority: {selected.citizenReportPriority}</div>
          <div className="module-line">Municipality workflow readiness: {selected.municipalityWorkflowReadiness}</div>
          <div className="module-line">Known risk categories: {selected.knownRiskCategories.join(', ')}</div>
          <div className="module-line">Current status: {selected.currentRiskLabel}</div>
          <div className="module-line">{selected.uiDisclaimer}</div>
          {selected.demoOnly && (
            <div className="module-warning">This river is included as a demo monitoring target. Risk labels are not official pollution measurements.</div>
          )}
          <div className="module-actions">
            <button className="module-btn" onClick={() => onFetchSignal('sentinel2')}>View satellite signal</button>
            <button className="module-btn" onClick={() => onFetchSignal('sentinel1')}>Fetch Sentinel-1 radar signal</button>
            <button className="module-btn" onClick={() => setMockCaseOpened(true)}>Open municipality case</button>
            <button className="module-btn" onClick={() => setMockReport(true)}>Add citizen report</button>
            <button className="module-btn" onClick={onRunForecast}>Run future forecast</button>
          </div>
        </div>
      </div>

      {loadingSignal && <div className="module-card"><div className="module-line">Loading Copernicus satellite signal...</div></div>}
      {signalError && <div className="module-warning">{signalError}</div>}
      {satSignal && (
        <div className="module-card">
          <div className="module-card-title">Satellite Signal Result</div>
          <div className="module-badges"><span className={`module-badge ${statusBadgeClass(badgeForSource(satSignal.sourceType))}`}>{badgeForSource(satSignal.sourceType)}</span></div>
          <div className="module-line">Source: {satSignal.source}</div>
          <div className="module-line">Collection: {satSignal.collection}</div>
          <div className="module-line">Signal type: {satSignal.signalType}</div>
          <div className="module-line">Request: {satSignal.requestMode === 'sentinel1' ? 'Sentinel-1 GRD radar support' : 'Sentinel-2 L2A optical signal'}</div>
          <div className="module-line">Indicator: {satSignal.satelliteRiskIndicator}</div>
          <div className="module-line">Message: {satSignal.message}</div>
          <div className="module-line">Timestamp: {satSignal.timestamp}</div>
          <div className="module-line">{satSignal.disclaimer}</div>
          <div className="module-line">Requires local confirmation</div>
        </div>
      )}

      {mockCaseOpened && <div className="module-card"><div className="module-line">Municipality case opened (frontend mock).</div></div>}
      {mockReport && <div className="module-card"><div className="module-line">Citizen report form opened (mock fallback).</div></div>}
      {forecastResult && (
        <div className="module-card">
          <div className="module-card-title">Forecast Output</div>
          <div className="module-line">Know before it reaches you.</div>
          <div className="module-line">Model confidence: up to 95% in demo mode.</div>
          <div className="module-line">{forecastResult.claim}</div>
          {forecastResult.forecast.map((item) => (
            <div key={item.targetId} className="module-line">
              {item.targetName}: ETA {item.etaMinutes} min · {item.futureRiskLevel} ({item.futureRiskScore})
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EuropeanRivers;
