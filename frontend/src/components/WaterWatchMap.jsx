import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Pane,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import WaterWatchApi from '../api/waterwatchApi';
import { mockSentinelResult, parseAuthStatus, resolveScrapeMode, shouldAutoEnableDemoMode } from '../demoMode';
import { predictFuturePollution } from '../utils/pollutionForecastModel';
import IntelligenceLayer from './IntelligenceLayer';
import CitizenReports from './CitizenReports';
import OpenCases from './OpenCases';
import HistoricalData from './HistoricalData';
import SmallRiverBlindSpots from './SmallRiverBlindSpots';
import RiverGuardian from './RiverGuardian';
import MunicipalityReview from './MunicipalityReview';
import EuropeanRivers from '../pages/EuropeanRivers';

const BASEMAPS = {
  sat: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  mono: {
    label: 'Monochrome',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};

const RISK_COLORS = {
  5: '#E24B4A',
  4: '#EF9F27',
  3: '#a8c340',
  2: '#3db87a',
  1: '#3a80c0',
};

const RISK_LABELS = {
  5: 'Critical 5/5',
  4: 'Very high 4/5',
  3: 'High 3/5',
  2: 'Moderate 2/5',
  1: 'Low 1/5',
};

const STATION_PRESETS = {
  vardar_vs: { rk: 5, par: 'Hg, PCBs', wfd: 'Poor', sg: 3.7, src: 'Factory upstream' },
  treska_km: { rk: 4, par: 'BOD5, NH4', wfd: 'Poor', sg: 2.9, src: 'Urban runoff' },
  ohrid_s: { rk: 3, par: 'PO4, E.coli', wfd: 'Moderate', sg: 1.8, src: 'Urban' },
  danube_vienna: { rk: 4, par: 'Nitrates, Metals', wfd: 'Moderate', sg: 2.4, src: 'Urban + industry' },
  danube_budapest: { rk: 4, par: 'BOD5, NH4', wfd: 'Moderate', sg: 2.2, src: 'Urban discharge' },
  rhine_cologne: { rk: 3, par: 'NO3, PO4', wfd: 'Moderate', sg: 1.9, src: 'Industrial corridor' },
  seine_paris: { rk: 3, par: 'BOD5, E.coli', wfd: 'Moderate', sg: 1.8, src: 'Urban load' },
  thames_london: { rk: 3, par: 'NH4, PO4', wfd: 'Moderate', sg: 1.7, src: 'Combined sewer overflow' },
  elbe_hamburg: { rk: 3, par: 'Suspended solids', wfd: 'Moderate', sg: 1.7, src: 'Port activity' },
  po_venice: { rk: 3, par: 'Pesticides', wfd: 'Moderate', sg: 1.8, src: 'Agricultural runoff' },
  ebro_zaragoza: { rk: 2, par: 'Nitrates', wfd: 'Moderate', sg: 1.3, src: 'Irrigation drainage' },
  loire_nantes: { rk: 2, par: 'PO4', wfd: 'Moderate', sg: 1.2, src: 'Urban runoff' },
  tagus_lisbon: { rk: 2, par: 'BOD5', wfd: 'Moderate', sg: 1.1, src: 'Estuary pressure' },
};

const RIVERS = [
  { pts: [[42.15, 21.43], [42.05, 21.52], [42.0, 21.6], [41.85, 21.75], [41.72, 21.77], [41.58, 21.95], [41.47, 22.02], [41.41, 22.05], [41.14, 22.18]], rk: 5 },
  { pts: [[41.98, 21.21], [41.93, 21.25], [41.87, 21.3]], rk: 3 },
  { pts: [[48.3, 16.35], [47.95, 17.6], [47.7, 18.7], [47.5, 19.06]], rk: 4 },
  { pts: [[50.95, 6.95], [51.2, 6.9], [51.7, 5.8], [51.92, 4.48]], rk: 3 },
  { pts: [[48.86, 2.35], [49.2, 1.9], [49.45, 1.1], [49.48, 0.17]], rk: 3 },
  { pts: [[51.5, -0.12], [51.48, 0.3], [51.46, 0.75]], rk: 3 },
  { pts: [[53.55, 10.0], [53.7, 9.75], [53.86, 8.7]], rk: 3 },
  { pts: [[45.1, 11.5], [45.05, 12.05], [45.0, 12.35]], rk: 3 },
  { pts: [[41.65, -0.88], [41.45, -0.4], [40.72, 0.7]], rk: 2 },
  { pts: [[47.22, -1.55], [47.18, -1.2], [47.12, -2.2]], rk: 2 },
  { pts: [[38.72, -9.14], [38.72, -9.0], [38.68, -8.8]], rk: 2 },
];

const LAKES = [
  [[41.08, 20.72], [40.95, 20.72], [40.88, 20.82], [40.95, 20.92], [41.08, 20.87]],
  [[40.85, 20.85], [40.78, 20.88], [40.75, 20.98], [40.82, 21.05], [40.88, 20.95]],
  [[41.21, 22.65], [41.16, 22.65], [41.14, 22.75], [41.2, 22.78], [41.24, 22.72]],
  [[41.63, 20.67], [41.58, 20.66], [41.56, 20.76], [41.62, 20.75]],
];

const CITIES = [
  { n: 'Vienna', la: 48.21, lo: 16.37 },
  { n: 'Budapest', la: 47.5, lo: 19.04 },
  { n: 'Cologne', la: 50.94, lo: 6.96 },
  { n: 'Paris', la: 48.86, lo: 2.35 },
  { n: 'London', la: 51.5, lo: -0.12 },
  { n: 'Hamburg', la: 53.55, lo: 10.0 },
  { n: 'Venice', la: 45.44, lo: 12.33 },
  { n: 'Zaragoza', la: 41.65, lo: -0.88 },
  { n: 'Nantes', la: 47.22, lo: -1.55 },
  { n: 'Lisbon', la: 38.72, lo: -9.14 },
];

const FUTURE_RISK_DEMO_EVENT = {
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

const MUNICIPALITY_STEPS = [
  'Detected',
  'Verified',
  'Inspection Dispatched',
  'Public Alert Sent',
  'Resolved',
];

const NAV_ITEMS = [
  { id: 'map', label: 'Dashboard' },
  { id: 'map', label: 'Satellite Map' },
  { id: 'future', label: 'Future Risk' },
  { id: 'citizen', label: 'Citizen Reports' },
  { id: 'cases', label: 'Open Cases' },
  { id: 'historical', label: 'Historical Data' },
  { id: 'blindspots', label: 'Small River Blind Spots' },
  { id: 'guardian', label: 'River Guardian' },
  { id: 'review', label: 'Municipality Review' },
  { id: 'european', label: 'European Rivers' },
  { id: 'api', label: 'API/Auth' },
];

const NAV_GROUPS = [
  { title: 'Monitoring', items: [{ id: 'map', label: 'Dashboard' }, { id: 'map', label: 'Satellite Map' }, { id: 'future', label: 'Future Risk' }, { id: 'european', label: 'European Rivers' }] },
  { title: 'Community', items: [{ id: 'citizen', label: 'Citizen Reports' }, { id: 'blindspots', label: 'Small River Blind Spots' }, { id: 'guardian', label: 'River Guardian' }] },
  { title: 'Municipality', items: [{ id: 'cases', label: 'Open Cases' }, { id: 'review', label: 'Municipality Review' }, { id: 'historical', label: 'Historical Data' }] },
  { title: 'System', items: [{ id: 'api', label: 'API/Auth' }, { id: 'demo', label: 'Demo Mode' }] },
];

const DEMO_FLOW_STEPS = [
  'Satellite Signal',
  'Citizen Evidence',
  'Forecast',
  'Municipal Case',
  'Public Alert',
];

function CursorTracker({ onCoordinateChange }) {
  useMapEvents({
    mousemove(e) {
      onCoordinateChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const WaterWatchMap = () => {
  const api = useRef(new WaterWatchApi()).current;
  const mapRef = useRef(null);

  const [basemap, setBasemap] = useState('sat');
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scrapeSummary, setScrapeSummary] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [coordinates, setCoordinates] = useState('47.500°N  10.000°E');
  const [authStatus, setAuthStatus] = useState({
    configured: false,
    authenticated: false,
    status: 'auth_checking',
    message: 'Checking Copernicus OAuth status...',
    tokenExpiresAt: null,
  });
  const [demoMode, setDemoMode] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [workflowStepIndex, setWorkflowStepIndex] = useState(0);
  const [demoFlowStarted, setDemoFlowStarted] = useState(false);
  const [demoFlowStep, setDemoFlowStep] = useState(0);

  const filteredStations = useMemo(() => {
    const q = stationFilter.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) => s.n.toLowerCase().includes(q) || s.r.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [stations, stationFilter]);

  const futureForecast = useMemo(
    () => predictFuturePollution(FUTURE_RISK_DEMO_EVENT),
    []
  );

  const timelineMarkers = useMemo(() => {
    const points = [30, 60, 120, 180];
    const sorted = [...futureForecast.forecast].sort((a, b) => a.etaMinutes - b.etaMinutes);
    return points.map((minute) => {
      const nearest = sorted.find((target) => minute <= target.etaMinutes) || sorted[sorted.length - 1];
      return {
        minute,
        level: nearest?.futureRiskLevel || 'LOW',
        score: nearest?.futureRiskScore || 0,
      };
    });
  }, [futureForecast]);

  const affectedMunicipalities = useMemo(
    () => futureForecast.forecast.map((item) => item.municipality).join(', '),
    [futureForecast]
  );

  const responseLevelByStep = ['Monitor', 'Prepare', 'Dispatch', 'Emergency', 'Monitor'];
  const responseLevel = responseLevelByStep[workflowStepIndex] || 'Monitor';

  const municipalityReport = useMemo(
    () => ({
      incidentId: 'WW-VARDAR-2026-001',
      river: 'Vardar',
      status: MUNICIPALITY_STEPS[workflowStepIndex],
      highestRiskArea: 'Skopje Center',
      estimatedPeopleAffected: 196000,
      confidence: 0.95,
      publicAlertSent: workflowStepIndex >= 3,
      recommendedAction: 'Inspect upstream segment and warn citizens',
      generatedBy: 'WaterWatch Municipality Action Center',
    }),
    [workflowStepIndex]
  );

  useEffect(() => {
    const initializeStations = async () => {
      try {
        const response = await api.listStations();
        const serverStations = response?.stations || [];

        if (serverStations.length > 0) {
          const merged = serverStations.map((station) => {
            const preset = STATION_PRESETS[station.id] || {};
            const bbox = station.bbox || [0, 0, 0, 0];
            const lat = (bbox[1] + bbox[3]) / 2;
            const lon = (bbox[0] + bbox[2]) / 2;
            return {
              id: station.id,
              n: station.name,
              r: station.river,
              la: lat,
              lo: lon,
              rk: preset.rk ?? 3,
              par: preset.par ?? 'Satellite proxy metrics',
              wfd: preset.wfd ?? 'Unknown',
              sg: preset.sg ?? 1.4,
              src: preset.src ?? 'Catalog and process API',
            };
          });
          setStations(merged);
          setSelectedStation(merged[0]);
          return;
        }
      } catch (error) {
        console.error('Failed to load backend stations:', error);
      }

      // Fallback if backend stations fail.
      const fallback = Object.entries(STATION_PRESETS).map(([id, preset]) => ({
        id,
        n: id,
        r: 'Unknown',
        la: 47,
        lo: 10,
        rk: preset.rk,
        par: preset.par,
        wfd: preset.wfd,
        sg: preset.sg,
        src: preset.src,
      }));
      setStations(fallback);
      setSelectedStation(fallback[0] || null);
    };

    initializeStations();
  }, [api]);

  useEffect(() => {
    const loadAuthStatus = async () => {
      try {
        const status = await api.getAuthStatus();
        const parsed = parseAuthStatus(status);
        setAuthStatus(parsed);
        if (shouldAutoEnableDemoMode(parsed)) {
          setDemoMode(true);
        }
      } catch (error) {
        const fallbackStatus = parseAuthStatus({
          configured: false,
          authenticated: false,
          status: 'auth_failed',
          message: 'Backend auth status endpoint unreachable.',
        });
        setAuthStatus(fallbackStatus);
        setDemoMode(true);
      }
    };

    loadAuthStatus();
  }, [api]);

  useEffect(() => {
    const fetchAlert = async () => {
      if (!selectedStation) return;
      setLoading(true);
      try {
        const data = await api.getStationAlert(selectedStation.id, { days_back: 3 });
        setCurrentAlert(data);
      } catch (error) {
        console.error('Failed to fetch alert:', error);
        setCurrentAlert(null);
      }
      setLoading(false);
    };

    fetchAlert();
  }, [api, selectedStation]);

  const handleSelectStation = (station) => {
    setSelectedStation(station);
    if (mapRef.current) {
      mapRef.current.flyTo([station.la, station.lo], Math.max(mapRef.current.getZoom(), 7), {
        duration: 0.9,
      });
    }
  };

  const handleScrape = async () => {
    if (!selectedStation) return;
    setLoading(true);
    setDemoResult(null);
    setScrapeSummary('Scraping Sentinel-2 catalog...');
    try {
      const scrapeMode = resolveScrapeMode(authStatus, demoMode);
      if (scrapeMode === 'demo') {
        setDemoResult(mockSentinelResult);
        setScrapeSummary('Demo Mode active: using mock Sentinel-2 result for hackathon flow.');
        return;
      }
      if (scrapeMode === 'blocked') {
        setScrapeSummary('Live Copernicus auth is unavailable. Demo Mode is active.');
        return;
      }

      const data = await api.getCatalogSentinel2(selectedStation.id, 7, 80);
      const latest = data.products?.[0];
      if (!latest) {
        setScrapeSummary('No Sentinel-2 products found in the selected time window.');
      } else {
        setScrapeSummary(
          `Found ${data.product_count} products. Latest: ${latest.datetime || 'n/a'} | Cloud: ${latest.cloud_cover ?? 'n/a'}%`
        );
      }
    } catch (error) {
      const msg = String(error.message || 'Unknown error');
      if (msg.toLowerCase().includes('invalid client') || msg.toLowerCase().includes('credentials')) {
        setScrapeSummary(
          'Live Copernicus auth is unavailable. Demo Mode is active.'
        );
      } else {
        setScrapeSummary('Sentinel-2 signal is temporarily unavailable. Continue with Demo Mode.');
      }
      try {
        const status = await api.getAuthStatus();
        const parsed = parseAuthStatus(status);
        setAuthStatus(parsed);
        if (shouldAutoEnableDemoMode(parsed)) {
          setDemoMode(true);
        }
      } catch (statusError) {
        // Keep current status when refresh fails.
      }
    }
    finally {
      setLoading(false);
    }
  };

  const handleEnableDemoMode = () => {
    setDemoMode(true);
    setDemoResult(mockSentinelResult);
    setScrapeSummary('Demo Mode forced. Loaded Vardar hackathon scenario.');
  };

  const startDemoFlow = () => {
    setDemoFlowStarted(true);
    setDemoFlowStep(1);
    setDemoMode(true);
  };

  const nextDemoFlowStep = () => {
    setDemoFlowStep((prev) => {
      const next = Math.min(DEMO_FLOW_STEPS.length, prev + 1);
      if (next >= 2) setDemoResult(mockSentinelResult);
      if (next >= 3) setWorkflowStepIndex(2);
      if (next >= 4) setWorkflowStepIndex(3);
      return next;
    });
  };

  const moveWorkflowTo = (targetStep) => {
    setWorkflowStepIndex((prev) => Math.max(prev, targetStep));
  };

  const authBadgeClass = authStatus.authenticated
    ? 'ok'
    : authStatus.status === 'auth_checking'
      ? 'checking'
      : demoMode
        ? 'demo'
        : 'bad';
  const authBadgeLabel = authStatus.authenticated
    ? 'AUTH OK'
    : authStatus.status === 'auth_checking'
      ? 'AUTH CHECKING'
      : demoMode
        ? 'DEMO MODE'
        : authStatus.status === 'not_configured'
          ? 'NOT CONFIGURED'
          : 'AUTH FAILED';

  const friendlyAuthWarning =
    !authStatus.authenticated && demoMode
      ? 'Live Copernicus auth is unavailable. Demo Mode is active.'
      : '';

  const riverOpacity = basemap === 'mono' ? 0.95 : 0.8;

  return (
    <div className="ww-root">
      <div className="bar">
        <div className="logo">WATER<b>WATCH</b></div>
        <div className="sub">Copernicus Sentinel Basin Intelligence · Europe Monitoring Grid</div>
        <div
          className={`auth-badge ${authBadgeClass}`}
          title={authStatus.message}
        >
          {authBadgeLabel}
        </div>
        <button className={`demo-btn ${demoMode ? 'on' : ''}`} onClick={handleEnableDemoMode} title="Enable hackathon-safe mock mode">
          Demo Mode
        </button>
        <div className="view-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`lb ${activeView === item.id ? 'on' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="lbtns">
          <button className={`lb ${basemap === 'sat' ? 'on' : ''}`} onClick={() => setBasemap('sat')}>
            Satellite
          </button>
          <button className={`lb ${basemap === 'mono' ? 'on' : ''}`} onClick={() => setBasemap('mono')}>
            Monochrome
          </button>
        </div>
      </div>

      {activeView === 'map' && (
        <div className="hero-wrap">
          <div className="hero-main">
            <div className="hero-title">WaterWatch Intelligence Layer</div>
            <div className="hero-subtitle">
              Satellite signals, citizen evidence, future pollution prediction, and municipal response in one public water safety system.
            </div>
            <div className="hero-metrics">
              <div className="hero-metric"><span>Active risk signals</span><strong>12</strong></div>
              <div className="hero-metric"><span>People potentially protected</span><strong>196,000</strong></div>
              <div className="hero-metric"><span>Municipality cases open</span><strong>5</strong></div>
            </div>
            <div className="hero-note">
              WaterWatch does not claim pollution is proven. It detects risk earlier, helps verify it, and helps municipalities respond.
            </div>
          </div>
          <div className="hero-demo">
            <button className="abtn start-demo-btn" onClick={startDemoFlow}>Start Demo</button>
            <div className="demo-progress">
              {DEMO_FLOW_STEPS.map((step, idx) => (
                <span key={step} className={`demo-step ${demoFlowStep > idx ? 'done' : demoFlowStep === idx + 1 ? 'active' : ''}`}>
                  {step}
                </span>
              ))}
            </div>
            {demoFlowStarted && (
              <div className="demo-step-text">
                {demoFlowStep === 1 && 'Step 1: Satellite detects upstream risk on Vardar.'}
                {demoFlowStep === 2 && 'Step 2: Citizen/hiker report confirms visible signs.'}
                {demoFlowStep === 3 && 'Step 3: Future prediction estimates arrival to Skopje Center.'}
                {demoFlowStep === 4 && 'Step 4: Municipality opens case and dispatches inspection.'}
                {demoFlowStep >= 5 && 'Step 5: Public alert is sent.'}
              </div>
            )}
            {demoFlowStarted && demoFlowStep < DEMO_FLOW_STEPS.length && (
              <button className="module-btn" onClick={nextDemoFlowStep}>Next step</button>
            )}
          </div>
        </div>
      )}

      {currentAlert && (
        <div className="abar">
          <div className="dot" />
          <strong>LIVE</strong>
          <span>
            {currentAlert.alert_type === 'critical'
              ? `Upstream anomaly at ${selectedStation?.n || currentAlert.station_id} · sigma ${currentAlert.satellite_signal.sigma.toFixed(1)} · confidence ${(currentAlert.confidence * 100).toFixed(0)}%`
              : `Station ${currentAlert.station_id} · ${currentAlert.alert_type.toUpperCase()} · confidence ${(currentAlert.confidence * 100).toFixed(0)}%`}
          </span>
        </div>
      )}

      {(demoMode || demoResult?.demo) && (
        <div className="demo-mode-banner">
          <div className="demo-banner-content">
            <span className="demo-banner-icon">⚠️</span>
            <span className="demo-banner-text">
              <strong>DEMO MODE ACTIVE</strong> — Using simulated satellite data. 
              {!authStatus.authenticated && ' Real Copernicus credentials not configured.'}
            </span>
          </div>
        </div>
      )}

      <div className="body">
        <div className="mapwrap">
          {activeView === 'map' ? (
            <>
              <MapContainer
                center={[47.5, 10.0]}
                zoom={5}
                minZoom={4}
                maxZoom={13}
                zoomControl={true}
                whenCreated={(map) => {
                  mapRef.current = map;
                }}
                className="leaflet-canvas"
              >
                <TileLayer attribution={BASEMAPS[basemap].attribution} url={BASEMAPS[basemap].url} />
                <CursorTracker
                  onCoordinateChange={(la, lo) => setCoordinates(`${la.toFixed(3)}°N  ${lo.toFixed(3)}°E`)}
                />

                <Pane name="water" style={{ zIndex: 420 }}>
                  {LAKES.map((polygon, idx) => (
                    <Polygon
                      key={`lake-${idx}`}
                      positions={polygon}
                      pathOptions={{
                        color: basemap === 'mono' ? '#1f3342' : '#2e6fcf',
                        weight: 1,
                        fillColor: basemap === 'mono' ? '#5c7686' : '#4aa3ff',
                        fillOpacity: basemap === 'mono' ? 0.28 : 0.35,
                      }}
                    />
                  ))}
                </Pane>

                <Pane name="rivers" style={{ zIndex: 430 }}>
                  {RIVERS.map((river, idx) => (
                    <Polyline
                      key={`river-${idx}`}
                      positions={river.pts}
                      pathOptions={{
                        color: basemap === 'mono' ? '#0f1114' : RISK_COLORS[river.rk] || '#4aa3ff',
                        weight: basemap === 'mono' ? 4 : 5,
                        opacity: riverOpacity,
                        dashArray: basemap === 'mono' ? '6 4' : undefined,
                      }}
                    />
                  ))}
                </Pane>

                <Pane name="cities" style={{ zIndex: 450 }}>
                  {CITIES.map((city) => (
                    <CircleMarker
                      key={`city-${city.n}`}
                      center={[city.la, city.lo]}
                      radius={3}
                      pathOptions={{
                        color: basemap === 'mono' ? '#1a1f24' : '#d6e8ff',
                        fillColor: basemap === 'mono' ? '#4f5b66' : '#d6e8ff',
                        fillOpacity: 0.85,
                        weight: 1,
                      }}
                    >
                      <Tooltip direction="right" offset={[4, 0]} opacity={0.95} permanent={false}>
                        {city.n}
                      </Tooltip>
                    </CircleMarker>
                  ))}
                </Pane>

                <Pane name="stations" style={{ zIndex: 500 }}>
                  {stations.map((station) => {
                    const selected = selectedStation?.id === station.id;
                    const radius = selected ? 10 : 7;
                    return (
                      <CircleMarker
                        key={station.id}
                        center={[station.la, station.lo]}
                        radius={radius}
                        eventHandlers={{
                          click: () => handleSelectStation(station),
                        }}
                        pathOptions={{
                          color: '#ffffff',
                          weight: selected ? 2.3 : 1.4,
                          fillColor: RISK_COLORS[station.rk] || '#4aa3ff',
                          fillOpacity: 0.95,
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                          <div className="tip-id">{station.id} · {station.r}</div>
                          <div className="tip-n">{station.n}</div>
                          <div className="tip-row">Risk: {RISK_LABELS[station.rk] || 'Moderate'}</div>
                          <div className="tip-row">Sigma: {station.sg.toFixed(1)}</div>
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}
                </Pane>
              </MapContainer>

              <div className="s2b">{BASEMAPS[basemap].label} · Copernicus AOI Grid</div>
              <div className="map-status-overlay">
                <div className="map-status-title">Vardar River · Skopje Demo</div>
                <div className="map-status-line">Status: MEDIUM-HIGH RISK</div>
                <div className="map-status-line">Confidence: 0.82</div>
                <div className="map-status-line">ETA: 18 min</div>
                <div className="map-status-note">Risk signal, not final proof.</div>
              </div>
              <div className="crds">{coordinates}</div>
              <div className="leg">
                <div className="lr"><div className="ld" style={{ background: '#E24B4A' }} />Critical (5/5)</div>
                <div className="lr"><div className="ld" style={{ background: '#EF9F27' }} />Very high (4/5)</div>
                <div className="lr"><div className="ld" style={{ background: '#a8c340' }} />High (3/5)</div>
                <div className="lr"><div className="ld" style={{ background: '#3db87a' }} />Moderate (2/5)</div>
                <div className="lr"><div className="ld" style={{ background: '#3a80c0' }} />Low (1/5)</div>
              </div>
            </>
          ) : activeView === 'future' ? (
            <div className="future-wrap">
              <div className="future-title">Future Pollution Forecast</div>
              <div className="future-subtitle">Know before it reaches you.</div>
              <div className="future-card">
                <div className="future-card-title">Current event</div>
                <div className="future-line">River: Vardar</div>
                <div className="future-line">Station: Vardar: Veles to Skopje</div>
                <div className="future-line">Satellite risk: HIGH</div>
                <div className="future-line">Sensor status: NORMAL</div>
                <div className="future-line">Sigma deviation: 3.7</div>
                <div className="future-line">Rainfall: 12 mm</div>
                <div className="future-line">
                  Demo prediction confidence: {(futureForecast.modelConfidence * 100).toFixed(0)}% (up to 95% model confidence in demo mode)
                </div>
                <div className="future-line">Risk prediction, not final proof.</div>
              </div>

              <div className="future-card">
                <div className="future-card-title">Risk timeline</div>
                <div className="timeline-row">
                  <span>Now</span>
                  {timelineMarkers.map((marker) => (
                    <span key={marker.minute}>{marker.minute} min</span>
                  ))}
                </div>
                <div className="timeline-row timeline-values">
                  <span>{futureForecast.currentEvent.satelliteRisk}</span>
                  {timelineMarkers.map((marker) => (
                    <span key={`risk-${marker.minute}`}>{marker.level} ({marker.score})</span>
                  ))}
                </div>
              </div>

              <div className="future-grid">
                {futureForecast.forecast.map((item) => (
                  <div key={item.targetId} className="future-card">
                    <div className="future-card-title">{item.targetName} / {item.municipality}</div>
                    <div className="future-line">ETA: {item.etaLabel}</div>
                    <div className="future-line">Future risk: {item.futureRiskLevel} ({item.futureRiskScore})</div>
                    <div className="future-line">Model confidence: up to 95% in demo mode</div>
                    <div className="future-line">Response level: {item.futureRiskLevel === 'CRITICAL' ? 'Emergency' : item.futureRiskLevel === 'HIGH' ? 'Dispatch' : item.futureRiskLevel === 'MEDIUM' ? 'Prepare' : 'Monitor'}</div>
                    <div className="future-line">Population estimate: {item.populationEstimate.toLocaleString()}</div>
                    <div className="future-line">Citizen action: {item.recommendedCitizenAction}</div>
                    <div className="future-line">Municipality action: {item.recommendedMunicipalityAction}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeView === 'citizen' ? (
            <div className="future-wrap"><CitizenReports /></div>
          ) : activeView === 'cases' ? (
            <div className="future-wrap"><OpenCases /></div>
          ) : activeView === 'historical' ? (
            <div className="future-wrap"><HistoricalData /></div>
          ) : activeView === 'blindspots' ? (
            <div className="future-wrap"><SmallRiverBlindSpots /></div>
          ) : activeView === 'guardian' ? (
            <div className="future-wrap"><RiverGuardian /></div>
          ) : activeView === 'review' ? (
            <div className="future-wrap"><MunicipalityReview /></div>
          ) : activeView === 'european' ? (
            <div className="future-wrap"><EuropeanRivers /></div>
          ) : activeView === 'api' ? (
            <div className="future-wrap">
              <div className="module-wrap">
                <div className="module-title">API/Auth</div>
                <div className="module-sub">System diagnostics and raw integration messages.</div>
                <div className="module-card">
                  <div className="module-line">Configured: {String(authStatus.configured)}</div>
                  <div className="module-line">Authenticated: {String(authStatus.authenticated)}</div>
                  <div className="module-line">Status: {authStatus.status}</div>
                  <div className="module-line">Message: {authStatus.message}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="future-wrap"><IntelligenceLayer /></div>
          )}
        </div>

        <div className="side">
          {activeView === 'map' ? (
            <>
              <div className="nav-groups">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title} className="nav-group">
                    <div className="nav-group-title">{group.title}</div>
                    <div className="nav-group-items">
                      {group.items.map((item) => (
                        <button
                          key={`${group.title}-${item.label}`}
                          className={`nav-chip ${((item.id === 'demo' && demoMode) || (item.id !== 'demo' && item.id === activeView) || (item.id === 'map' && activeView === 'map')) ? 'active' : ''}`}
                          onClick={() => {
                            if (item.id === 'demo') {
                              handleEnableDemoMode();
                              return;
                            }
                            setActiveView(item.id);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="sh">Monitoring stations ({stations.length})</div>
              <div className="filter-wrap">
                <input
                  className="filter-input"
                  type="text"
                  placeholder="Filter by river, station, id..."
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                />
              </div>
              <div className="slist">
                {filteredStations.map((station) => (
                  <div
                    key={station.id}
                    className={`si ${selectedStation?.id === station.id ? 'sel' : ''}`}
                    onClick={() => handleSelectStation(station)}
                  >
                    <div className="si-id" style={{ color: RISK_COLORS[station.rk] || '#3db87a' }}>{station.id}</div>
                    <div className="si-n">{station.n}</div>
                    <div className="si-r" style={{ color: RISK_COLORS[station.rk] || '#3db87a' }}>
                      {RISK_LABELS[station.rk] || 'Moderate'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="dpane">
                <div className="dn">{selectedStation ? selectedStation.n : 'Select a station'}</div>
                {selectedStation && (
                  <>
                    <div className="dr"><span className="dl">Risk</span><span className="dv">{RISK_LABELS[selectedStation.rk] || 'Moderate'}</span></div>
                    <div className="dr"><span className="dl">Parameters</span><span className="dv">{selectedStation.par}</span></div>
                    <div className="dr"><span className="dl">EU WFD</span><span className="dv">{selectedStation.wfd}</span></div>
                    <div className="dr"><span className="dl">Sigma deviation</span><span className="dv">sigma = {selectedStation.sg.toFixed(1)}</span></div>
                    <div className="dr"><span className="dl">Coordinates</span><span className="dv">{selectedStation.la.toFixed(3)}N {selectedStation.lo.toFixed(3)}E</span></div>
                  </>
                )}
                <button className="abtn" onClick={handleScrape} disabled={loading}>
                  {loading ? 'Loading...' : 'Scrape Sentinel-2 for this point ->'}
                </button>
                {scrapeSummary && <div className="scrape-status">{scrapeSummary}</div>}
                {friendlyAuthWarning && <div className="module-warning">{friendlyAuthWarning}</div>}
                <div className="logic-panel">
                  <div className="logic-title">WaterWatch Intelligence Layer</div>
                  <div className="logic-text">
                    WaterWatch combines satellite monitoring, citizen evidence, future pollution forecasting, and municipality response into one public water safety system.
                  </div>
                  <div className="logic-bullet">- Satellite intelligence: Detect upstream risk over large river systems.</div>
                  <div className="logic-bullet">- Citizen evidence: Capture pollution signs satellites may miss, especially in small streams.</div>
                  <div className="logic-bullet">- Future forecast: Estimate where risk travels next and when it may reach people.</div>
                  <div className="logic-bullet">- Municipal action: Turn verified reports into inspections, alerts, and resolved cases.</div>
                  <div className="logic-strap">WaterWatch does not just show pollution. It helps people act before it spreads.</div>
                </div>
                <div className="logic-panel">
                  <div className="logic-title">WaterWatch logic</div>
                  <div className="logic-text">WaterWatch does not prove pollution 100%. It combines satellite signals, citizen reports, sensors, and institutional confirmation to warn people earlier.</div>
                  <div className="logic-bullet">- Satellite signal = early upstream risk</div>
                  <div className="logic-bullet">- Sensor/citizen report = validation</div>
                  <div className="logic-bullet">- Municipality = response</div>
                  <div className="logic-bullet">- User alert = protection</div>
                  <div className="logic-strap">Know before it reaches you.</div>
                  <div className="logic-strap">Risk signal, not final proof.</div>
                  <div className="logic-strap">Satellite signal + citizen report + local confirmation = trusted public alert.</div>
                </div>
                <div className="municipality-card">
                  <div className="municipality-title">Municipality Action Center</div>
                  <div className="municipality-line">Highest risk area: Skopje Center</div>
                  <div className="municipality-line">Estimated people affected: 196,000</div>
                  <div className="municipality-line">Response level: Dispatch</div>
                  <div className="municipality-line">Case status: Inspection Assigned</div>
                  <div className="municipality-line">Public alert: Ready</div>
                  <div className="alert-actions">
                    <button className="alert-btn" onClick={() => moveWorkflowTo(2)}>Dispatch inspection</button>
                    <button className="alert-btn" onClick={() => moveWorkflowTo(3)}>Send public alert</button>
                    <button className="alert-btn">Export report</button>
                  </div>
                </div>
                {demoResult && (
                  <>
                    <div className="demo-card">
                      <div className="demo-title">Demo Sentinel Result</div>
                      <div className="demo-line">{demoResult.source}</div>
                      <div className="demo-line">River: {demoResult.river}</div>
                      <div className="demo-line">Station: {demoResult.station}</div>
                      <div className="demo-line">Satellite risk: {demoResult.satelliteRisk}</div>
                      <div className="demo-line">Sensor status: {demoResult.sensorStatus}</div>
                      <div className="demo-line">Combined risk: {demoResult.combinedRisk}</div>
                      <div className="demo-line">Confidence: {demoResult.confidence}</div>
                      <div className="demo-line">Sigma deviation: {demoResult.deviation}</div>
                      <div className="demo-line">ETA: {demoResult.etaMinutes} minutes</div>
                      <div className="demo-line">Recommended action: {demoResult.recommendedAction}</div>
                      <div className="demo-note">{demoResult.explanation}</div>
                    </div>
                    <div className="alert-card">
                      <div className="alert-title">PUBLIC ALERT</div>
                      <div className="alert-text">Pollution risk may reach your area in 18 minutes.</div>
                      <div className="alert-text">Avoid river contact and warn nearby users.</div>
                      <div className="alert-actions">
                        <button className="alert-btn">Warn nearby users</button>
                        <button className="alert-btn">Report update</button>
                        <button className="alert-btn">Join cleanup</button>
                      </div>
                    </div>
                    <div className="municipality-card">
                      <div className="municipality-title">Municipality dashboard value:</div>
                      <div className="municipality-line">- Early warning</div>
                      <div className="municipality-line">- Heatmap</div>
                      <div className="municipality-line">- Verified reports</div>
                      <div className="municipality-line">- Affected area prediction</div>
                      <div className="municipality-line">- Exportable incident report</div>
                      <div className="municipality-note">You know before it becomes a scandal.</div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : activeView === 'future' ? (
            <div className="future-side">
              <div className="sh">Future Risk</div>
              <div className="future-card">
                <div className="future-card-title">Public alert preview</div>
                <div className="alert-title">PUBLIC ALERT</div>
                <div className="alert-text">{futureForecast.publicMessage}</div>
                <div className="alert-actions">
                  <button className="alert-btn">Warn nearby users</button>
                  <button className="alert-btn">Report update</button>
                  <button className="alert-btn">Share alert</button>
                </div>
              </div>

              <div className="future-card">
                <div className="future-card-title">Municipality Action Center</div>
                <div className="future-line">Affected municipalities: {affectedMunicipalities}</div>
                <div className="future-line">Highest risk area: {futureForecast.highestRiskTarget?.targetName || 'n/a'}</div>
                <div className="future-line">Estimated people affected: {futureForecast.totalPeoplePotentiallyAffected.toLocaleString()}</div>
                <div className="future-line">Recommended response level: {responseLevel}</div>
                <div className="future-line">Inspection priority: Upstream Vardar segment before Skopje</div>
                <div className="future-line">
                  Public communication draft: "WaterWatch has detected increased river pollution risk upstream. Citizens are advised to avoid direct river contact until further notice. Inspection teams are being dispatched."
                </div>
                <button className="abtn">Export incident report</button>
              </div>

              <div className="future-card">
                <div className="future-card-title">Municipality workflow</div>
                <div className="workflow-row">
                  {MUNICIPALITY_STEPS.map((step, index) => (
                    <span key={step} className={`workflow-pill ${index <= workflowStepIndex ? 'active' : ''}`}>{step}</span>
                  ))}
                </div>
                <div className="alert-actions">
                  <button className="alert-btn" onClick={() => moveWorkflowTo(1)}>Mark as verified</button>
                  <button className="alert-btn" onClick={() => moveWorkflowTo(2)}>Dispatch inspection</button>
                  <button className="alert-btn" onClick={() => moveWorkflowTo(3)}>Send public alert</button>
                  <button className="alert-btn" onClick={() => moveWorkflowTo(4)}>Mark resolved</button>
                </div>
              </div>

              <div className="future-card">
                <div className="future-card-title">Municipality report object</div>
                <pre className="report-json">{JSON.stringify(municipalityReport, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="future-side">
              <div className="sh">WaterWatch Intelligence Layer</div>
              {friendlyAuthWarning && (
                <div className="module-warning">{friendlyAuthWarning}</div>
              )}
              <div className="future-card">
                <div className="future-card-title">Public water safety operating system</div>
                <div className="future-line">Risk signal, not final proof.</div>
                <div className="future-line">Know before it reaches you.</div>
                <div className="future-line">Small rivers matter too.</div>
                <div className="future-line">From citizen signal to municipal action.</div>
                <div className="future-line">Satellite signal + citizen report + local confirmation = trusted public alert.</div>
              </div>
              <div className="future-card">
                <div className="future-card-title">Final product message</div>
                <div className="future-line">
                  WaterWatch helps communities detect what satellites miss, predict where risk goes next, and turn citizen signals into municipal action.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .ww-root { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #05080c; color: #d9e7f7; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #0b121a; border-bottom: 1px solid #1b2b3c; }
        .logo { font-size: 14px; font-weight: 700; letter-spacing: 0.04em; color: #d4e7ff; }
        .logo b { color: #68afff; }
        .sub { font-size: 11px; color: #7f9ebb; }
        .auth-badge {
          margin-left: auto;
          margin-right: 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid;
        }
        .auth-badge.ok { color: #7de2a5; border-color: #2e7c50; background: rgba(28, 86, 53, 0.45); }
        .auth-badge.bad { color: #ffb2b2; border-color: #8a3b3b; background: rgba(94, 34, 34, 0.45); }
        .auth-badge.checking { color: #f4dba3; border-color: #8a6f2f; background: rgba(90, 71, 29, 0.45); }
        .auth-badge.demo { color: #d6d9df; border-color: #626c79; background: rgba(74, 82, 92, 0.45); }
        .demo-btn { font-size: 11px; padding: 4px 9px; border-radius: 6px; border: 1px solid #4b5969; background: #1c2632; color: #c6d7ea; cursor: pointer; }
        .demo-btn.on { border-color: #6f7d8c; background: #374250; color: #eef4fb; }
        .view-nav { display: flex; gap: 6px; }
        .lbtns { display: flex; gap: 6px; margin-left: auto; }
        .lb { font-size: 11px; padding: 4px 11px; border-radius: 6px; border: 1px solid #2e4258; background: #121c28; color: #8fb2d3; cursor: pointer; }
        .lb.on { background: #2f4f6d; color: #f0f7ff; border-color: #4f7397; }
        .abar { background: #341f1f; color: #ffb2b2; font-size: 11px; padding: 6px 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #4b2b2b; }
        .demo-mode-banner { background: #3d3015; color: #f5dba2; font-size: 12px; padding: 8px 14px; display: flex; align-items: center; border-bottom: 2px solid #8a6f2f; }
        .demo-banner-content { display: flex; align-items: center; gap: 10px; width: 100%; }
        .demo-banner-icon { font-size: 16px; }
        .demo-banner-text { flex: 1; line-height: 1.4; }
        .demo-banner-text strong { color: #ffeaa7; }
        .hero-wrap { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; padding: 10px 14px; background: linear-gradient(180deg, #0a131d, #09111a); border-bottom: 1px solid #1b2b3c; }
        .hero-main, .hero-demo { border: 1px solid #2a425a; border-radius: 10px; background: #0f1b28; padding: 10px; }
        .hero-title { font-size: 15px; font-weight: 700; color: #e2f2ff; }
        .hero-subtitle { margin-top: 4px; font-size: 11px; color: #a7c5e2; line-height: 1.35; }
        .hero-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
        .hero-metric { border: 1px solid #31506d; border-radius: 8px; background: #132639; padding: 8px; }
        .hero-metric span { display: block; font-size: 9px; color: #93b6d8; text-transform: uppercase; letter-spacing: 0.03em; }
        .hero-metric strong { display: block; margin-top: 4px; font-size: 15px; color: #f0f8ff; }
        .hero-note { margin-top: 8px; font-size: 11px; color: #c4dbef; }
        .start-demo-btn { margin-top: 0; }
        .demo-progress { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
        .demo-step { border: 1px solid #3d5f80; border-radius: 999px; padding: 3px 7px; font-size: 9px; color: #9dc1e2; }
        .demo-step.active { border-color: #77a8d9; background: #264565; color: #ecf6ff; }
        .demo-step.done { border-color: #4fae87; background: #1f4d3d; color: #d8f7e9; }
        .demo-step-text { margin: 8px 0; font-size: 10px; color: #cde2f5; }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #ff6565; animation: blink 1.2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        .body { display: flex; flex: 1; overflow: hidden; }
        .mapwrap { flex: 1; position: relative; overflow: hidden; background: #06090e; }
        .leaflet-canvas { height: 100%; width: 100%; filter: saturate(0.92) contrast(1.05); }
        .side { width: 258px; display: flex; flex-direction: column; background: #0b121a; border-left: 1px solid #1b2b3c; }
        .sh { font-size: 10px; font-weight: 700; color: #6f8ba6; text-transform: uppercase; letter-spacing: 0.09em; padding: 10px 12px 7px; border-bottom: 1px solid #1b2b3c; }
        .filter-wrap { padding: 8px 12px; border-bottom: 1px solid #1b2b3c; }
        .filter-input { width: 100%; padding: 7px 8px; border-radius: 6px; border: 1px solid #2e4258; background: #111a24; color: #d6e8fb; font-size: 11px; }
        .filter-input::placeholder { color: #6282a0; }
        .slist { flex: 1; overflow-y: auto; }
        .slist::-webkit-scrollbar { width: 4px; }
        .slist::-webkit-scrollbar-thumb { background: #2d4258; }
        .si { padding: 8px 12px; border-bottom: 1px solid #132131; cursor: pointer; transition: background 0.12s ease; }
        .si:hover { background: #132536; }
        .si.sel { background: #1a3148; border-left: 2px solid #68afff; }
        .si-id { font-size: 10px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .si-n { font-size: 11px; color: #bad4ec; margin-top: 2px; line-height: 1.3; }
        .si-r { font-size: 10px; margin-top: 2px; }
        .dpane { border-top: 1px solid #1b2b3c; padding: 10px 12px; background: #0d151f; }
        .dn { font-size: 11px; font-weight: 700; margin-bottom: 8px; color: #d9e7f7; line-height: 1.3; }
        .dr { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; margin-bottom: 4px; align-items: flex-start; }
        .dl { color: #7a97b4; }
        .dv { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: #a9cae8; text-align: right; max-width: 130px; line-height: 1.4; }
        .abtn { width: 100%; margin-top: 10px; font-size: 11px; padding: 8px; border-radius: 6px; background: #376089; color: #f4f9ff; border: 1px solid #4f7397; cursor: pointer; font-weight: 700; }
        .abtn:hover { background: #2e5379; }
        .abtn:disabled { opacity: 0.55; cursor: not-allowed; }
        .scrape-status { margin-top: 8px; font-size: 10px; color: #8ab0d1; line-height: 1.4; }
        .logic-panel { margin-top: 10px; padding: 8px; border: 1px solid #25384c; border-radius: 6px; background: #101b27; }
        .logic-title { font-size: 10px; font-weight: 700; color: #cde0f4; margin-bottom: 5px; }
        .logic-text { font-size: 10px; color: #94b4d4; line-height: 1.35; margin-bottom: 4px; }
        .logic-bullet { font-size: 10px; color: #9fc1e1; line-height: 1.3; }
        .logic-strap { font-size: 10px; color: #b5d4f0; margin-top: 4px; line-height: 1.3; }
        .demo-card, .alert-card, .municipality-card { margin-top: 10px; padding: 8px; border-radius: 6px; border: 1px solid #304963; background: #121f2d; }
        .demo-title, .alert-title, .municipality-title { font-size: 10px; font-weight: 700; color: #d6e8fb; margin-bottom: 5px; }
        .demo-line, .alert-text, .municipality-line { font-size: 10px; color: #a8c7e5; line-height: 1.35; }
        .demo-note, .municipality-note { margin-top: 6px; font-size: 10px; color: #bcd5eb; line-height: 1.35; }
        .alert-actions { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
        .alert-btn { border-radius: 6px; border: 1px solid #496481; background: #20364c; color: #ddecfb; font-size: 10px; padding: 5px 6px; cursor: pointer; }
        .future-wrap { height: 100%; overflow: auto; padding: 12px; background: #091320; }
        .future-title { font-size: 16px; font-weight: 700; color: #d9ebff; }
        .future-subtitle { font-size: 11px; color: #99b8d8; margin: 4px 0 10px; }
        .future-grid { display: grid; grid-template-columns: repeat(2, minmax(230px, 1fr)); gap: 10px; }
        .future-card { margin-bottom: 10px; padding: 9px; border-radius: 8px; border: 1px solid #304963; background: #101c29; }
        .future-card-title { font-size: 11px; font-weight: 700; color: #d5eaff; margin-bottom: 5px; }
        .future-line { font-size: 10px; color: #a9c9e8; line-height: 1.35; margin-bottom: 3px; }
        .timeline-row { display: grid; grid-template-columns: repeat(5, minmax(60px, 1fr)); gap: 4px; margin-top: 6px; font-size: 10px; color: #b7d2ec; }
        .timeline-values span { border: 1px solid #355273; border-radius: 6px; padding: 4px; background: #142537; text-align: center; }
        .future-side { overflow-y: auto; }
        .workflow-row { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
        .workflow-pill { border: 1px solid #45617d; border-radius: 999px; padding: 3px 7px; font-size: 9px; color: #98b5d2; }
        .workflow-pill.active { background: #244463; color: #e5f2ff; border-color: #5b83ad; }
        .report-json { margin-top: 6px; font-size: 10px; line-height: 1.35; color: #9ec1e4; white-space: pre-wrap; word-break: break-word; }
        .module-wrap { padding: 2px; }
        .module-title { font-size: 16px; font-weight: 700; color: #dbecff; margin-bottom: 5px; }
        .module-sub { font-size: 11px; color: #9fbde0; margin-bottom: 10px; line-height: 1.35; }
        .module-grid { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: 10px; }
        .module-grid.three-cols { grid-template-columns: repeat(3, minmax(180px, 1fr)); }
        .module-card { margin-bottom: 10px; border: 1px solid #2f4964; border-radius: 8px; background: #101d2a; padding: 9px; }
        .module-card.glass { background: rgba(16, 29, 42, 0.65); backdrop-filter: blur(2px); }
        .module-card.locked { opacity: 0.75; }
        .module-card.unlocked { border-color: #4f88bf; box-shadow: 0 0 0 1px rgba(79, 136, 191, 0.4) inset; }
        .module-card-title { font-size: 11px; font-weight: 700; color: #d5eaff; margin-bottom: 5px; }
        .module-line { font-size: 10px; color: #a8c7e5; line-height: 1.35; margin-bottom: 3px; }
        .module-line.emphasis { color: #d9eeff; font-weight: 700; }
        .module-actions { margin-top: 6px; display: flex; gap: 5px; flex-wrap: wrap; }
        .module-btn { border-radius: 6px; border: 1px solid #4d6782; background: #21384e; color: #e6f3ff; padding: 5px 7px; font-size: 10px; cursor: pointer; }
        .module-btn.active { background: #2d5376; border-color: #6a95bf; color: #f4f9ff; }
        .module-warning { margin-top: 8px; font-size: 10px; color: #f5cba2; border: 1px solid #7c5f3f; border-radius: 6px; padding: 7px; background: rgba(102, 71, 35, 0.3); }
        .module-badges { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
        .module-badge { border: 1px solid #567698; border-radius: 999px; padding: 2px 7px; font-size: 9px; color: #c6def5; }
        .module-badge.safe { border-color: #4aa37a; color: #baf5d8; background: rgba(28, 90, 61, 0.35); }
        .module-badge.watch, .module-badge.live { border-color: #4fa3cf; color: #b8e8ff; background: rgba(31, 78, 112, 0.35); }
        .module-badge.risky, .module-badge.high { border-color: #d39d4f; color: #ffe1b0; background: rgba(105, 72, 26, 0.35); }
        .module-badge.critical { border-color: #c45a5a; color: #ffd0d0; background: rgba(110, 38, 38, 0.4); }
        .module-badge.demo { border-color: #727e8b; color: #d5dbe2; background: rgba(71, 78, 88, 0.35); }
        .module-badge.municipality { border-color: #48a06f; color: #b8f1cf; background: rgba(24, 82, 56, 0.35); }
        .module-badge.citizen, .module-badge.sensor { border-color: #5d90d0; color: #cfe6ff; background: rgba(39, 64, 99, 0.35); }
        .module-json { margin-top: 6px; white-space: pre-wrap; font-size: 9px; color: #9ec1e4; line-height: 1.3; }
        .river-list-item { border: 1px solid #2d4560; border-radius: 6px; padding: 6px; margin-bottom: 6px; background: #122233; cursor: pointer; font-size: 10px; color: #b2d0eb; }
        .river-list-item.active { border-color: #6f9bc8; background: #1a3248; color: #eaf5ff; }
        .river-list-item { border: 1px solid #2d4560; border-radius: 6px; padding: 6px; margin-bottom: 6px; background: #122233; cursor: pointer; font-size: 10px; color: #b2d0eb; }
        .river-list-item.active { border-color: #6f9bc8; background: #1a3248; color: #eaf5ff; }
        .hist-row { display: grid; grid-template-columns: 90px 1fr 24px; gap: 6px; align-items: center; margin-bottom: 6px; }
        .hist-label, .hist-count { font-size: 10px; color: #9fc1e4; }
        .hist-bar { height: 8px; border-radius: 999px; background: #1b2c3f; border: 1px solid #324e6c; overflow: hidden; }
        .hist-fill { height: 100%; background: linear-gradient(90deg, #4aa3ff, #2fd7d4); }
        .ring-bg { width: 100%; height: 9px; border-radius: 999px; background: #192a3d; border: 1px solid #2e4b69; overflow: hidden; margin: 5px 0; }
        .ring-fill { height: 100%; }
        .ring-fill.cyan { background: linear-gradient(90deg, #2fd7d4, #4aa3ff); }
        .ring-fill.green { background: linear-gradient(90deg, #48d482, #8be7a0); }
        .ring-fill.orange { background: linear-gradient(90deg, #e58b2e, #f9b65a); }
        .nav-groups { padding: 8px 10px; border-bottom: 1px solid #1f3348; background: #0c1723; }
        .nav-group { margin-bottom: 7px; }
        .nav-group:last-child { margin-bottom: 0; }
        .nav-group-title { font-size: 9px; color: #7ea0c1; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .nav-group-items { display: flex; flex-wrap: wrap; gap: 5px; }
        .nav-chip { border-radius: 999px; border: 1px solid #36506b; background: #142536; color: #a6c6e5; font-size: 9px; padding: 3px 7px; cursor: pointer; }
        .nav-chip.active { background: #2a4b6b; border-color: #78a7d6; color: #eff7ff; }
        .map-status-overlay { position: absolute; top: 10px; left: 10px; z-index: 1000; border: 1px solid #345779; border-radius: 8px; background: rgba(8, 18, 28, 0.92); padding: 8px; min-width: 210px; }
        .map-status-title { font-size: 11px; font-weight: 700; color: #e5f3ff; }
        .map-status-line { font-size: 10px; color: #a7c7e5; margin-top: 3px; }
        .map-status-note { font-size: 10px; color: #d6e9fb; margin-top: 5px; }
        .s2b { position: absolute; top: 10px; right: 10px; background: rgba(5, 11, 18, 0.92); border-radius: 8px; padding: 6px 10px; font-size: 10px; color: #8ab0d1; border: 1px solid #1d2f42; z-index: 1000; }
        .crds { position: absolute; bottom: 10px; right: 10px; background: rgba(5, 11, 18, 0.92); border-radius: 6px; padding: 4px 8px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #8ab0d1; border: 1px solid #1d2f42; z-index: 1000; }
        .leg { position: absolute; bottom: 10px; left: 10px; background: rgba(5, 11, 18, 0.92); border-radius: 8px; padding: 8px 10px; border: 1px solid #1d2f42; z-index: 1000; }
        .lr { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #9ab6d1; margin-bottom: 3px; }
        .lr:last-child { margin-bottom: 0; }
        .ld { width: 8px; height: 8px; border-radius: 50%; }
        .tip-id { font-size: 10px; font-weight: 700; }
        .tip-n { font-size: 11px; font-weight: 700; margin: 2px 0 4px; }
        .tip-row { font-size: 10px; color: #d4e7f7; }
        @media (max-width: 1180px) {
          .bar { flex-wrap: wrap; gap: 6px; }
          .hero-wrap { grid-template-columns: 1fr; }
          .view-nav { width: 100%; overflow-x: auto; padding-bottom: 2px; }
          .lbtns { margin-left: 0; }
          .side { width: 300px; }
          .future-grid, .module-grid { grid-template-columns: 1fr; }
          .module-grid.three-cols { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .body { flex-direction: column; }
          .side { width: 100%; max-height: 45vh; border-left: none; border-top: 1px solid #1b2b3c; }
          .mapwrap { min-height: 55vh; }
        }
      `}</style>
    </div>
  );
};

export default WaterWatchMap;
