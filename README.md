# WaterWatch: Satellite-Based River Anomaly Early Warning System

![WaterWatch Logo](https://img.shields.io/badge/WaterWatch-MVP-blue)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![React](https://img.shields.io/badge/React-18+-61dafb)
![Backend Tests](https://github.com/waterwatchapp/waterwatch/actions/workflows/test.yml/badge.svg)

## Overview

WaterWatch is a unified platform for **satellite-based water quality anomaly detection** combining:
- **Sentinel-2 L2A** optical data (NDWI water index)
- **Sentinel-1 GRD** radar data (cloud-independent SAR backscatter)
- **Citizen crowdsourcing** for ground truth validation
- **Downstream flow modeling** for risk propagation
- **Statistical risk signals** (z-score based)

**Scientific Approach:** Uses "satellite-based anomaly," "risk estimation," and "early warning" language. Does NOT claim to "prove pollution" or determine absolute water safety.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Copernicus Data Space Sentinel Hub              │
│   OAuth2 | Catalog API | Process API (NDWI/SAR)         │ 
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
    ┌───▼────────┐         ┌──────▼───┐
    │ Sentinel-2 │         │Sentinel-1│
    │  NDWI      │         │  SAR VV  │
    └───┬────────┘         └──────┬───┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   Risk Engine (Fusion)  │
        │  Z-score Anomaly Detect │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
    ┌───▼──────────┐       ┌──────▼─────┐
    │ Flow Model   │       │  Citizen   │
    │ (ETA)        │       │  Reports   │
    └───┬──────────┘       └──────┬─────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   Alert JSON Generator  │
        │  (station_id, type,     │
        │   message, confidence)  │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   Frontend LiveMap      │
        │  (React/Leaflet)        │
        └─────────────────────────┘
```

---

## Project Structure

```
FlowX water/
├── backend/
│   ├── app.py                        # Flask API server
│   ├── models.py                     # Data models (Alert, Station, etc.)
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Environment template
│   └── services/
│       ├── copernicus_service.py     # OAuth2 + Catalog/Process API clients
│       ├── risk_engine.py            # NDWI/SAR analysis + z-score fusion
│       └── flow_model.py             # Downstream ETA calculations
│
├── notebooks/
│   └── WaterWatch_Connected_Copernicus_API.ipynb  # Full pipeline demo
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── waterwatchApi.js      # Backend API client
│   │   └── components/
│   │       └── LiveMap.jsx           # React map component
│   ├── .env.example                  # Frontend env template
│   └── package.json                  # NPM dependencies
│
└── README.md                          # This file
```

---

## Quick Start

### 1. Prerequisites

- **Copernicus Account:** Register at [dataspace.copernicus.eu](https://dataspace.copernicus.eu/)
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **Git**

### 2. Get Copernicus Credentials

1. Go to [https://dataspace.copernicus.eu/](https://dataspace.copernicus.eu/)
2. Create account and log in
3. Navigate to **My Apps** → **New App**
4. Create OAuth2 app with credentials (client_id, client_secret)
5. Save credentials

### 3. Backend Setup

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env with your Copernicus credentials

# Install dependencies
pip install -r requirements.txt

# Run API server (development)
npm run dev

# Server runs at http://localhost:5001
```

**Test API:**
```bash
curl http://localhost:5000/api/health
# Returns: {"status": "ok", "version": "0.1.0-mvp", ...}
```

### 4. Frontend Setup

```bash
cd frontend

# Copy environment
cp .env.example .env.local

# Install dependencies
npm install

# Run development server
npm start

# Opens at http://localhost:3000
```

### 5. Run Jupyter Notebook Demo

```bash
cd notebooks

jupyter notebook WaterWatch_Connected_Copernicus_API.ipynb

# OR use VS Code Notebook extension
# Set Copernicus credentials in cell 1
# Run through all cells
```

---

## Demo vs Production

### Demo Mode (Default, No Credentials Needed)

**When enabled:** `DEMO_MODE=true` (default)

Demo Mode provides a fully functional WaterWatch experience with **simulated satellite data**:

-  **Get started immediately** — no Copernicus registration required
-  **Test UI/UX** — see complete workflow with demo alerts
-  **Develop features** — build new components without API overhead
- **Run tests** — CI pipeline passes without credentials

**Visible indicators:**
- Backend returns `"demo": true` in `satellite_signal`
- Frontend shows prominent **"DEMO MODE ACTIVE"** banner
- Auth badge displays "DEMO MODE" instead of "AUTH OK"

**Demo endpoints and responses:**
- `GET /api/health` → Always works 
- `GET /api/stations` → Returns real station list 
- `POST /api/alerts/station/{station_id}` → Returns simulated alerts with `"demo": true` 
- `GET /api/catalog/sentinel2/{station_id}` → Returns demo Sentinel-2 product 
- `GET /api/catalog/sentinel1/{station_id}` → Returns demo Sentinel-1 product 

**Example demo alert response:**
```json
{
  "alert_id": "alert_a1b2c3d4",
  "station_id": "vardar_vs",
  "alert_type": "warning",
  "satellite_signal": {
    "source": "fused-s2-s1",
    "sigma": 1.8,
    "confidence": 0.82,
    "demo": true
  },
  "timestamp_utc": "2024-01-15T10:30:00Z"
}
```

### Production Mode (Real Satellite Data)

**When enabled:** Set `DEMO_MODE=false` and configure Copernicus credentials

Production Mode uses **real satellite imagery**:

- **Real NDWI data** from Sentinel-2 L2A
- **Real SAR VV backscatter** from Sentinel-1 GRD
- **Live catalog searches** with actual product metadata
- **Processing API requests** for on-demand image analysis

**Required setup:**
```bash
# 1. Register for Copernicus account
#    https://dataspace.copernicus.eu/

# 2. Create OAuth2 app credentials (client_id, client_secret)

# 3. Set environment variables
export DEMO_MODE=false
export COPERNICUS_CLIENT_ID="your-client-id"
export COPERNICUS_CLIENT_SECRET="your-client-secret"

# 4. Restart backend
python app.py
```

**Real data endpoints:**
- `GET /api/auth/status` → Returns OAuth token status
- `GET /api/catalog/sentinel2/{station_id}` → Queries real Copernicus Catalog API
- `POST /api/alerts/station/{station_id}` → Uses real Process API for NDWI/SAR calculation
- Response includes `"demo": false` or no demo flag

**Example production alert response:**
```json
{
  "alert_id": "alert_x9y8z7w6",
  "station_id": "vardar_vs",
  "alert_type": "critical",
  "satellite_signal": {
    "source": "sentinel-2-l2a",
    "sigma": 2.8,
    "confidence": 0.91,
    "current_value": 0.58,
    "baseline_mean": 0.35
  },
  "timestamp_utc": "2024-01-15T10:35:42Z"
}
```

### Endpoint Reference: Demo vs Production

| Endpoint | Demo Mode | Production Mode |
|----------|-----------|-----------------|
| `/api/health` |  Works |  Works |
| `/api/stations` |  Works | Works |
| `/api/auth/status` | Returns not_configured | Returns auth_ok or auth_failed |
| `/api/alerts/station/{id}` |  Simulated data |  Real satellite data |
| `/api/catalog/sentinel2/{id}` |  Demo products |  Real product search |
| `/api/catalog/sentinel1/{id}` |  Demo products |  Real product search |
| `/api/reports/submit` | Works (in-memory) |  Works (DB backed) |

---

## API Endpoints

### Health Check
```
GET /api/health
→ {"status": "ok", "version": "0.1.0-mvp", "timestamp": "2024-01-15T10:30:00Z"}
```

### List Stations
```
GET /api/stations
→ {"stations": [
    {"id": "vardar_vs", "name": "Vardar: Veles to Skopje", "river": "Vardar", "bbox": [...]}
  ]}
```

### Generate Alert
```
POST /api/alerts/station/{station_id}
Body: {"use_process_api": true, "date": "2024-01-15", "days_back": 7}
→ WaterWatchAlert JSON with satellite_signal, citizen_reports, movement_model
```

### Catalog Search
```
GET /api/catalog/sentinel2/{station_id}?days_back=7&max_cloud_cover=80
GET /api/catalog/sentinel1/{station_id}?days_back=7
→ {products: [{id, datetime, cloud_cover, ...}]}
```

### Citizen Reports
```
POST /api/reports/submit
Body: {
  "station_id": "vardar_vs",
  "latitude": 41.97,
  "longitude": 21.55,
  "observation_type": "photo",
  "message": "Unusual discoloration observed",
  "confirmed": false
}
→ {"report_id": "report_...", "status": "submitted", "timestamp": "..."}

GET /api/reports/station/{station_id}
→ {"report_count": 3, "confirmed_count": 2, "reports": [...]}
```

---

## Data Models

### Alert Type Classification
```python
NORMAL      # Confidence > 0.4, |sigma| < 1.5
WARNING     # Confidence > 0.4, 1.5 < |sigma| < 2.5
CRITICAL    # Confidence > 0.4, |sigma| > 2.5
DATA_SPARSE # Confidence < 0.4 (insufficient satellite data)
```

### Risk Signal (Z-Score)
```
sigma = (current_value - baseline_mean) / baseline_std

NDWI Baseline (Vardar):
  mean = 0.35, std = 0.12

SAR VV Baseline (Vardar):
  mean = -11.5 dB, std = 2.1 dB

Anomaly Threshold: |sigma| > 1.5
```

### Citizen Report Types
- **photo**: Image attachment (base64 encoded in production)
- **voice**: Audio description (URL to audio file)
- **description**: Text observation

---

## Hardcoded AOIs (MVP)

```python
{
  "vardar_vs": {
    "name": "Vardar: Veles to Skopje",
    "bbox": [21.45, 41.92, 21.65, 42.02],
    "flow_speed_mps": 1.2,
    "downstream": ["skopje_city", "vardar_mouth"]
  },
  "treska_km": {
    "name": "Treska: Kozjak to Matka",
    "bbox": [20.95, 41.92, 21.15, 42.08],
    "flow_speed_mps": 0.95,
    "downstream": ["vardar_vs"]
  },
  "ohrid_s": {
    "name": "Ohrid Lake: Studencista",
    "bbox": [20.78, 41.09, 20.88, 41.19],
    "flow_speed_mps": 0.5,
    "downstream": ["ohrid_city"]
  }
}
```

---

## Scientific Methodology

### NDWI (Normalized Difference Water Index)
```
NDWI = (B8A - B11) / (B8A + B11)

Where:
  B8A = Sentinel-2 NIR band (865nm)
  B11 = Sentinel-2 SWIR band (1610nm)

Interpretation:
  NDWI > 0.4   → Water present
  NDWI > 0.7   → Very high water / potential flooding
  NDWI < 0.0   → No water
```

### SAR VV Backscatter (Sentinel-1 GRD)
```
Processing:
  - Orthorectification enabled
  - Backcoeff: GAMMA0_TERRAIN
  - DEM: COPERNICUS_30

Interpretation:
  More negative VV (dB) → Smooth surface (water-like)
  Less negative VV → Rough surface (unusual backscatter)
```

### Data Fusion Strategy
```
IF NDWI confidence > 0.5:
  IF SAR confidence > 0.5:
    fused_sigma = 0.65 * NDWI_sigma + 0.35 * SAR_sigma
    source = "fused-s2-s1"
  ELSE:
    fused_sigma = NDWI_sigma
    source = "sentinel-2-l2a"
ELSE IF SAR confidence > 0.4:
  fused_sigma = SAR_sigma
  source = "sentinel-1-grd"
ELSE:
  source = "none"
  confidence = 0.0
```

### Responsible Language

 **Use These Terms:**
- "Satellite-based anomaly"
- "Risk estimation"
- "Early warning system"
- "Possible pollution risk"
- "Requires on-site verification"

 **Avoid These Claims:**
- "Satellite proves water is polluted"
- "Water is safe/unsafe"
- "Definitive measurement of pollution"
- "100% confident in detection"

---

## Testing & Validation

### Backend Tests
```bash
cd backend

# Test API endpoints
pytest tests/

# Test authentication
python -c "from services.copernicus_service import CopernicusAuthManager; auth = CopernicusAuthManager('test', 'test'); auth.get_token()"

# Test risk calculations
python -c "from services.risk_engine import RiskEngine; engine = RiskEngine(); print(engine.SIGMA_ANOMALY_THRESHOLD)"
```

### Frontend Tests
```bash
cd frontend

npm test

# Test API client
npm run test:api
```

### Integration Test
```bash
# 1. Start backend
cd backend && python app.py &

# 2. Query endpoint
curl -X POST http://localhost:5000/api/alerts/station/vardar_vs \
  -H "Content-Type: application/json" \
  -d '{"days_back": 7}'

# 3. Verify JSON response contains alert_id, satellite_signal, citizen_reports, etc.
```

---

## Deployment

### Production Backend (Gunicorn)
```bash
cd backend

# Install production server
pip install gunicorn

# Run with 4 workers
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# With environment file
export $(cat .env | xargs)
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Production Frontend (React)
```bash
cd frontend

# Build
npm run build

# Serve with any static host (Vercel, Netlify, AWS S3, etc.)
# Or use Node.js server:
npm install -g serve
serve -s build -l 3000
```

### Docker (Optional)

**Backend Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:18 as build
WORKDIR /app
COPY frontend/package*.json .
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:18-alpine
RUN npm install -g serve
COPY --from=build /app/build /app/build
WORKDIR /app
CMD ["serve", "-s", "build", "-l", "3000"]
```

---

## Performance & Limitations

### Current (MVP)
- **Data:** Simulated satellite data + hardcoded AOIs
- **Latency:** <1s for alert generation
- **Citizen Reports:** In-memory store (lost on restart)
- **Scale:** Single-threaded Flask dev server

### Production Roadmap
- Real Process API calls (5-30s latency for image processing)
- PostgreSQL for persistent storage
- Redis for caching + async tasks (Celery)
- Multi-region deployment (AWS Lambda, GCP Cloud Run)
- WebSocket for real-time alert streaming
- S3/GCS for image storage
- ML-based false positive filtering

---

## Troubleshooting

### "Copernicus credentials not configured"
```
→ Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in .env
→ Restart backend: python app.py
```

### "OAuth2 token request failed"
```
→ Verify credentials are correct
→ Check internet connection
→ Test with curl:
   curl -X POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token \
     -d "grant_type=client_credentials" \
     -u "CLIENT_ID:CLIENT_SECRET"
```

### "No Sentinel-2 products found"
```
→ Try increasing days_back (default 7)
→ Check bbox overlaps actual S2 coverage
→ Increase max_cloud_cover threshold
→ Sentinel-2 revisit time is ~5 days
```

### Frontend blank screen
```
→ Check browser console for errors (Ctrl+Shift+K)
→ Verify API_BASE_URL in .env.local
→ Ensure backend is running (curl http://localhost:5000/api/health)
→ Check CORS headers in browser Network tab
```

---

## Contributing

WaterWatch is an open-source environmental monitoring platform. Contributions are welcome.

To contribute:

1. **Fork** this repository
2. Create a **feature branch** (`git checkout -b feature/my-feature`)
3. **Commit** changes with clear messages
4. **Push** to branch
5. **Open Pull Request** with description

### Areas for Contribution
- [ ] Real-time WebSocket alerts
- [ ] Machine learning anomaly detection
- [ ] Multi-language UI
- [ ] Mobile app (React Native)
- [ ] Advanced flow modeling (HEC-RAS integration)
- [ ] Drainage basin routing
- [ ] Historical trend analysis
- [ ] API rate limiting + auth

---

## License

MIT License - see LICENSE file

---

## References

- **Copernicus Data Space:** https://dataspace.copernicus.eu/
- **Sentinel Hub API:** https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/
- **NDWI Literature:** https://en.wikipedia.org/wiki/Normalized_difference_water_index
- **SAR Water Detection:** https://www.usgs.gov/faqs/what-difference-between-sar-and-optical-imagery
- **OpenID Connect:** https://openid.net/connect/

---

## Contact & Support

**Mentors:** Copernicus Sentinel Hub team  
**Hackathon:** Water Quality Early Warning Challenge  
**Team:** WaterWatch Contributors

For issues: [GitHub Issues](https://github.com/yourusername/waterwatchrepo/issues)

---

**Built for water quality monitoring**
