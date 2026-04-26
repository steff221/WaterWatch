"""
Copernicus Data Space Sentinel Hub API integration.
Handles OAuth2 authentication and data retrieval from Catalog & Process APIs.
"""

import json
import logging
import time
from typing import Dict, Any, Optional, List, Tuple
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CopernicusAuthError(Exception):
    """Structured OAuth error for clearer API diagnostics."""

    def __init__(self, code: str, message: str, status_code: Optional[int] = None, details: Optional[str] = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "code": self.code,
            "message": self.message,
        }
        if self.status_code is not None:
            payload["status_code"] = self.status_code
        if self.details:
            payload["details"] = self.details
        return payload


class CopernicusAuthManager:
    """OAuth2 client_credentials flow for Copernicus Data Space."""
    
    def __init__(self, client_id: str, client_secret: str, token_url: Optional[str] = None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url or "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
        self.access_token = None
        self.token_expires_at = None

    def get_token_expiry_iso(self) -> Optional[str]:
        """Return cached token expiry as ISO timestamp (UTC) when available."""
        if not self.token_expires_at:
            return None
        return datetime.utcfromtimestamp(self.token_expires_at).isoformat() + "Z"

    def getCopernicusAccessToken(self) -> str:
        """Return cached token or fetch a new one using OAuth2 client_credentials flow."""
        if self.access_token and self.token_expires_at and time.time() < self.token_expires_at:
            return self.access_token

        if not self.client_id or not self.client_secret:
            raise CopernicusAuthError(
                code="missing_credentials",
                message="Copernicus auth failed: missing_credentials. Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in .env.",
            )

        logger.info("Requesting new OAuth2 token from Copernicus...")

        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        try:
            response = requests.post(self.token_url, data=payload, headers=headers, timeout=15)
            if response.status_code >= 400:
                response_text = (response.text or "")[:600]
                code = "unknown_error"
                oauth_error = None
                try:
                    error_payload = response.json()
                    oauth_error = error_payload.get("error")
                except ValueError:
                    oauth_error = None

                error_haystack = f"{oauth_error or ''} {response_text}".lower()
                if "invalid_client" in error_haystack:
                    code = "invalid_client"
                elif "invalid_grant" in error_haystack:
                    code = "invalid_grant"

                if code == "invalid_client":
                    message = "Copernicus auth failed: invalid_client. Check CLIENT_ID and CLIENT_SECRET in .env."
                elif code == "invalid_grant":
                    message = "Copernicus auth failed: invalid_grant. Verify OAuth app configuration and scope."
                else:
                    message = f"Copernicus auth failed: {code}."

                raise CopernicusAuthError(
                    code=code,
                    message=message,
                    status_code=response.status_code,
                    details=response_text,
                )

            token_data = response.json()
            token = token_data.get("access_token")
            expires_in = int(token_data.get("expires_in", 3600))

            if not token:
                raise CopernicusAuthError(
                    code="unknown_error",
                    message="Copernicus auth failed: token missing in OAuth response.",
                )

            # Safety buffer: refresh 60 seconds before token expiry.
            self.access_token = token
            self.token_expires_at = time.time() + max(0, expires_in - 60)

            logger.info(f"OAuth2 token obtained, expires in {expires_in}s")
            return self.access_token

        except CopernicusAuthError:
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"OAuth2 token request failed: {e}")
            raise CopernicusAuthError(
                code="network_error",
                message="Copernicus auth failed: network_error. Could not reach token endpoint.",
                details=str(e),
            )
        except Exception as e:
            logger.error(f"OAuth2 token request failed with unknown error: {e}")
            raise CopernicusAuthError(
                code="unknown_error",
                message="Copernicus auth failed: unknown_error.",
                details=str(e),
            )

    def get_token(self) -> str:
        """Backward-compatible alias for token retrieval."""
        return self.getCopernicusAccessToken()
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers with bearer token."""
        token = self.getCopernicusAccessToken()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }


class CatalogSearchClient:
    """Sentinel Hub Catalog API v1.0.0 client."""
    
    def __init__(self, auth_manager: CopernicusAuthManager):
        self.auth_manager = auth_manager
        self.catalog_url = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search"
    
    def search_sentinel2(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float = 80.0,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """
        Search for Sentinel-2 L2A products.
        
        Args:
            bbox: [min_lon, min_lat, max_lon, max_lat]
            start_date: ISO 8601 date string
            end_date: ISO 8601 date string
            max_cloud_cover: Maximum cloud coverage %
            limit: Max results
            
        Returns:
            Catalog search results with features. Includes "demo": true when in DEMO_MODE.
        """
        # Check DEMO_MODE first
        if get_demo_mode():
            return generate_demo_sentinel2_results(bbox, start_date, end_date)
        
        logger.info(f"Searching Sentinel-2 L2A for bbox={bbox}, dates={start_date} to {end_date}")
        
        query = {
            "bbox": bbox,
            "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
            "collections": ["sentinel-2-l2a"],
            "query": {
                "eo:cloud_cover": {
                    "lte": max_cloud_cover,
                }
            },
            "limit": limit,
        }
        
        try:
            headers = self.auth_manager.get_headers()
            response = requests.post(
                self.catalog_url,
                json=query,
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            results = response.json()
            
            logger.info(f"Found {len(results.get('features', []))} Sentinel-2 products")
            return results
        
        except requests.exceptions.RequestException as e:
            response_text = ""
            response_status = "unknown"
            if hasattr(e, "response") and e.response is not None:
                response_status = e.response.status_code
                response_text = (e.response.text or "")[:500]
            logger.error(f"Catalog search failed: {e}")
            raise RuntimeError(
                f"Sentinel-2 catalog request failed (status={response_status}). Response: {response_text}"
            )
    
    def search_sentinel1(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        orbit_direction: Optional[str] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """
        Search for Sentinel-1 GRD products.
        
        Args:
            bbox: [min_lon, min_lat, max_lon, max_lat]
            start_date: ISO 8601 date string
            end_date: ISO 8601 date string
            orbit_direction: "ASCENDING" or "DESCENDING" (optional)
            limit: Max results
            
        Returns:
            Catalog search results. Includes "demo": true when in DEMO_MODE.
        """
        # Check DEMO_MODE first
        if get_demo_mode():
            return generate_demo_sentinel1_results(bbox, start_date, end_date)
        
        logger.info(f"Searching Sentinel-1 GRD for bbox={bbox}, dates={start_date} to {end_date}")
        
        query = {
            "bbox": bbox,
            "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
            "collections": ["sentinel-1-grd"],
            "limit": limit,
        }
        
        if orbit_direction:
            query["filter"] = f"sat:orbit_state = '{orbit_direction}'"
        
        try:
            headers = self.auth_manager.get_headers()
            response = requests.post(
                self.catalog_url,
                json=query,
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            results = response.json()
            
            logger.info(f"Found {len(results.get('features', []))} Sentinel-1 products")
            return results
        
        except requests.exceptions.RequestException as e:
            response_text = ""
            response_status = "unknown"
            if hasattr(e, "response") and e.response is not None:
                response_status = e.response.status_code
                response_text = (e.response.text or "")[:500]
            logger.error(f"Catalog search failed: {e}")
            raise RuntimeError(
                f"Sentinel-1 catalog request failed (status={response_status}). Response: {response_text}"
            )


class ProcessAPIClient:
    """Sentinel Hub Process API v1 client for on-demand processing."""
    
    def __init__(self, auth_manager: CopernicusAuthManager):
        self.auth_manager = auth_manager
        self.process_url = "https://sh.dataspace.copernicus.eu/api/v1/process"
    
    def request_ndwi_layer(
        self,
        bbox: List[float],
        date: str,
        width: int = 512,
        height: int = 512,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[bytes]]:
        """
        Request NDWI (Normalized Difference Water Index) from Sentinel-2 L2A.
        NDWI = (NIR - SWIR) / (NIR + SWIR)
        Values > 0.4 indicate water; > 0.7 possible anomaly.
        
        Returns simulated data with "demo": true when in DEMO_MODE.
        """
        # Check DEMO_MODE first
        if get_demo_mode():
            return generate_demo_ndwi_data(width, height)
        
        logger.info(f"Requesting NDWI for bbox={bbox}, date={date}")
        
        # Sentinel Hub evalscript for NDWI calculation
        evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B8A", "B11"],
      units: "reflectance"
    }],
    output: {
      bands: 1,
      sampleType: "FLOAT32"
    }
  };
}

function evaluatePixel(sample) {
  // NDWI = (B8A - B11) / (B8A + B11)
  // B8A: NIR (865nm), B11: SWIR (1610nm)
  let ndwi = (sample.B8A - sample.B11) / (sample.B8A + sample.B11);
  return [ndwi];
}
"""
        
        request_body = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {
                                "from": f"{date}T00:00:00Z",
                                "to": f"{date}T23:59:59Z",
                            },
                            "maxCloudCoverage": 50,
                            "mosaickingOrder": "mostRecent",
                        }
                    }
                ]
            },
            "evalscript": evalscript,
            "output": {
                "width": width,
                "height": height,
                "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]
            }
        }
        
        try:
            headers = self.auth_manager.get_headers()
            response = requests.post(
                self.process_url,
                json=request_body,
                headers=headers,
                timeout=30,
            )
            response.raise_for_status()
            
            # API returns image data as bytes
            image_data = response.content
            
            # Parse metadata from response headers if available
            metadata = {
                "status_code": response.status_code,
                "content_type": response.headers.get("Content-Type"),
                "size_bytes": len(image_data),
            }
            
            logger.info(f"NDWI layer received: {len(image_data)} bytes")
            return metadata, image_data
        
        except requests.exceptions.RequestException as e:
            logger.error(f"NDWI request failed: {e}")
            return None, None
    
    def request_sar_vv_layer(
        self,
        bbox: List[float],
        date: str,
        width: int = 512,
        height: int = 512,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[bytes]]:
        """
        Request VV backscatter from Sentinel-1 GRD with orthorectification.
        Uses GAMMA0_TERRAIN normalization for water detection fallback.
        
        Returns simulated data with "demo": true when in DEMO_MODE.
        """
        # Check DEMO_MODE first
        if get_demo_mode():
            return generate_demo_sar_data(width, height)
        
        logger.info(f"Requesting SAR VV layer for bbox={bbox}, date={date}")
        
        evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["VV"],
      units: "DB"
    }],
    output: {
      bands: 1,
      sampleType: "FLOAT32"
    }
  };
}

