import React, { useMemo, useState } from 'react';
import { aggregatedCommunitySignals, citizenReports } from '../data/waterwatchCommunityData';
import { calculateEvidenceScore, getEvidenceLabel, shouldEscalateToMunicipality } from '../utils/evidenceScoreModel';
import WhatToLookForGuide from './WhatToLookForGuide';

const CitizenReports = () => {
  const [selectedType, setSelectedType] = useState('');
  const scored = useMemo(
    () =>
      citizenReports.map((report) => {
        const score = calculateEvidenceScore(report);
        return {
          ...report,
          evidenceScore: score,
          evidenceLabel: getEvidenceLabel(score),
          escalate: shouldEscalateToMunicipality(report),
        };
      }),
    []
  );

  return (
    <div className="module-wrap">
      <div className="module-title">Citizen Reports</div>
      <div className="module-sub">From citizen signal to municipal action. Small rivers matter too.</div>
      <div className="module-card">
        <div className="module-card-title">Aggregated Community Signals</div>
        <div className="module-line">{aggregatedCommunitySignals.privacyNotice}</div>
        <div className="module-line">Reports this week: {aggregatedCommunitySignals.reportsSubmittedThisWeek}</div>
        <div className="module-line">Confirmed reports: {aggregatedCommunitySignals.confirmedReports}</div>
        <div className="module-line">Small rivers mapped: {aggregatedCommunitySignals.smallRiversMapped}</div>
        <div className="module-line">Areas without reliable satellite coverage: {aggregatedCommunitySignals.lowSatelliteCoverageAreas}</div>
        <div className="module-line">People warned: {aggregatedCommunitySignals.peopleWarned}</div>
        <div className="module-line">Most reported signs: {aggregatedCommunitySignals.mostReportedSigns.join(', ')}</div>
        <div className="module-line">Repeated hotspots: {aggregatedCommunitySignals.repeatedHotspots.join(', ')}</div>
        <div className="module-line">Hiker evidence contributions: {aggregatedCommunitySignals.hikerEvidenceContributions}</div>
      </div>
      <div className="module-grid">
        {scored.map((report) => (
          <div key={report.id} className="module-card">
            <div className="module-card-title">{report.id} · {report.river}</div>
            <div className="module-line">Type: {report.reportType}</div>
            <div className="module-line">Severity: {report.severity}</div>
            <div className="module-line">Confirmations: {report.confirmations}</div>
            <div className="module-line">Evidence score: {report.evidenceScore}</div>
            <div className="module-line">Label: {report.evidenceLabel}</div>
            <div className="module-line">Municipality escalation: {report.escalate ? 'Yes' : 'No'}</div>
          </div>
        ))}
      </div>
      {selectedType && (
        <div className="module-card">
          <div className="module-card-title">Mock report modal</div>
          <div className="module-line">Prefilled reportType: {selectedType}</div>
        </div>
      )}
      <WhatToLookForGuide onReportTypeSelect={setSelectedType} />
    </div>
  );
};

export default CitizenReports;
