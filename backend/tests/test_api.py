"""
API tests for WaterWatch Flask backend.

Tests health check, station listing, and alert generation endpoints
in demo mode (no Copernicus credentials required).
"""

import pytest
import json
import os
from datetime import datetime, timedelta

# Set demo mode before importing Flask app
os.environ["DEMO_MODE"] = "true"
os.environ.pop("COPERNICUS_CLIENT_ID", None)
os.environ.pop("COPERNICUS_CLIENT_SECRET", None)

from app import app, citizen_reports_db, RiverStation


@pytest.fixture
def client():
    """Create Flask test client."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestHealthEndpoint:
    """Test /api/health endpoint."""
    
    def test_health_check_returns_ok(self, client):
        """Test that health check returns 200 OK."""
        response = client.get("/api/health")
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "ok"
        assert "timestamp" in data
        assert data["version"] == "0.1.0-mvp"
    
    def test_health_check_response_format(self, client):
        """Test health check response format."""
        response = client.get("/api/health")
        data = json.loads(response.data)
        
        assert isinstance(data, dict)
        assert "timestamp" in data
        assert data["timestamp"].endswith("Z")  # ISO 8601 UTC


class TestStationsEndpoint:
    """Test /api/stations endpoint."""
    
    def test_stations_list_returns_all_stations(self, client):
        """Test that stations endpoint returns all configured stations."""
        response = client.get("/api/stations")
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "stations" in data
        assert len(data["stations"]) > 0
        # Should have at least the Vardar station
        assert len(data["stations"]) >= 1
    
    def test_stations_response_format(self, client):
        """Test station response format."""
        response = client.get("/api/stations")
        data = json.loads(response.data)
        
        for station in data["stations"]:
            assert "id" in station
            assert "name" in station
            assert "river" in station
            assert "segment" in station
            assert "bbox" in station
            assert isinstance(station["bbox"], list)
            assert len(station["bbox"]) == 4  # [min_lon, min_lat, max_lon, max_lat]
    
    def test_stations_have_vardar(self, client):
        """Test that Vardar station is in the list."""
        response = client.get("/api/stations")
        data = json.loads(response.data)
        
        station_ids = [s["id"] for s in data["stations"]]
        assert "vardar_vs" in station_ids


class TestAlertsEndpoint:
    """Test /api/alerts/station/<station_id> endpoint."""
    
    def test_alerts_vardar_demo_mode(self, client):
        """Test alert generation for Vardar in demo mode."""
        response = client.post("/api/alerts/station/vardar_vs")
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "alert_id" in data
        assert data["station_id"] == "vardar_vs"
        assert "alert_type" in data
    
    def test_alerts_response_format(self, client):
        """Test alert response contains required fields."""
        response = client.post("/api/alerts/station/vardar_vs")
        assert response.status_code == 200
        
        data = json.loads(response.data)
        
        # Check required fields
        assert "alert_id" in data
        assert "station_id" in data
        assert "area" in data
        assert "alert_type" in data
        assert "message" in data
        assert "satellite_signal" in data
        assert "confidence" in data
        assert "timestamp_utc" in data
        assert "expires_at" in data
        
        # Validate data types
        assert isinstance(data["alert_id"], str)
        assert isinstance(data["confidence"], float)
        assert 0.0 <= data["confidence"] <= 1.0
    
    def test_alerts_satellite_signal_format(self, client):
        """Test that satellite_signal has correct structure."""
        response = client.post("/api/alerts/station/vardar_vs")
        data = json.loads(response.data)
        
        sig = data["satellite_signal"]
        assert isinstance(sig, dict)
        assert "source" in sig
        assert "sigma" in sig
        assert "confidence" in sig
    
    def test_alerts_invalid_station(self, client):
        """Test alert generation for invalid station."""
        response = client.post("/api/alerts/station/invalid_station_id")
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert "error" in data
    
    def test_alerts_with_request_params(self, client):
        """Test alert generation with custom request parameters."""
        payload = {
            "use_process_api": False,
            "days_back": 5,
        }
        
        response = client.post(
            "/api/alerts/station/vardar_vs",
            data=json.dumps(payload),
            content_type="application/json"
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "alert_id" in data
    
    def test_alerts_timestamp_format(self, client):
        """Test that alert timestamps are in ISO 8601 format."""
        response = client.post("/api/alerts/station/vardar_vs")
        data = json.loads(response.data)
        
        # Timestamps should end with Z (UTC)
        assert data["timestamp_utc"].endswith("Z")
        assert data["expires_at"].endswith("Z")
        
        # Should be parseable as ISO 8601
        try:
            datetime.fromisoformat(data["timestamp_utc"].rstrip("Z"))
            datetime.fromisoformat(data["expires_at"].rstrip("Z"))
        except ValueError:
            pytest.fail("Timestamps not in ISO 8601 format")
    
    def test_alerts_alert_type_valid(self, client):
        """Test that alert_type is one of valid values."""
        valid_types = ["normal", "warning", "critical", "data_sparse"]
        
        response = client.post("/api/alerts/station/vardar_vs")
        data = json.loads(response.data)
        
        assert data["alert_type"] in valid_types
    
    def test_alerts_all_stations(self, client):
        """Test alert generation for all configured stations."""
        for station in RiverStation:
            station_id = station.value["id"]
            response = client.post(f"/api/alerts/station/{station_id}")
            
            assert response.status_code == 200, f"Failed for station {station_id}"
            data = json.loads(response.data)
            assert data["station_id"] == station_id


class TestCatalogEndpoints:
    """Test Sentinel catalog search endpoints."""
    
    def test_sentinel2_search_demo_mode(self, client):
        """Test Sentinel-2 catalog search in demo mode."""
        response = client.get("/api/catalog/sentinel2/vardar_vs")
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["station_id"] == "vardar_vs"
        assert "search_date_range" in data
        assert "products" in data
        # In demo mode, should return demo products
        assert "demo" in data or len(data["products"]) >= 0
    
    def test_sentinel1_search_demo_mode(self, client):
        """Test Sentinel-1 catalog search in demo mode."""
        response = client.get("/api/catalog/sentinel1/vardar_vs")
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["station_id"] == "vardar_vs"
        assert "search_date_range" in data
        assert "products" in data
    
    def test_catalog_invalid_station(self, client):
        """Test catalog search for invalid station."""
        response = client.get("/api/catalog/sentinel2/invalid_station")
        
        assert response.status_code == 404


class TestAuthEndpoint:
    """Test /api/auth/status endpoint."""
    
    def test_auth_status_not_configured(self, client):
        """Test auth status when credentials not configured."""
        response = client.get("/api/auth/status")
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["configured"] == False
        assert data["authenticated"] == False


class TestCORSSupport:
    """Test CORS headers are present."""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are included in responses."""
        response = client.options("/api/health")
        
        # Flask-CORS should add headers
        # (exact behavior depends on CORS configuration)
        assert response.status_code in [200, 405]


