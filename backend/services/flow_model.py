"""
Flow modeling for downstream pollutant/anomaly propagation.
Estimates arrival time at downstream monitoring stations.
"""
import numpy as np
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from models import MovementModel, RiverStation, create_station_config

logger = logging.getLogger(__name__)


class FlowModel:
    """
    Estimates downstream movement of water anomalies.
    Uses simple flow speed model (advanced: could use river network, hydraulics).
    """
    
    def __init__(self):
        self.stations = {s.value["id"]: s.value for s in RiverStation}
        self._build_downstream_map()
    
    def _build_downstream_map(self) -> None:
        """Map downstream stations for each origin."""
        self.downstream_map = {
            "vardar_vs": ["skopje_city", "vardar_mouth"],
            "treska_km": ["vardar_vs"],  # Treska flows into Vardar at Veles region
            "ohrid_s": ["ohrid_city"],  # Ohrid Lake inflow
            "danube_vienna": ["danube_budapest"],
            "danube_budapest": ["danube_iron_gates"],
            "rhine_cologne": ["rhine_rotterdam"],
            "seine_paris": ["seine_honfleur"],
            "thames_london": ["thames_estuary"],
            "elbe_hamburg": ["elbe_estuary"],
            "po_venice": ["adriatic_outflow"],
            "ebro_zaragoza": ["ebro_delta"],
            "loire_nantes": ["atlantic_outflow"],
            "tagus_lisbon": ["tagus_estuary"],
        }
    
    def estimate_arrival(
        self,
        origin_station_id: str,
        target_station_id: str,
        distance_meters: float,
    ) -> Optional[MovementModel]:
        """
        Estimate arrival time for anomaly from origin to target.
        
        Args:
            origin_station_id: Starting station
            target_station_id: Destination monitoring point
            distance_meters: River distance in meters
            
        Returns:
            MovementModel with arrival estimate, or None if invalid
        """
        logger.info(f"Estimating arrival: {origin_station_id} -> {target_station_id} ({distance_meters}m)")
        
        # Get flow speed from origin station
        if origin_station_id not in self.stations:
            logger.error(f"Unknown origin station: {origin_station_id}")
            return None
        
        flow_speed_mps = self.stations[origin_station_id].get("flow_speed_mps", 1.0)
        
        # Calculate arrival time
        arrival_minutes = (distance_meters / flow_speed_mps) / 60.0
        
        # Confidence decreases with distance (model uncertainty grows)
        confidence = max(0.3, 1.0 - (distance_meters / 100000.0))  # Decay over 100km
        
        movement = MovementModel(
            origin_station_id=origin_station_id,
            target_location=target_station_id,
            distance_meters=distance_meters,
            flow_speed_mps=flow_speed_mps,
            estimated_arrival_minutes=arrival_minutes,
            confidence=confidence,
        )
        
        logger.info(f"Estimated arrival: {arrival_minutes:.1f} minutes, confidence={confidence:.2f}")
        return movement
    
    def get_downstream_stations(self, origin_station_id: str) -> List[str]:
        """Get all downstream monitoring points."""
        return self.downstream_map.get(origin_station_id, [])
    
    def estimate_travel_time_range(
        self,
        distance_meters: float,
        flow_speed_mps: float,
        flow_uncertainty: float = 0.2,
    ) -> Dict[str, float]:
        """
        Estimate arrival time with uncertainty range.
        
        Args:
            distance_meters: Distance to travel
            flow_speed_mps: Mean flow speed
            flow_uncertainty: Relative uncertainty (0.2 = ±20%)
            
        Returns:
            Dict with min, mean, max arrival times in minutes
        """
        mean_minutes = (distance_meters / flow_speed_mps) / 60.0
        
        # Uncertainty increases with distance
        uncertainty_factor = 1.0 + (flow_uncertainty * (distance_meters / 50000.0))
        
        return {
            "min_minutes": mean_minutes / uncertainty_factor,
            "mean_minutes": mean_minutes,
            "max_minutes": mean_minutes * uncertainty_factor,
        }
    
    def get_actionable_targets(self, origin_station_id: str, hours_ahead: int = 24) -> List[Dict[str, Any]]:
        """
        Get downstream targets that could be affected within time window.
        Useful for alert distribution.
        """
        targets = []
        downstream = self.get_downstream_stations(origin_station_id)
        
        for target_id in downstream:
            # Pre-defined distances (in real system, use GIS)
            distances = {
                ("vardar_vs", "skopje_city"): 15000,
                ("vardar_vs", "vardar_mouth"): 85000,
                ("treska_km", "vardar_vs"): 42000,
                ("ohrid_s", "ohrid_city"): 18000,
                ("danube_vienna", "danube_budapest"): 214000,
                ("danube_budapest", "danube_iron_gates"): 500000,
                ("rhine_cologne", "rhine_rotterdam"): 240000,
                ("seine_paris", "seine_honfleur"): 370000,
                ("thames_london", "thames_estuary"): 80000,
                ("elbe_hamburg", "elbe_estuary"): 115000,
                ("po_venice", "adriatic_outflow"): 120000,
                ("ebro_zaragoza", "ebro_delta"): 260000,
                ("loire_nantes", "atlantic_outflow"): 70000,
                ("tagus_lisbon", "tagus_estuary"): 45000,
            }
            
            key = (origin_station_id, target_id)
            distance = distances.get(key, 30000)  # Default 30km
            
            model = self.estimate_arrival(origin_station_id, target_id, distance)
            
            if model and model.estimated_arrival_minutes <= (hours_ahead * 60):
                targets.append({
                    "target_id": target_id,
                    "distance_meters": distance,
                    "arrival_minutes": model.estimated_arrival_minutes,
                    "arrival_datetime": (
                        datetime.utcnow() + 
                        timedelta(minutes=model.estimated_arrival_minutes)
                    ).isoformat() + "Z",
                    "confidence": model.confidence,
                })
        
        return targets


def calculate_flow_speed_from_satellite(
    sar_coherence: np.ndarray,
    time_delta_days: float,
) -> float:
    """
    Advanced: Estimate flow speed from SAR coherence change.
    (Simplified example - real implementation uses complex SAR analysis)
    
    Args:
        sar_coherence: Coherence change map
        time_delta_days: Time between observations
        
    Returns:
        Estimated flow speed in m/s
    """
    # Simplified placeholder
    return 1.0
