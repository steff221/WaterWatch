import React from 'react';

const IntelligenceLayer = () => {
  return (
    <div className="module-wrap">
      <div className="module-title">WaterWatch Intelligence Layer</div>
      <div className="module-sub">
        Copernicus satellite signals, citizen evidence, future pollution forecasting, and municipal response in one public water safety system.
      </div>
      <div className="module-grid">
        <div className="module-card">
          <div className="module-card-title">Copernicus satellite intelligence</div>
          <div className="module-line">Use Sentinel data to monitor large river systems and detect upstream surface anomalies.</div>
        </div>
        <div className="module-card">
          <div className="module-card-title">Citizen evidence</div>
          <div className="module-line">Capture pollution signs satellites may miss, especially in small streams.</div>
        </div>
        <div className="module-card">
          <div className="module-card-title">Future forecast</div>
          <div className="module-line">Estimate where risk travels next and when it may reach people.</div>
        </div>
        <div className="module-card">
          <div className="module-card-title">Municipal action</div>
          <div className="module-line">Turn verified reports into inspections, public alerts, and resolved cases.</div>
        </div>
      </div>
      <div className="module-line emphasis">This is not just monitoring. This is response infrastructure.</div>
      <div className="module-card">
        <div className="module-card-title">Why WaterWatch is different</div>
        <div className="module-line">1. Detects what satellites see — Copernicus helps monitor larger river systems.</div>
        <div className="module-line">2. Detects what satellites miss — hikers and citizens report small streams, shaded areas, and local pollution signs.</div>
        <div className="module-line">3. Predicts what happens next — future risk model estimates ETA and affected areas.</div>
        <div className="module-line">4. Turns signals into action — municipalities open cases, dispatch inspections, and warn the public.</div>
        <div className="module-line emphasis">This is not just monitoring. This is response infrastructure.</div>
      </div>
      <div className="module-card">
        <div className="module-card-title">Why WaterWatch has no direct competition in this demo</div>
        <div className="module-line">WaterWatch combines features that are usually separate.</div>
        <div className="module-line">Traditional pollution reporting: manual reports, slow response, no ETA, no citizen verification, no municipality workflow.</div>
        <div className="module-line">Satellite-only monitoring: broad coverage, misses small streams, limited public action, weak local evidence.</div>
        <div className="module-line">WaterWatch: satellite + citizen + hiker + sensor data, small river blind spot coverage, future ETA prediction, municipality case workflow, public alerts, impact awards.</div>
      </div>
    </div>
  );
};

export default IntelligenceLayer;
