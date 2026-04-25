"""
Data models for WaterWatch backend.
Represents river stations, alerts, and satellite data.
"""

from dataclasses import dataclass, asdict
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class AlertType(Enum):
    """Alert severity levels based on risk signals."""
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    DATA_SPARSE = "data_sparse"


class RiverStation(Enum):
    """Pre-configured AOIs for hackathon MVP."""
    VARDAR_VELES_SKOPJE = {
        "id": "vardar_vs",
        "name": "Vardar: Veles to Skopje",
        "bbox": [21.45, 41.92, 21.65, 42.02],  # [min_lon, min_lat, max_lon, max_lat]
        "river": "Vardar",
        "segment": "Veles-Skopje",
        "baseline_ndvi": {"mean": 0.35, "std": 0.12},
        "baseline_vv": {"mean": -11.5, "std": 2.1},
        "flow_speed_mps": 1.2,
    }
    TRESKA_KOZJAK_MATKA = {
        "id": "treska_km",
        "name": "Treska: Kozjak to Matka",
        "bbox": [20.95, 41.92, 21.15, 42.08],
        "river": "Treska",
        "segment": "Kozjak-Matka",
        "baseline_ndvi": {"mean": 0.38, "std": 0.14},
        "baseline_vv": {"mean": -10.8, "std": 2.3},
        "flow_speed_mps": 0.95,
    }
    OHRID_STUDENCISTA = {
        "id": "ohrid_s",
        "name": "Ohrid Lake: Studencista",
        "bbox": [20.78, 41.09, 20.88, 41.19],
        "river": "Ohrid Lake Inflow",
        "segment": "Studencista Spring",
        "baseline_ndvi": {"mean": 0.42, "std": 0.10},
        "baseline_vv": {"mean": -11.2, "std": 1.9},
        "flow_speed_mps": 0.5,
    }
    DANUBE_VIENNA = {
        "id": "danube_vienna",
        "name": "Danube: Vienna Reach",
        "bbox": [16.25, 48.15, 16.55, 48.35],
        "river": "Danube",
        "segment": "Vienna",
        "baseline_ndvi": {"mean": 0.36, "std": 0.11},
        "baseline_vv": {"mean": -12.0, "std": 2.0},
        "flow_speed_mps": 1.6,
    }
    DANUBE_BUDAPEST = {
        "id": "danube_budapest",
        "name": "Danube: Budapest Reach",
        "bbox": [18.95, 47.35, 19.25, 47.65],
        "river": "Danube",
        "segment": "Budapest",
        "baseline_ndvi": {"mean": 0.35, "std": 0.11},
        "baseline_vv": {"mean": -11.9, "std": 2.1},
        "flow_speed_mps": 1.5,
    }
    RHINE_COLOGNE = {
        "id": "rhine_cologne",
        "name": "Rhine: Cologne Reach",
        "bbox": [6.80, 50.85, 7.15, 51.05],
        "river": "Rhine",
        "segment": "Cologne",
        "baseline_ndvi": {"mean": 0.33, "std": 0.10},
        "baseline_vv": {"mean": -10.9, "std": 1.8},
        "flow_speed_mps": 1.4,
    }
    SEINE_PARIS = {
        "id": "seine_paris",
        "name": "Seine: Paris Reach",
        "bbox": [2.20, 48.80, 2.45, 48.95],
        "river": "Seine",
        "segment": "Paris",
        "baseline_ndvi": {"mean": 0.34, "std": 0.10},
        "baseline_vv": {"mean": -10.7, "std": 1.7},
        "flow_speed_mps": 1.2,
    }
    THAMES_LONDON = {
        "id": "thames_london",
        "name": "Thames: London Reach",
        "bbox": [-0.30, 51.45, 0.05, 51.58],
        "river": "Thames",
        "segment": "London",
        "baseline_ndvi": {"mean": 0.32, "std": 0.09},
        "baseline_vv": {"mean": -10.5, "std": 1.6},
        "flow_speed_mps": 1.1,
    }
    ELBE_HAMBURG = {
        "id": "elbe_hamburg",
        "name": "Elbe: Hamburg Reach",
        "bbox": [9.85, 53.45, 10.15, 53.65],
        "river": "Elbe",
        "segment": "Hamburg",
        "baseline_ndvi": {"mean": 0.33, "std": 0.10},
        "baseline_vv": {"mean": -11.0, "std": 1.8},
        "flow_speed_mps": 1.3,
    }
    PO_VENICE = {
        "id": "po_venice",
        "name": "Po: Venice Delta",
        "bbox": [12.15, 44.90, 12.50, 45.15],
        "river": "Po",
        "segment": "Venice Delta",
        "baseline_ndvi": {"mean": 0.39, "std": 0.12},
        "baseline_vv": {"mean": -11.6, "std": 2.0},
        "flow_speed_mps": 1.0,
    }
    EBRO_ZARAGOZA = {
        "id": "ebro_zaragoza",
        "name": "Ebro: Zaragoza Reach",
        "bbox": [-0.98, 41.58, -0.74, 41.74],
        "river": "Ebro",
        "segment": "Zaragoza",
        "baseline_ndvi": {"mean": 0.37, "std": 0.11},
        "baseline_vv": {"mean": -11.3, "std": 1.9},
        "flow_speed_mps": 1.2,
    }
    LOIRE_NANTES = {
        "id": "loire_nantes",
        "name": "Loire: Nantes Reach",
        "bbox": [-1.75, 47.15, -1.35, 47.35],
        "river": "Loire",
        "segment": "Nantes",
        "baseline_ndvi": {"mean": 0.35, "std": 0.10},
        "baseline_vv": {"mean": -10.8, "std": 1.8},
        "flow_speed_mps": 1.1,
    }
    TAGUS_LISBON = {
        "id": "tagus_lisbon",
        "name": "Tagus: Lisbon Estuary",
        "bbox": [-9.25, 38.65, -9.00, 38.80],
        "river": "Tagus",
        "segment": "Lisbon",
        "baseline_ndvi": {"mean": 0.34, "std": 0.10},
        "baseline_vv": {"mean": -11.1, "std": 1.9},
        "flow_speed_mps": 0.9,
    }


