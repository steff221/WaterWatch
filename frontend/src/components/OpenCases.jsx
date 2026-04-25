import React, { useMemo, useState } from 'react';
import { municipalityCases, municipalityStatuses } from '../data/waterwatchCommunityData';

function nextStatus(current, target) {
  const currentIndex = municipalityStatuses.indexOf(current);
  const targetIndex = municipalityStatuses.indexOf(target);
  if (targetIndex === -1) return current;
  if (currentIndex === -1) return target;
  return municipalityStatuses[Math.max(currentIndex, targetIndex)];
}

const OpenCases = () => {
  const [cases, setCases] = useState(
    municipalityCases.map((item) => ({
      ...item,
      timeline: [{ time: new Date().toISOString(), event: 'Case created', actor: 'Municipality Officer' }],
    }))
  );

  const updateCase = (id, status, event) => {
    setCases((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus(item.status, status),
              timeline: [...item.timeline, { time: new Date().toISOString(), event, actor: 'Municipality Officer' }],
            }
          : item
      )
    );
  };

  const totalCritical = useMemo(() => cases.filter((item) => item.priority === 'CRITICAL').length, [cases]);

  return (
    <div className="module-wrap">
      <div className="module-title">Municipality Open Cases</div>
      <div className="module-sub">Turn citizen signals into official response.</div>
      <div className="module-line">Critical cases now: {totalCritical}</div>
      <div className="module-grid">
        {cases.map((item) => (
          <div key={item.id} className="module-card">
            <div className="module-card-title">{item.id} · {item.title}</div>
            <div className="module-line">River: {item.river}</div>
            <div className="module-line">Municipality: {item.municipality}</div>
            <div className="module-line">Priority: {item.priority}</div>
            <div className="module-line">Confidence / evidence score: {item.confidence}</div>
            <div className="module-line">Status: {item.status}</div>
            <div className="module-line">Linked reports: {item.linkedReports.join(', ')}</div>
            <div className="module-line">People affected: {item.estimatedPeopleAffected.toLocaleString()}</div>
            <div className="module-line">Recommended action: {item.recommendedAction}</div>
            <div className="module-line">Public message draft: WaterWatch has detected increased river pollution risk upstream. Citizens are advised to avoid direct river contact until further notice.</div>
            <div className="module-line">Case Intelligence: repeated incidents nearby, historical events in same river, satellite coverage quality medium, citizen evidence strength high, suggested priority {item.priority}.</div>
            <div className="module-actions">
              <button className="module-btn" onClick={() => updateCase(item.id, 'Reviewing', 'Start review')}>Start review</button>
              <button className="module-btn" onClick={() => updateCase(item.id, 'Inspection Assigned', 'Inspection assigned')}>Assign inspection</button>
              <button className="module-btn" onClick={() => updateCase(item.id, 'Public Alert Sent', 'Public alert sent')}>Send public alert</button>
              <button className="module-btn" onClick={() => updateCase(item.id, 'Resolved', 'Case resolved')}>Mark resolved</button>
              <button className="module-btn">Export case JSON</button>
            </div>
            <pre className="module-json">{JSON.stringify(item.timeline, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

console.assert(nextStatus('Open', 'Reviewing') === 'Reviewing', 'municipality case status progression works');

export default OpenCases;
