"""
Risk engine for water anomaly detection using satellite data.
Calculates z-scores and fuses Sentinel-2 + Sentinel-1 signals.

Scientific approach:
- NDWI anomaly: satellite-based risk estimation, NOT water quality proof
- SAR fallback: radar reflection anomaly indicator when clouds block optical
- Sigma-based confidence: statistical measure, used for early warning only
"""

import logging
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from models import RiskSignal, AlertType, SatelliteData, RiverStation, create_station_config

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Calculates water anomaly risk signals from satellite observations.
    Uses statistical approach: sigma = (current - baseline_mean) / baseline_std
    """
    
    NDWI_WATER_THRESHOLD = 0.4  # NDWI > 0.4 indicates water
    NDWI_ANOMALY_THRESHOLD = 0.7  # Very high NDWI might indicate flooding
    SIGMA_ANOMALY_THRESHOLD = 1.5  # |sigma| > 1.5 indicates potential anomaly
    
    def __init__(self):
        self.station_configs = {s.name: create_station_config(s) for s in RiverStation}
    
    def analyze_ndwi(
        self,
        ndwi_values: np.ndarray,
        station_id: str,
    ) -> RiskSignal:
        """
        Analyze NDWI layer for water anomalies.
        
        Args:
            ndwi_values: 2D numpy array of NDWI pixels (-1.0 to 1.0)
            station_id: River station ID
            
        Returns:
            RiskSignal with z-score and confidence
        """
        logger.info(f"Analyzing NDWI for station {station_id}")
        
        # Get station baseline
        station_config = self._get_station_config(station_id)
        baseline = station_config["baseline_ndvi"]
        
        # Calculate mean NDWI (focus on water pixels NDWI > 0.3)
        water_pixels = ndwi_values[ndwi_values > 0.3]
        
        if len(water_pixels) == 0:
            # No water detected - unusual situation
            current_ndwi = -0.1
            confidence = 0.3
        else:
            current_ndwi = np.mean(water_pixels)
            confidence = min(1.0, len(water_pixels) / (ndwi_values.size * 0.5))
        
        # Calculate z-score
        sigma = (current_ndwi - baseline["mean"]) / (baseline["std"] + 1e-6)
        
        anomaly_detected = bool(abs(sigma) > self.SIGMA_ANOMALY_THRESHOLD)
        
        risk_signal = RiskSignal(
            station_id=station_id,
            indicator_type="ndwi",
            current_value=current_ndwi,
            baseline_mean=baseline["mean"],
            baseline_std=baseline["std"],
            sigma=sigma,
            confidence=confidence,
            anomaly_detected=anomaly_detected,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        logger.info(f"NDWI analysis: current={current_ndwi:.3f}, sigma={sigma:.2f}, anomaly={anomaly_detected}")
        return risk_signal
    
    def analyze_sar_backscatter(
        self,
        vv_values: np.ndarray,
        station_id: str,
    ) -> RiskSignal:
        """
        Analyze Sentinel-1 VV backscatter for water detection (cloud-independent).
        
        Args:
            vv_values: 2D numpy array of VV backscatter in dB
            station_id: River station ID
            
        Returns:
            RiskSignal based on radar anomaly
        """
        logger.info(f"Analyzing SAR VV backscatter for station {station_id}")
        
        station_config = self._get_station_config(station_id)
        baseline = station_config["baseline_vv"]
        
        # SAR water has lower VV backscatter (dark in SAR imagery)
        current_vv = np.mean(vv_values)
        confidence = 0.6  # SAR is weather-independent but resolution varies
        
        # Calculate z-score
        sigma = (current_vv - baseline["mean"]) / (baseline["std"] + 1e-6)
        
        # For SAR: MORE NEGATIVE = MORE WATER-LIKE (smoother, less backscatter)
        anomaly_detected = bool(sigma < -self.SIGMA_ANOMALY_THRESHOLD)
        
        risk_signal = RiskSignal(
            station_id=station_id,
            indicator_type="vv_backscatter",
            current_value=current_vv,
            baseline_mean=baseline["mean"],
            baseline_std=baseline["std"],
            sigma=sigma,
            confidence=confidence,
            anomaly_detected=anomaly_detected,
            source="sentinel-1-grd",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        logger.info(f"SAR analysis: current_vv={current_vv:.1f} dB, sigma={sigma:.2f}, anomaly={anomaly_detected}")
        return risk_signal
    
    def fuse_signals(
        self,
        ndwi_signal: Optional[RiskSignal],
        sar_signal: Optional[RiskSignal],
        station_id: str,
    ) -> RiskSignal:
        """
        Fuse optical (NDWI) and radar (SAR) signals for robust anomaly detection.
        
        Strategy:
        - If NDWI available and not cloudy: prioritize NDWI
        - If clouds/no NDWI: use SAR fallback
        - Both available: weighted average with quality weights
        """
        logger.info(f"Fusing signals for station {station_id}: NDWI={ndwi_signal is not None}, SAR={sar_signal is not None}")
        
        if ndwi_signal and ndwi_signal.confidence > 0.5:
            # NDWI is reliable
            if sar_signal and sar_signal.confidence > 0.5:
                # Both reliable - weighted average
                ndwi_weight = 0.65
                sar_weight = 0.35
                
                fused_sigma = (
                    ndwi_signal.sigma * ndwi_weight + 
                    sar_signal.sigma * sar_weight
                )
                fused_confidence = min(1.0, (ndwi_signal.confidence + sar_signal.confidence) / 2)
                source = "fused-s2-s1"
            else:
                # NDWI only
                fused_sigma = ndwi_signal.sigma
                fused_confidence = ndwi_signal.confidence
                source = "sentinel-2-l2a"
        
        elif sar_signal and sar_signal.confidence > 0.4:
            # SAR fallback
            fused_sigma = sar_signal.sigma
            fused_confidence = sar_signal.confidence
            source = "sentinel-1-grd"
        
        else:
            # No reliable data
            logger.warning(f"No reliable satellite data for {station_id}")
            return RiskSignal(
                station_id=station_id,
                indicator_type="fused",
                current_value=0.0,
                baseline_mean=0.0,
                baseline_std=1.0,
                sigma=0.0,
                confidence=0.0,
                anomaly_detected=False,
                source="none",
                timestamp=datetime.utcnow().isoformat() + "Z",
            )
        
        anomaly_detected = bool(abs(fused_sigma) > self.SIGMA_ANOMALY_THRESHOLD)
        
        fused_signal = RiskSignal(
            station_id=station_id,
            indicator_type="fused",
            current_value=fused_sigma,  # Store sigma as fused value
            baseline_mean=0.0,
            baseline_std=1.0,
            sigma=fused_sigma,
            confidence=fused_confidence,
            anomaly_detected=anomaly_detected,
            source=source,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        logger.info(f"Fused signal: sigma={fused_sigma:.2f}, confidence={fused_confidence:.2f}, anomaly={anomaly_detected}")
        return fused_signal
    
    def classify_alert_type(
        self,
        fused_signal: RiskSignal,
        citizen_report_count: int = 0,
        historical_events: int = 0,
    ) -> AlertType:
        """
        Classify alert severity based on satellite anomaly + citizen input.
        
        Args:
            fused_signal: Fused risk signal
            citizen_report_count: Number of recent citizen reports
            historical_events: Events in this location in last 30 days
            
        Returns:
            AlertType: NORMAL, WARNING, CRITICAL, DATA_SPARSE
        """
        logger.info(f"Classifying alert for sigma={fused_signal.sigma:.2f}, confidence={fused_signal.confidence:.2f}")
        
        if fused_signal.confidence < 0.4:
            return AlertType.DATA_SPARSE

        if fused_signal.confidence >= 0.8 and abs(fused_signal.sigma) >= 2.0:
            return AlertType.CRITICAL
        
        # Multi-factor scoring
        anomaly_score = abs(fused_signal.sigma) * fused_signal.confidence
        citizen_factor = min(1.0, citizen_report_count / 3.0)
        historical_factor = min(1.0, historical_events / 2.0)
        
        total_score = (anomaly_score * 0.6) + (citizen_factor * 0.25) + (historical_factor * 0.15)
        
        if total_score > 2.0:
            return AlertType.CRITICAL
        elif total_score > 1.0:
            return AlertType.WARNING
        else:
            return AlertType.NORMAL
    
    def generate_message(
        self,
        fused_signal: RiskSignal,
        alert_type: AlertType,
        station_name: str,
    ) -> str:
        """
        Generate responsible scientific message for alert.
        
        Important: Avoid claims about water safety/pollution.
        Use: "satellite-based anomaly", "risk estimation", "early warning"
        """
        if alert_type == AlertType.DATA_SPARSE:
            return f"Insufficient satellite data for {station_name}. Cannot generate reliable early warning at this time."
        
        if alert_type == AlertType.CRITICAL:
            return (
                f"⚠️ CRITICAL ALERT - {station_name}\n"
                f"Satellite-based anomaly detected (confidence: {fused_signal.confidence:.0%}).\n"
                f"Possible pollution risk or environmental change indicated by {fused_signal.source}.\n"
                f"Recommend immediate on-site verification and monitoring.\n"
                f"This is an early warning system - professional assessment required."
            )
        elif alert_type == AlertType.WARNING:
            return (
                f"⚠️ WARNING - {station_name}\n"
                f"Satellite-based risk estimation elevated (confidence: {fused_signal.confidence:.0%}).\n"
                f"Anomaly detected via {fused_signal.source}. Recommend increased monitoring.\n"
                f"Cross-reference with ground observations and citizen reports."
            )
        else:
            return f"✓ {station_name} appears normal based on satellite observation. No anomaly detected."
    
    def _get_station_config(self, station_id: str) -> Dict[str, Any]:
        """Get station configuration by ID."""
        for station in RiverStation:
            if station.value["id"] == station_id:
                return station.value
        
        # Fallback
        logger.warning(f"Station {station_id} not found, using defaults")
        return {
            "baseline_ndvi": {"mean": 0.35, "std": 0.12},
            "baseline_vv": {"mean": -11.5, "std": 2.1},
        }