function evaluatePixel(sample) {
  // Return VV backscatter in dB
  return [sample.VV];
}
"""
        
        request_body = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                },
                "data": [
                    {
                        "type": "sentinel-1-grd",
                        "dataFilter": {
                            "timeRange": {
                                "from": f"{date}T00:00:00Z",
                                "to": f"{date}T23:59:59Z",
                            },
                            "resolution": "HIGH",
                        },
                        "processing": {
                            "orthorectify": True,
                            "backCoeff": "GAMMA0_TERRAIN",
                            "demInstance": "COPERNICUS_30"
                        }
                    }
                ]
            },
            "evalscript": evalscript,
            "output": {
                "width": width,
                "height": height,
                "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]
            }
        }
        
        try:
            headers = self.auth_manager.get_headers()
            response = requests.post(
                self.process_url,
                json=request_body,
                headers=headers,
                timeout=30,
            )
            response.raise_for_status()
            
            image_data = response.content
            
            metadata = {
                "status_code": response.status_code,
                "content_type": response.headers.get("Content-Type"),
                "size_bytes": len(image_data),
            }
            
            logger.info(f"SAR VV layer received: {len(image_data)} bytes")
            return metadata, image_data
        
        except requests.exceptions.RequestException as e:
            logger.error(f"SAR request failed: {e}")
            return None, None


def get_date_range(days_back: int = 7) -> Tuple[str, str]:
    """Get ISO 8601 date range for last N days."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days_back)
    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