@dataclass
class SatelliteData:
    """Satellite observation result."""
    source: str  # "sentinel-2", "sentinel-1"
    timestamp: str  # ISO 8601
    product_id: str
    data: Dict[str, Any]  # Contains NDWI, VV, VH, etc.
    cloud_coverage: Optional[float] = None  # Percentage for S2
    processing_date: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RiskSignal:
    """Calculated risk metric using z-score."""
    station_id: str
    indicator_type: str  # "ndwi", "vv_backscatter", "fused"
    current_value: float
    baseline_mean: float
    baseline_std: float
    sigma: float  # (current - mean) / std
    confidence: float  # 0.0 to 1.0
    anomaly_detected: bool  # |sigma| > 1.5
    source: str  # "sentinel-2", "sentinel-1", "fused"
    timestamp: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CitizenReport:
    """Citizen-submitted observation."""
    id: str
    station_id: str
    timestamp: str
    location: Dict[str, float]  # {"lat": float, "lon": float}
    observation_type: str  # "photo", "voice", "description"
    message: str
    confirmed: bool = False
    upvotes: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MovementModel:
    """Downstream movement prediction."""
    origin_station_id: str
    target_location: str
    distance_meters: float
    flow_speed_mps: float
    estimated_arrival_minutes: float
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WaterWatchAlert:
    """Complete alert output for WaterWatch app."""
    alert_id: str
    station_id: str
    area: str
    target_location: str
    alert_type: AlertType
    message: str
    satellite_signal: Dict[str, Any]  # RiskSignal + source info
    citizen_reports: List[CitizenReport]
    movement_model: Optional[MovementModel]
    confidence: float  # 0.0 to 1.0
    recommended_action: str
    timestamp_utc: str
    expires_at: str  # ISO 8601
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize to JSON-compatible dict."""
        return {
            "alert_id": self.alert_id,
            "station_id": self.station_id,
            "area": self.area,
            "target_location": self.target_location,
            "alert_type": self.alert_type.value,
            "message": self.message,
            "satellite_signal": self.satellite_signal,
            "citizen_reports": [r.to_dict() for r in self.citizen_reports],
            "movement_model": self.movement_model.to_dict() if self.movement_model else None,
            "confidence": self.confidence,
            "recommended_action": self.recommended_action,
            "timestamp_utc": self.timestamp_utc,
            "expires_at": self.expires_at,
        }


def create_station_config(station: RiverStation) -> Dict[str, Any]:
    """Get station configuration."""
    return station.value


def generate_alert_id() -> str:
    """Generate unique alert ID."""
    return f"alert_{uuid.uuid4().hex[:12]}"
