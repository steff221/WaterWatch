import React from 'react';
import { smallRiverBlindSpots } from '../data/waterwatchCommunityData';

const SmallRiverBlindSpots = () => {
  return (
    <div className="module-wrap">
      <div className="module-title">Small River Blind Spots</div>
      <div className="module-sub">
        Some pollution starts in places satellites cannot see clearly. WaterWatch fills that gap with trusted local evidence.
      </div>
      <div className="module-grid">
        {smallRiverBlindSpots.map((item) => (
          <div key={item.id} className="module-card">
            <div className="module-card-title">{item.name}</div>
            <div className="module-line">Municipality: {item.municipality}</div>
            <div className="module-line">River system: {item.riverSystem}</div>
            <div className="module-line">Satellite coverage: {item.satelliteCoverage}</div>
            <div className="module-line">Reason: {item.reason}</div>
            <div className="module-line">Citizen/hiker evidence items: {item.reports}</div>
            <div className="module-line">Evidence: {item.evidenceTypes.join(', ')}</div>
            <div className="module-line">Confidence: {item.confidence}</div>
            <div className="module-line">Status: {item.status}</div>
            <div className="module-line">Recommended action: {item.recommendedAction}</div>
            <div className="module-badges">
              <span className="module-badge">Satellite blind spot</span>
              <span className="module-badge">Citizen evidence active</span>
              <span className="module-badge">Municipality review needed</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SmallRiverBlindSpots;