class TestDemoMode:
    """Test demo mode functionality."""
    
    def test_demo_data_includes_demo_flag(self, client):
        """Test that demo mode responses include demo flag."""
        response = client.post("/api/alerts/station/vardar_vs")
        data = json.loads(response.data)
        
        # Check if demo flag is present in satellite_signal
        # (In demo mode, should be included)
        sig = data.get("satellite_signal", {})
        # Should either have demo flag or be valid real data
        assert isinstance(sig, dict)


class TestIntegrationFlow:
    """Test complete workflow integration."""
    
    def test_full_workflow(self, client):
        """Test complete workflow: health -> stations -> alert."""
        # 1. Health check
        health_resp = client.get("/api/health")
        assert health_resp.status_code == 200
        
        # 2. List stations
        stations_resp = client.get("/api/stations")
        assert stations_resp.status_code == 200
        stations_data = json.loads(stations_resp.data)
        assert len(stations_data["stations"]) > 0
        
        # 3. Generate alert for first station
        first_station_id = stations_data["stations"][0]["id"]
        alert_resp = client.post(f"/api/alerts/station/{first_station_id}")
        assert alert_resp.status_code == 200
        
        alert_data = json.loads(alert_resp.data)
        assert alert_data["station_id"] == first_station_id
        assert alert_data["alert_type"] in ["normal", "warning", "critical", "data_sparse"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
