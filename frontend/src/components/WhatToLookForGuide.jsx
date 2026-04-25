import React from 'react';

const GUIDE_ITEMS = [
  { key: 'foam', icon: '🫧', title: 'Unusual foam', note: 'Persistent foam patches with no storm context.', danger: 'MEDIUM' },
  { key: 'color_change', icon: '🟣', title: 'Color change', note: 'Sudden milky, black, green, or orange tint.', danger: 'HIGH' },
  { key: 'chemical_smell', icon: '⚗️', title: 'Chemical smell', note: 'Sharp solvent or fuel-like smell near water.', danger: 'CRITICAL' },
  { key: 'dead_fish', icon: '🐟', title: 'Dead fish or animals', note: 'Unexpected fish kills or affected wildlife.', danger: 'CRITICAL' },
  { key: 'oil_spill', icon: '🌈', title: 'Oil rainbow film', note: 'Rainbow sheen moving with current.', danger: 'HIGH' },
  { key: 'trash_buildup', icon: '🗑️', title: 'Trash buildup', note: 'Sudden accumulations trapping waste.', danger: 'MEDIUM' },
  { key: 'sewage', icon: '🚰', title: 'Sewage flow', note: 'Visible discharge or sewage-like discharge point.', danger: 'CRITICAL' },
  { key: 'residue', icon: '🧪', title: 'Strange residue on banks', note: 'Powder, slime, or sticky residue on edges.', danger: 'HIGH' },
];

const WhatToLookForGuide = ({ onReportTypeSelect }) => {
  return (
    <div className="module-wrap">
      <div className="module-title">What to look for</div>
      <div className="module-sub">
        Report visible signs of pollution safely — especially in small rivers satellites may miss.
      </div>
      <div className="module-grid">
        {GUIDE_ITEMS.map((item) => (
          <div key={item.key} className="module-card">
            <div className="module-card-title">{item.icon} {item.title}</div>
            <div className="module-line">{item.note}</div>
            <div className="module-line">Danger level: {item.danger}</div>
            <button className="module-btn" onClick={() => onReportTypeSelect(item.key)}>Report this</button>
          </div>
        ))}
      </div>
      <div className="module-warning">
        Do not touch suspicious water. Take photos from a safe distance.
      </div>
    </div>
  );
};

export default WhatToLookForGuide;