# ============================================================================
# DEMO MODE: Simulated Data for Development & Testing
# ============================================================================

def get_demo_mode() -> bool:
    """Check if DEMO_MODE is enabled. Default: True (no credentials needed)."""
    import os
    demo_env = os.getenv("DEMO_MODE", "true").lower()
    return demo_env in ("true", "1", "yes")


def generate_demo_sentinel2_results(bbox: List[float], start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Generate simulated Sentinel-2 catalog search results for demo mode.
    Returns clearly labeled demo data with "demo": true.
    """
    logger.info(f"[DEMO MODE] Generating simulated Sentinel-2 results for bbox={bbox}")
    
    # Create demo feature
    today = datetime.utcnow().strftime("%Y-%m-%d")
    demo_feature = {
        "type": "Feature",
        "properties": {
            "id": f"S2A_MSIL2A_20260410T094011_N0510_R037_T34SGA_20260410T105341",
            "datetime": f"{today}T09:40:11Z",
            "platform": "sentinel-2a",
            "instruments": ["msi"],
            "constellation": "sentinel-2",
            "mission": "Copernicus Sentinel-2",
            "eo:cloud_cover": 15.2,
            "s2:mgrs_tile": "34SGA",
            "s2:datatake_id": "GS2A_20260410T094011_039624_N05.10",
            "s2:product_type": "L2A",
            "s2:processing_baseline": "05.10",
            "s2:granule_id": "S2A_OPER_MSI_L2A_TL_VGS4_20260410T105341_A039624_T34SGA_N05.10",
            "demo": True,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [bbox[0], bbox[1]],
                [bbox[2], bbox[1]],
                [bbox[2], bbox[3]],
                [bbox[0], bbox[3]],
                [bbox[0], bbox[1]]
            ]]
        },
        "links": [
            {
                "rel": "self",
                "href": "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/collections/sentinel-2-l2a/items/S2A_MSIL2A_20260410T094011_N0510_R037_T34SGA_20260410T105341"
            }
        ],
        "assets": {
            "thumbnail": {"href": "https://example.com/demo-thumbnail.png"},
            "visual": {"href": "https://example.com/demo-visual.tif"},
            "B8A": {"href": "https://example.com/demo-B8A.tif"},  # NIR
            "B11": {"href": "https://example.com/demo-B11.tif"},  # SWIR
        }
    }
    
    return {
        "type": "FeatureCollection",
        "features": [demo_feature],
        "context": {
            "returned": 1,
            "limit": 10,
            "matched": 1,
        },
        "demo": True,
    }


def generate_demo_sentinel1_results(bbox: List[float], start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Generate simulated Sentinel-1 catalog search results for demo mode.
    """
    logger.info(f"[DEMO MODE] Generating simulated Sentinel-1 results for bbox={bbox}")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    demo_feature = {
        "type": "Feature",
        "properties": {
            "id": f"S1A_IW_GRDH_1SDV_20260410T164105_20260410T164134_051621_06539E_EC1A",
            "datetime": f"{today}T16:41:05Z",
            "platform": "sentinel-1a",
            "instruments": ["c-sar"],
            "constellation": "sentinel-1",
            "sat:orbit_state": "ascending",
            "sat:relative_orbit": 37,
            "sar:instrument_mode": "IW",
            "sar:polarizations": ["VV", "VH"],
            "sar:product_type": "GRD",
            "demo": True,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [bbox[0], bbox[1]],
                [bbox[2], bbox[1]],
                [bbox[2], bbox[3]],
                [bbox[0], bbox[3]],
                [bbox[0], bbox[1]]
            ]]
        },
        "links": [
            {
                "rel": "self",
                "href": "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/collections/sentinel-1-grd/items/S1A_IW_GRDH_1SDV_20260410T164105_20260410T164134_051621_06539E_EC1A"
            }
        ],
        "assets": {
            "thumbnail": {"href": "https://example.com/demo-s1-thumbnail.png"},
            "VV": {"href": "https://example.com/demo-VV.tif"},
            "VH": {"href": "https://example.com/demo-VH.tif"},
        }
    }
    
    return {
        "type": "FeatureCollection",
        "features": [demo_feature],
        "context": {
            "returned": 1,
            "limit": 10,
            "matched": 1,
        },
        "demo": True,
    }


