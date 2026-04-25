import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple
import json
import numpy as np
import requests
from io import BytesIO

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Import services
from services.copernicus_service import (
    CopernicusAuthManager,
    CopernicusAuthError,
    CatalogSearchClient,
    ProcessAPIClient,
    get_date_range,
)
from services.risk_engine import RiskEngine
from services.flow_model import FlowModel
from models import (
    RiverStation,
    AlertType,
    WaterWatchAlert,
    CitizenReport,
    generate_alert_id,
    create_station_config,
)

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize services
DEFAULT_COPERNICUS_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"

COPERNICUS_CLIENT_ID = (
    os.getenv("COPERNICUS_CLIENT_ID")
    or os.getenv("SENTINEL_CLIENT_ID")
    or ""
)
COPERNICUS_CLIENT_SECRET = (
    os.getenv("COPERNICUS_CLIENT_SECRET")
    or os.getenv("SENTINEL_CLIENT_SECRET")
    or ""
)
COPERNICUS_TOKEN_URL = (
    os.getenv("COPERNICUS_TOKEN_URL")
    or os.getenv("SENTINEL_TOKEN_URL")
    or DEFAULT_COPERNICUS_TOKEN_URL
)

auth_manager = CopernicusAuthManager(
    COPERNICUS_CLIENT_ID,
    COPERNICUS_CLIENT_SECRET,
    token_url=COPERNICUS_TOKEN_URL,
)
catalog_client = CatalogSearchClient(auth_manager)
process_client = ProcessAPIClient(auth_manager)
risk_engine = RiskEngine()
flow_model = FlowModel()

# In-memory store for citizen reports (use DB in production)
citizen_reports_db: Dict[str, list] = {s.value["id"]: [] for s in RiverStation}

SENTINEL_HUB_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "version": "0.1.0-mvp",
    }), 200


@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    """Check Copernicus OAuth configuration and token validity."""
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        return jsonify({
            "configured": False,
            "authenticated": False,
            "status": "not_configured",
            "message": "Copernicus credentials are not configured.",
            "tokenExpiresAt": None,
        }), 200

    try:
        token = auth_manager.getCopernicusAccessToken()
        return jsonify({
            "configured": True,
            "authenticated": bool(token),
            "status": "auth_ok",
            "message": "Copernicus OAuth authentication successful.",
            "tokenExpiresAt": auth_manager.get_token_expiry_iso(),
        }), 200
    except CopernicusAuthError as e:
        message = e.message
        if e.code == "invalid_client":
            message = "Copernicus auth failed: invalid_client. Check CLIENT_ID and CLIENT_SECRET in .env."
        return jsonify({
            "configured": True,
            "authenticated": False,
            "status": "auth_failed",
            "message": message,
            "tokenExpiresAt": None,
            "errorCode": e.code,
        }), 200
    except Exception as e:
        return jsonify({
            "configured": True,
            "authenticated": False,
            "status": "auth_failed",
            "message": str(e),
            "tokenExpiresAt": None,
            "errorCode": "unknown_error",
        }), 200


@app.route("/api/stations", methods=["GET"])
def list_stations():
    """List available river stations for MVP."""
    stations = []
    for station in RiverStation:
        config = station.value
        stations.append({
            "id": config["id"],
            "name": config["name"],
            "river": config["river"],
            "segment": config["segment"],
            "bbox": config["bbox"],
        })
    return jsonify({"stations": stations}), 200


