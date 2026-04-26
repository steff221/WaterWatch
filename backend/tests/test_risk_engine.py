"""
Unit tests for WaterWatch risk engine.

Tests z-score sigma calculations, alert type classification,
and NDWI/SAR fusion logic without requiring Copernicus credentials.
"""

import pytest
import numpy as np
from datetime import datetime
from services.risk_engine import RiskEngine
from models import RiverStation, AlertType, RiskSignal


class TestRiskEngine:
    """Test suite for RiskEngine class."""
    
    @pytest.fixture
    def risk_engine(self):
        """Initialize RiskEngine for tests."""
        return RiskEngine()
    
    @pytest.fixture
    def test_station_id(self):
        """Get a test station ID."""
        return "vardar_vs"
    
    # ========================================================================
    # Z-Score Sigma Calculation Tests
    # ========================================================================
    
    def test_ndwi_sigma_calculation_normal(self, risk_engine, test_station_id):
        """Test NDWI z-score sigma calculation with normal (baseline) values."""
        # Create NDWI array with values close to baseline mean
        ndwi_values = np.full((512, 512), 0.35, dtype=np.float32)
        
        signal = risk_engine.analyze_ndwi(ndwi_values, test_station_id)
        
        assert signal.station_id == test_station_id
        assert signal.indicator_type == "ndwi"
        assert signal.source == "sentinel-2-l2a"
        # Sigma should be close to 0 when current value is near baseline
        assert abs(signal.sigma) < 0.5, "Sigma should be near 0 for baseline-like values"
        assert signal.anomaly_detected is False
    
    def test_ndwi_sigma_calculation_anomaly(self, risk_engine, test_station_id):
        """Test NDWI z-score detection of anomalies (high sigma)."""
        # Create NDWI array with elevated values (potential anomaly)
        baseline_mean = 0.35
        baseline_std = 0.12
        anomaly_value = baseline_mean + (2.0 * baseline_std)  # 2 sigmas above mean
        
        ndwi_values = np.full((512, 512), anomaly_value, dtype=np.float32)
        
        signal = risk_engine.analyze_ndwi(ndwi_values, test_station_id)
        
        # sigma should be around 2.0 (with some variation due to filtering)
        assert signal.sigma > 1.5, "Sigma should indicate anomaly"
        assert signal.anomaly_detected is True
    
    def test_ndwi_no_water_pixels(self, risk_engine, test_station_id):
        """Test NDWI handling when no water pixels detected."""
        # Create NDWI array with values indicating no water (< 0.3)
        ndwi_values = np.full((512, 512), 0.2, dtype=np.float32)
        
        signal = risk_engine.analyze_ndwi(ndwi_values, test_station_id)
        
        assert signal.confidence < 0.5, "Confidence should be low with no water pixels"
        assert signal.current_value < 0.0
    
    def test_sar_vv_sigma_calculation_normal(self, risk_engine, test_station_id):
        """Test SAR VV backscatter z-score with normal values."""
        baseline_mean = -11.5
        baseline_std = 2.1
        
        vv_values = np.full((512, 512), baseline_mean, dtype=np.float32)
        
        signal = risk_engine.analyze_sar_backscatter(vv_values, test_station_id)
        
        assert signal.station_id == test_station_id
        assert signal.indicator_type == "vv_backscatter"
        assert signal.source == "sentinel-1-grd"
        assert abs(signal.sigma) < 0.5
        assert signal.anomaly_detected is False
    
    def test_sar_vv_sigma_calculation_water_like(self, risk_engine, test_station_id):
        """Test SAR detection of water-like anomaly (more negative VV)."""
        baseline_mean = -11.5
        baseline_std = 2.1
        # More negative = more water-like in SAR
        anomaly_value = baseline_mean - (2.0 * baseline_std)
        
        vv_values = np.full((512, 512), anomaly_value, dtype=np.float32)
        
        signal = risk_engine.analyze_sar_backscatter(vv_values, test_station_id)
        
        # For SAR, anomaly is detected when sigma < -THRESHOLD
        assert signal.sigma < -1.5, "Sigma should indicate water-like anomaly"
        assert signal.anomaly_detected is True
    
    # ========================================================================
    # Alert Type Classification Tests
    # ========================================================================
    
    def test_alert_classification_normal(self, risk_engine):
        """Test alert classification for normal conditions."""
        ndwi_signal = RiskSignal(
            station_id="vardar_vs",
            indicator_type="ndwi",
            current_value=0.35,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=0.0,
            confidence=0.9,
            anomaly_detected=False,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        alert_type = risk_engine.classify_alert_type(ndwi_signal)
        
        assert alert_type == AlertType.NORMAL
    
    def test_alert_classification_warning(self, risk_engine):
        """Test alert classification for warning level."""
        ndwi_signal = RiskSignal(
            station_id="vardar_vs",
            indicator_type="ndwi",
            current_value=0.50,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=1.25,  # Between 1.0 and 1.5 sigmas
            confidence=0.8,
            anomaly_detected=False,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        alert_type = risk_engine.classify_alert_type(ndwi_signal)
        
        assert alert_type in [AlertType.WARNING, AlertType.NORMAL]
    
    def test_alert_classification_critical(self, risk_engine):
        """Test alert classification for critical level."""
        ndwi_signal = RiskSignal(
            station_id="vardar_vs",
            indicator_type="ndwi",
            current_value=0.65,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=2.5,  # High sigma
            confidence=0.9,
            anomaly_detected=True,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        alert_type = risk_engine.classify_alert_type(ndwi_signal)
        
        assert alert_type == AlertType.CRITICAL
    
    def test_alert_classification_data_sparse(self, risk_engine):
        """Test alert classification when data is sparse."""
        ndwi_signal = RiskSignal(
            station_id="vardar_vs",
            indicator_type="ndwi",
            current_value=0.35,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=0.0,
            confidence=0.2,  # Low confidence
            anomaly_detected=False,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        alert_type = risk_engine.classify_alert_type(ndwi_signal)
        
        assert alert_type == AlertType.DATA_SPARSE
    
    # ========================================================================
    # Signal Fusion Tests (NDWI + SAR)
    # ========================================================================
    
    def test_fusion_ndwi_only(self, risk_engine, test_station_id):
        """Test fusion when only NDWI signal is available and reliable."""
        ndwi_signal = RiskSignal(
            station_id=test_station_id,
            indicator_type="ndwi",
            current_value=0.50,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=1.25,
            confidence=0.85,
            anomaly_detected=True,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        fused = risk_engine.fuse_signals(ndwi_signal, None, test_station_id)
        
        assert fused.source == "sentinel-2-l2a"
        assert fused.sigma == ndwi_signal.sigma, "Fused sigma should equal NDWI sigma"
        assert fused.confidence == ndwi_signal.confidence
    
    def test_fusion_sar_only(self, risk_engine, test_station_id):
        """Test fusion when only SAR signal is available and reliable."""
        sar_signal = RiskSignal(
            station_id=test_station_id,
            indicator_type="vv_backscatter",
            current_value=-14.0,
            baseline_mean=-11.5,
            baseline_std=2.1,
            sigma=-1.19,
            confidence=0.75,
            anomaly_detected=True,
            source="sentinel-1-grd",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        fused = risk_engine.fuse_signals(None, sar_signal, test_station_id)
        
        assert fused.source == "sentinel-1-grd"
        assert fused.sigma == sar_signal.sigma
        assert fused.confidence == sar_signal.confidence
    
    def test_fusion_both_signals(self, risk_engine, test_station_id):
        """Test fusion when both NDWI and SAR signals are available."""
        ndwi_signal = RiskSignal(
            station_id=test_station_id,
            indicator_type="ndwi",
            current_value=0.50,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=1.25,
            confidence=0.85,
            anomaly_detected=True,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        sar_signal = RiskSignal(
            station_id=test_station_id,
            indicator_type="vv_backscatter",
            current_value=-14.0,
            baseline_mean=-11.5,
            baseline_std=2.1,
            sigma=-1.19,
            confidence=0.60,
            anomaly_detected=True,
            source="sentinel-1-grd",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        fused = risk_engine.fuse_signals(ndwi_signal, sar_signal, test_station_id)
        
        assert fused.source == "fused-s2-s1"
        # Fused sigma should be weighted average: 0.65 * 1.25 + 0.35 * (-1.19)
        expected_sigma = 0.65 * 1.25 + 0.35 * (-1.19)
        assert abs(fused.sigma - expected_sigma) < 0.01
        assert fused.confidence > 0.0  # Should be average of both
    
    def test_fusion_no_reliable_data(self, risk_engine, test_station_id):
        """Test fusion when neither signal is reliable."""
        ndwi_signal = RiskSignal(
            station_id=test_station_id,
            indicator_type="ndwi",
            current_value=0.35,
            baseline_mean=0.35,
            baseline_std=0.12,
            sigma=0.0,
            confidence=0.3,  # Low confidence
            anomaly_detected=False,
            source="sentinel-2-l2a",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        sar_signal = RiskSignal(
            station_id=test_station_id,
            indicator_type="vv_backscatter",
            current_value=-11.5,
            baseline_mean=-11.5,
            baseline_std=2.1,
            sigma=0.0,
            confidence=0.2,  # Low confidence
            anomaly_detected=False,
            source="sentinel-1-grd",
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        
        fused = risk_engine.fuse_signals(ndwi_signal, sar_signal, test_station_id)
        
        assert fused.source == "none"
        assert fused.confidence == 0.0
        assert fused.anomaly_detected is False
    
    # ========================================================================
    # Edge Cases and Data Validation
    # ========================================================================
    
    def test_division_by_zero_in_sigma(self, risk_engine, test_station_id):
        """Test that zero std deviation doesn't cause division by zero."""
        # Create signal with zero std (edge case)
        ndwi_values = np.full((512, 512), 0.35, dtype=np.float32)
        
        # This should not raise division by zero error
        signal = risk_engine.analyze_ndwi(ndwi_values, test_station_id)
        
        assert signal is not None
        assert not np.isnan(signal.sigma)
        assert not np.isinf(signal.sigma)
    
    def test_station_config_lookup(self, risk_engine):
        """Test that all valid stations can be looked up."""
        for station in RiverStation:
            station_id = station.value["id"]
            config = risk_engine._get_station_config(station_id)
            assert config is not None
            assert "baseline_ndvi" in config
            assert "baseline_vv" in config
    
    def test_confidence_bounds(self, risk_engine, test_station_id):
        """Test that confidence values stay within [0, 1] bounds."""
        # Test various NDWI scenarios
        for ndwi_mean in [0.2, 0.35, 0.5, 0.7]:
            ndwi_values = np.full((512, 512), ndwi_mean, dtype=np.float32)
            signal = risk_engine.analyze_ndwi(ndwi_values, test_station_id)
            
            assert 0.0 <= signal.confidence <= 1.0, f"Confidence out of bounds for mean={ndwi_mean}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