def generate_demo_ndwi_data(width: int = 512, height: int = 512) -> Tuple[Dict[str, Any], bytes]:
    """
    Generate simulated NDWI layer data for demo mode.
    Returns metadata and synthetic TIFF bytes.
    """
    logger.info(f"[DEMO MODE] Generating simulated NDWI layer ({width}x{height})")
    
    # Create synthetic NDWI array (realistic values: 0.3-0.6 for water)
    ndwi_array = np.random.uniform(0.35, 0.55, (height, width)).astype(np.float32)
    
    # Add some realistic variation
    ndwi_array[100:200, 100:200] = np.random.uniform(0.65, 0.75, (100, 100))  # Anomaly area
    
    # Convert to bytes (simplified TIFF-like structure for demo)
    image_bytes = ndwi_array.tobytes()
    
    metadata = {
        "status_code": 200,
        "content_type": "image/tiff",
        "size_bytes": len(image_bytes),
        "demo": True,
    }
    
    return metadata, image_bytes


def generate_demo_sar_data(width: int = 512, height: int = 512) -> Tuple[Dict[str, Any], bytes]:
    """
    Generate simulated SAR VV backscatter data for demo mode.
    Returns metadata and synthetic TIFF bytes.
    """
    logger.info(f"[DEMO MODE] Generating simulated SAR VV layer ({width}x{height})")
    
    # Create synthetic VV backscatter in dB (realistic: -15 to -8 dB over water)
    vv_array = np.random.uniform(-15, -10, (height, width)).astype(np.float32)
    
    # Add some realistic variation
    vv_array[150:250, 150:250] = np.random.uniform(-7, -3, (100, 100))  # Anomaly area
    
    # Convert to bytes
    image_bytes = vv_array.tobytes()
    
    metadata = {
        "status_code": 200,
        "content_type": "image/tiff",
        "size_bytes": len(image_bytes),
        "demo": True,
    }
    
    return metadata, image_bytes