@app.route("/api/copernicus/collections", methods=["GET"])
def copernicus_collections():
    """Supported Copernicus-ready data layers for WaterWatch."""
    return jsonify({
        "collections": [
            {
                "id": "SENTINEL1_GRD",
                "name": "Sentinel-1 GRD",
                "type": "radar",
                "useInWaterWatch": "Cloud-independent radar surface change indicator",
            },
            {
                "id": "SENTINEL2_L1C",
                "name": "Sentinel-2 L1C",
                "type": "optical",
                "useInWaterWatch": "Top-of-atmosphere optical imagery",
            },
            {
                "id": "SENTINEL2_L2A",
                "name": "Sentinel-2 L2A",
                "type": "optical",
                "useInWaterWatch": "Surface reflectance imagery for water color/turbidity-style indicators",
            },
            {
                "id": "SENTINEL3_OLCI",
                "name": "Sentinel-3 OLCI",
                "type": "ocean_land_color",
                "useInWaterWatch": "Large water-body color and quality monitoring support",
            },
            {
                "id": "CLMS_WATER_BODIES",
                "name": "CLMS Water Bodies",
                "type": "water_body_product",
                "useInWaterWatch": "Water body extent and lake/water monitoring context",
            },
            {
                "id": "CLMS_LAKE_WATER_QUALITY",
                "name": "CLMS Lake Water Quality",
                "type": "water_quality_product",
                "useInWaterWatch": "Lake water quality context where available",
            },
        ],
        "disclaimer": "Supported Copernicus data layers are used as risk signal context, not final proof.",
    }), 200


