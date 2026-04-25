const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export function getSentinelDataCollections() {
  return [
    {
      id: 'SENTINEL1_GRD',
      name: 'Sentinel-1 GRD',
      type: 'radar',
      useInWaterWatch: 'Cloud-independent radar surface change indicator',
    },
    {
      id: 'SENTINEL2_L1C',
      name: 'Sentinel-2 L1C',
      type: 'optical',
      useInWaterWatch: 'Top-of-atmosphere optical imagery',
    },
    {
      id: 'SENTINEL2_L2A',
      name: 'Sentinel-2 L2A',
      type: 'optical',
      useInWaterWatch: 'Surface reflectance imagery for water color/turbidity-style indicators',
    },
    {
      id: 'SENTINEL3_OLCI',
      name: 'Sentinel-3 OLCI',
      type: 'ocean_land_color',
      useInWaterWatch: 'Large water-body color and quality monitoring support',
    },
    {
      id: 'CLMS_WATER_BODIES',
      name: 'CLMS Water Bodies',
      type: 'water_body_product',
      useInWaterWatch: 'Water body extent and lake/water monitoring context',
    },
    {
      id: 'CLMS_LAKE_WATER_QUALITY',
      name: 'CLMS Lake Water Quality',
      type: 'water_quality_product',
      useInWaterWatch: 'Lake water quality context where available',
    },
  ];
}

export async function fetchSupportedCollections() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/copernicus/collections`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload.collections) ? payload.collections : getSentinelDataCollections();
  } catch (error) {
    return getSentinelDataCollections();
  }
}

export function buildSentinel2ProcessPayload({ bbox, timeFrom, timeTo }) {
  return {
    bbox,
    timeFrom,
    timeTo,
    evalscript: `//VERSION=3
function setup() {
  return {
    input: ["B03", "B08", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08 + 0.0001);
  let waterSignal = Math.max(0, Math.min(1, (ndwi + 1) / 2));
  return [waterSignal, 0.2, 1 - waterSignal, sample.dataMask];
}`,
  };
}

export function buildSentinel1GRDPayload({ bbox, timeFrom, timeTo }) {
  return {
    bbox,
    timeFrom,
    timeTo,
    evalscript: `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  let vv = sample.VV;
  let vh = sample.VH;
  let ratio = (vv - vh) / (Math.abs(vv) + Math.abs(vh) + 0.001);
  let radarSignal = Math.max(0, Math.min(1, (ratio + 1) / 2));
  return [radarSignal, 1 - radarSignal, 0.3, sample.dataMask];
}`,
  };
}

export function parseSatelliteResult(result) {
  return {
    source: result?.sourceType === 'demo' ? 'Demo' : 'Copernicus Sentinel Hub',
    collection: result?.collection || 'SENTINEL2_L2A',
    river: result?.river || 'Unknown',
    timestamp: new Date().toISOString(),
    signalType: result?.signalType || 'Satellite-derived risk indicator',
    satelliteRiskIndicator: result?.satelliteRiskIndicator || 'Unknown',
    confidence: result?.confidence ?? null,
    disclaimer: 'Satellite signal is not final proof of pollution.',
  };
}

export async function fetchRiverSatelliteSignal(river, mode = 'sentinel2') {
  try {
    const auth = await fetch(`${API_BASE_URL}/api/auth/status`).then((r) => r.json());
    if (!auth?.authenticated) {
      return {
        sourceType: 'demo',
        message: 'Demo satellite signal. Live Copernicus auth unavailable.',
        satelliteRiskIndicator: 'DEMO ONLY',
        confidence: null,
        collection: mode === 'sentinel1' ? 'SENTINEL1_GRD' : 'SENTINEL2_L2A',
        river: river?.name,
      };
    }

    const now = new Date();
    const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    const payload = mode === 'sentinel1'
      ? buildSentinel1GRDPayload({ bbox: river.bbox, timeFrom: from, timeTo: to })
      : buildSentinel2ProcessPayload({ bbox: river.bbox, timeFrom: from, timeTo: to });
    const endpoint = mode === 'sentinel1'
      ? `${API_BASE_URL}/api/copernicus/process/sentinel1`
      : `${API_BASE_URL}/api/copernicus/process/sentinel2`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      sourceType: 'copernicus_signal',
      message: data.message || 'Copernicus satellite signal',
      satelliteRiskIndicator: data.satelliteRiskIndicator || 'Satellite-derived risk indicator',
      confidence: null,
      collection: mode === 'sentinel1' ? 'SENTINEL1_GRD' : 'SENTINEL2_L2A',
      river: river?.name,
      signalType: mode === 'sentinel1' ? 'Radar support signal' : 'Optical water signal',
    };
  } catch (error) {
    return {
      sourceType: 'demo',
      message: 'Demo satellite signal. Live Copernicus auth unavailable.',
      satelliteRiskIndicator: 'DEMO ONLY',
      confidence: null,
      collection: mode === 'sentinel1' ? 'SENTINEL1_GRD' : 'SENTINEL2_L2A',
      river: river?.name,
    };
  }
}

console.assert(getSentinelDataCollections().some((c) => c.id === 'SENTINEL1_GRD'), 'Sentinel collections include SENTINEL1_GRD');
console.assert(getSentinelDataCollections().some((c) => c.id === 'SENTINEL2_L2A'), 'Sentinel collections include SENTINEL2_L2A');
console.assert(Boolean(parseSatelliteResult({}).disclaimer), 'every satellite output includes disclaimer');
