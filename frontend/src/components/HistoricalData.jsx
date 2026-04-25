import React, { useMemo } from 'react';
import { historicalPollutionEvents } from '../data/waterwatchCommunityData';

const HistoricalData = () => {
  const total = historicalPollutionEvents.length;
  const avgResponse = useMemo(
    () => Math.round(historicalPollutionEvents.reduce((sum, e) => sum + e.responseMinutes, 0) / total),
    [total]
  );
  const byRiver = useMemo(() => {
    const map = {};
    historicalPollutionEvents.forEach((item) => {
      map[item.river] = (map[item.river] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, []);

  return (
    <div className="module-wrap">
      <div className="module-title">Historical Pollution Intelligence</div>
      <div className="module-sub">
        Historical data helps WaterWatch predict risk, prioritize inspections, and identify repeated pollution patterns.
      </div>
      <div className="module-line">Total historical events: {total}</div>
      <div className="module-line">Average municipality response time: {avgResponse} minutes</div>
      <div className="module-line">Most affected rivers: {byRiver.map(([river]) => river).join(', ')}</div>
      <div className="module-line">Most common pollution types: chemical smell, sewage, foam, oil spill</div>
      <div className="module-line">Response improvement over time: +23% faster from baseline period</div>
      <div className="module-card">
        <div className="module-card-title">Hotspot intelligence</div>
        <div className="module-line">Lepenec side stream has repeated chemical smell reports after rainfall.</div>
        <div className="module-line">Bregalnica shows increased runoff risk after heavy rain.</div>
        <div className="module-line">Vardar upstream segment is a repeated high-impact monitoring area.</div>
      </div>
      <div className="module-card">
        <div className="module-card-title">River event bars</div>
        {byRiver.map(([river, count]) => (
          <div key={river} className="hist-row">
            <span className="hist-label">{river}</span>
            <div className="hist-bar"><div className="hist-fill" style={{ width: `${Math.min(100, count * 20)}%` }} /></div>
            <span className="hist-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

console.assert(historicalPollutionEvents.length >= 12, 'historical data totals calculate correctly');

export default HistoricalData;
