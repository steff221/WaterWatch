import React from 'react';
import { citizenReports, municipalityCases } from '../data/waterwatchCommunityData';

const MunicipalityReview = () => {
  return (
    <div className="module-wrap">
      <div className="module-title">Municipality Review Workbench</div>
      <div className="module-grid three-cols">
        <div className="module-card">
          <div className="module-card-title">Incoming Signals</div>
          {citizenReports.slice(0, 6).map((report) => (
            <div key={report.id} className="module-line">
              {report.id}: {report.river} · {report.reportType} · {report.severity}
            </div>
          ))}
        </div>
        <div className="module-card">
          <div className="module-card-title">Open Cases</div>
          {municipalityCases.map((item) => (
            <div key={item.id} className="module-line">
              {item.id} · {item.status} · {item.priority}
            </div>
          ))}
        </div>
        <div className="module-card">
          <div className="module-card-title">Action Center</div>
          <div className="module-line">Public alert draft ready</div>
          <button className="module-btn">Request more reports nearby</button>
          <button className="module-btn">Dispatch field team</button>
          <button className="module-btn">Send public alert</button>
          <button className="module-btn">Export case JSON</button>
          <button className="module-btn">Mark resolved</button>
        </div>
      </div>
    </div>
  );
};

export default MunicipalityReview;