def _run_sentinel_process(collection_type: str, bbox: list, time_from: str, time_to: str, evalscript: str):
    token = auth_manager.getCopernicusAccessToken()
    body = {
        "input": {
            "bounds": {"bbox": bbox},
            "data": [{"type": collection_type, "dataFilter": {"timeRange": {"from": time_from, "to": time_to}}}],
        },
        "output": {"width": 128, "height": 128, "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
        "evalscript": evalscript,
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    response = requests.post(SENTINEL_HUB_PROCESS_URL, json=body, headers=headers, timeout=30)
    response.raise_for_status()
    return {
        "source": "Copernicus Sentinel Hub",
        "collection": collection_type,
        "message": "Copernicus satellite signal retrieved.",
        "satelliteRiskIndicator": "Satellite-derived risk indicator",
        "requiresLocalConfirmation": True,
        "disclaimer": "Satellite signal is not final proof of pollution.",
    }


@app.route("/api/copernicus/process/sentinel2", methods=["POST"])
def copernicus_process_sentinel2():
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        return jsonify({
            "error": "Copernicus credentials not configured.",
            "status": "auth_failed",
        }), 503
    try:
        payload = request.get_json() or {}
        bbox = payload.get("bbox")
        time_from = payload.get("timeFrom")
        time_to = payload.get("timeTo")
        evalscript = payload.get("evalscript")
        if not bbox or not time_from or not time_to or not evalscript:
            return jsonify({"error": "bbox, timeFrom, timeTo, and evalscript are required"}), 400
        result = _run_sentinel_process("sentinel-2-l2a", bbox, time_from, time_to, evalscript)
        return jsonify(result), 200
    except CopernicusAuthError as e:
        return jsonify({"error": e.message, "status": "auth_failed", "code": e.code}), 503
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Sentinel-2 process request failed: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/copernicus/process/sentinel1", methods=["POST"])
def copernicus_process_sentinel1():
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        return jsonify({
            "error": "Copernicus credentials not configured.",
            "status": "auth_failed",
        }), 503
    try:
        payload = request.get_json() or {}
        bbox = payload.get("bbox")
        time_from = payload.get("timeFrom")
        time_to = payload.get("timeTo")
        evalscript = payload.get("evalscript")
        if not bbox or not time_from or not time_to or not evalscript:
            return jsonify({"error": "bbox, timeFrom, timeTo, and evalscript are required"}), 400
        result = _run_sentinel_process("sentinel-1-grd", bbox, time_from, time_to, evalscript)
        return jsonify(result), 200
    except CopernicusAuthError as e:
        return jsonify({"error": e.message, "status": "auth_failed", "code": e.code}), 503
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Sentinel-1 process request failed: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Catalog Search Endpoints
# ============================================================================

@app.route("/api/catalog/sentinel2/<station_id>", methods=["GET"])
def search_sentinel2(station_id: str):
    """
    Search available Sentinel-2 L2A products for station.
    Query params: days_back (default 7), max_cloud_cover (default 80)
    """
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        return jsonify({
            "error": "Copernicus credentials not configured. Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET."
        }), 503
    
    try:
        # Get station config
        station_config = None
        for s in RiverStation:
            if s.value["id"] == station_id:
                station_config = s.value
                break
        
        if not station_config:
            return jsonify({"error": f"Station {station_id} not found"}), 404
        
        # Parse query params
        days_back = request.args.get("days_back", 7, type=int)
        max_cloud = request.args.get("max_cloud_cover", 80.0, type=float)
        
        # Get date range
        start_date, end_date = get_date_range(days_back)
        
        # Search catalog
        results = catalog_client.search_sentinel2(
            bbox=station_config["bbox"],
            start_date=start_date,
            end_date=end_date,
            max_cloud_cover=max_cloud,
            limit=10,
        )
        
        # Extract product info
        products = []
        for feature in results.get("features", []):
            props = feature.get("properties", {})
            products.append({
                "id": feature.get("id"),
                "datetime": props.get("datetime"),
                "cloud_cover": props.get("eo:cloud_cover"),
                "tile_id": props.get("mgrs_tile"),
            })
        
        return jsonify({
            "station_id": station_id,
            "search_date_range": {"start": start_date, "end": end_date},
            "product_count": len(products),
            "products": products,
        }), 200
    
    except RuntimeError as e:
        logger.error(f"Sentinel-2 search failed (upstream): {e}")
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        logger.error(f"Sentinel-2 search failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/catalog/sentinel1/<station_id>", methods=["GET"])
def search_sentinel1(station_id: str):
    """
    Search available Sentinel-1 GRD products for station.
    Query params: days_back (default 7)
    """
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        return jsonify({
            "error": "Copernicus credentials not configured."
        }), 503
    
    try:
        # Get station config
        station_config = None
        for s in RiverStation:
            if s.value["id"] == station_id:
                station_config = s.value
                break
        
        if not station_config:
            return jsonify({"error": f"Station {station_id} not found"}), 404
        
        days_back = request.args.get("days_back", 7, type=int)
        start_date, end_date = get_date_range(days_back)
        
        # Search catalog
        results = catalog_client.search_sentinel1(
            bbox=station_config["bbox"],
            start_date=start_date,
            end_date=end_date,
            limit=10,
        )
        
        products = []
        for feature in results.get("features", []):
            props = feature.get("properties", {})
            products.append({
                "id": feature.get("id"),
                "datetime": props.get("datetime"),
                "orbit_direction": props.get("sat:orbit_state"),
                "instrument_mode": props.get("sar:instrument_mode"),
            })
        
        return jsonify({
            "station_id": station_id,
            "search_date_range": {"start": start_date, "end": end_date},
            "product_count": len(products),
            "products": products,
        }), 200
    
    except RuntimeError as e:
        logger.error(f"Sentinel-1 search failed (upstream): {e}")
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        logger.error(f"Sentinel-1 search failed: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Alert Generation Endpoint (Core Logic)
# ============================================================================

@app.route("/api/alerts/station/<station_id>", methods=["POST"])
def generate_alert(station_id: str):
    """
    Generate water anomaly alert for station using satellite data fusion.
    
    Request body (optional):
    {
        "use_process_api": true,  # Request on-demand processing
        "date": "2024-01-15",     # Specific date
        "days_back": 7            # Or search recent data
    }
    
    Returns:
        WaterWatchAlert JSON with satellite risk signal, citizen reports, movement model.
    """
    if not COPERNICUS_CLIENT_ID:
        return jsonify({
            "error": "Copernicus credentials not configured."
        }), 503
    
    try:
        # Get station config
        station_config = None
        station_name = None
        for s in RiverStation:
            if s.value["id"] == station_id:
                station_config = s.value
                station_name = s.value["name"]
                break
        
        if not station_config:
            return jsonify({"error": f"Station {station_id} not found"}), 404
        
        # Parse request
        req_data = request.get_json() or {}
        use_process_api = req_data.get("use_process_api", True)
        specific_date = req_data.get("date", datetime.utcnow().strftime("%Y-%m-%d"))
        days_back = req_data.get("days_back", 3)
        
        logger.info(f"Generating alert for {station_id}, date={specific_date}")
        
        # Search available products
        start_date, end_date = get_date_range(days_back)
        s2_results = catalog_client.search_sentinel2(
            bbox=station_config["bbox"],
            start_date=start_date,
            end_date=end_date,
            max_cloud_cover=80,
            limit=5,
        )
        
        s1_results = catalog_client.search_sentinel1(
            bbox=station_config["bbox"],
            start_date=start_date,
            end_date=end_date,
            limit=5,
        )
        
        # Simulate satellite data (demo mode)
        # In production: use process API to get actual raster data
        ndwi_signal = None
        sar_signal = None
        
        if len(s2_results.get("features", [])) > 0:
            # Simulate NDWI analysis
            np.random.seed(hash(station_id) % 2**32)
            ndwi_values = np.random.normal(
                station_config["baseline_ndvi"]["mean"],
                station_config["baseline_ndvi"]["std"],
                (512, 512)
            )
            ndwi_signal = risk_engine.analyze_ndwi(ndwi_values, station_id)
        
        if len(s1_results.get("features", [])) > 0:
            # Simulate SAR VV analysis
            np.random.seed((hash(station_id) + 1) % 2**32)
            vv_values = np.random.normal(
                station_config["baseline_vv"]["mean"],
                station_config["baseline_vv"]["std"],
                (512, 512)
            )
            sar_signal = risk_engine.analyze_sar_backscatter(vv_values, station_id)
        
        # Fuse signals
        fused_signal = risk_engine.fuse_signals(ndwi_signal, sar_signal, station_id)
        
        # Classify alert type
        citizen_reports = citizen_reports_db.get(station_id, [])
        confirmed_reports = sum(1 for r in citizen_reports if r.get("confirmed"))
        alert_type = risk_engine.classify_alert_type(
            fused_signal,
            citizen_report_count=len(citizen_reports),
            historical_events=0,  # Would query DB
        )
        
        # Generate message
        message = risk_engine.generate_message(fused_signal, alert_type, station_name)
        
        # Estimate downstream movement
        downstream_targets = flow_model.get_actionable_targets(station_id, hours_ahead=24)
        movement_model = None
        if downstream_targets:
            first_target = downstream_targets[0]
            from models import MovementModel
            movement_model = MovementModel(
                origin_station_id=station_id,
                target_location=first_target["target_id"],
                distance_meters=first_target["distance_meters"],
                flow_speed_mps=station_config.get("flow_speed_mps", 1.0),
                estimated_arrival_minutes=first_target["arrival_minutes"],
                confidence=first_target["confidence"],
            )
        
        # Build alert
        alert = WaterWatchAlert(
            alert_id=generate_alert_id(),
            station_id=station_id,
            area=station_config["river"],
            target_location=station_config["segment"],
            alert_type=alert_type,
            message=message,
            satellite_signal={
                "source": fused_signal.source,
                "indicator": fused_signal.indicator_type,
                "current_value": fused_signal.current_value,
                "sigma": fused_signal.sigma,
                "confidence": fused_signal.confidence,
                "anomaly_detected": fused_signal.anomaly_detected,
                "timestamp": fused_signal.timestamp,
            },
            citizen_reports=citizen_reports[:5],  # Last 5 reports
            movement_model=movement_model,
            confidence=fused_signal.confidence,
            recommended_action=_get_recommended_action(alert_type),
            timestamp_utc=datetime.utcnow().isoformat() + "Z",
            expires_at=(datetime.utcnow() + timedelta(hours=6)).isoformat() + "Z",
        )
        
        return jsonify(alert.to_dict()), 200
    
    except Exception as e:
        logger.error(f"Alert generation failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Citizen Reporting Endpoints
# ============================================================================

@app.route("/api/reports/submit", methods=["POST"])
def submit_citizen_report():
    """
    Submit citizen observation (photo/voice description/location).
    
    Request body:
    {
        "station_id": "vardar_vs",
        "latitude": 41.97,
        "longitude": 21.55,
        "observation_type": "photo",  # "photo", "voice", "description"
        "message": "Unusual discoloration observed",
        "confirmed": false
    }
    """
    try:
        req_data = request.get_json()
        
        station_id = req_data.get("station_id")
        if not station_id:
            return jsonify({"error": "station_id required"}), 400
        
        if station_id not in citizen_reports_db:
            return jsonify({"error": f"Unknown station {station_id}"}), 404
        
        # Create report
        report = CitizenReport(
            id=f"report_{generate_alert_id()}",
            station_id=station_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            location={
                "lat": req_data.get("latitude", 0.0),
                "lon": req_data.get("longitude", 0.0),
            },
            observation_type=req_data.get("observation_type", "description"),
            message=req_data.get("message", ""),
            confirmed=req_data.get("confirmed", False),
        )
        
        # Store
        citizen_reports_db[station_id].append(report.to_dict())
        
        logger.info(f"Citizen report submitted for {station_id}: {report.id}")
        
        return jsonify({
            "report_id": report.id,
            "status": "submitted",
            "timestamp": report.timestamp,
        }), 201
    
    except Exception as e:
        logger.error(f"Report submission failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/reports/station/<station_id>", methods=["GET"])
def get_station_reports(station_id: str):
    """Get all citizen reports for a station."""
    if station_id not in citizen_reports_db:
        return jsonify({"error": f"Unknown station {station_id}"}), 404
    
    reports = citizen_reports_db[station_id]
    confirmed = sum(1 for r in reports if r.get("confirmed"))
    
    return jsonify({
        "station_id": station_id,
        "report_count": len(reports),
        "confirmed_count": confirmed,
        "reports": reports[-20:],  # Last 20 reports
    }), 200


# ============================================================================
# Helper Functions
# ============================================================================

def _get_recommended_action(alert_type: AlertType) -> str:
    """Get actionable recommendations based on alert severity."""
    if alert_type == AlertType.CRITICAL:
        return (
            "IMMEDIATE ACTION: "
            "1) Verify with on-site observation or additional sensor data. "
            "2) Notify downstream water users and authorities. "
            "3) Increase monitoring frequency. "
            "4) Prepare contingency response."
        )
    elif alert_type == AlertType.WARNING:
        return (
            "MONITOR: "
            "1) Increase satellite monitoring frequency. "
            "2) Coordinate with ground sensors and citizen observers. "
            "3) Prepare rapid response protocols. "
            "4) Document baseline conditions for comparison."
        )
    elif alert_type == AlertType.DATA_SPARSE:
        return (
            "DATA LIMITED: "
            "1) Wait for next satellite pass (6-12 hours). "
            "2) Use alternative sensors (UAV, ground stations) if available. "
            "3) Rely on citizen reports for early observations."
        )
    else:
        return "Continue routine monitoring. No unusual satellite signals detected."


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def server_error(error):
    return jsonify({"error": "Internal server error"}), 500


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    logger.info("Starting WaterWatch Backend API...")
    logger.info(f"Copernicus Client ID configured: {bool(COPERNICUS_CLIENT_ID)}")
    
    # Development server
    app.run(host="0.0.0.0", port=5001, debug=True)
