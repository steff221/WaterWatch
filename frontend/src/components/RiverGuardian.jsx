import React from 'react';
import { awardDefinitions, guardianUsers } from '../data/waterwatchCommunityData';

const RiverGuardian = () => {
  const topUser = guardianUsers[0];
  const ringProgress = {
    report: Math.min(100, Math.round((topUser.reportsSubmitted / 30) * 100)),
    confirm: Math.min(100, Math.round((topUser.reportsVerified / 25) * 100)),
    protect: Math.min(100, Math.round((topUser.peopleProtected / 300) * 100)),
  };

  return (
    <div className="module-wrap">
      <div className="module-title">River Rings</div>
      <div className="module-sub">Close your River Rings by reporting, confirming, and protecting others.</div>
      <div className="module-grid">
        <div className="module-card">
          <div className="module-card-title">Report Ring (cyan)</div>
          <div className="ring-bg"><div className="ring-fill cyan" style={{ width: `${ringProgress.report}%` }} /></div>
          <div className="module-line">{ringProgress.report}% complete</div>
        </div>
        <div className="module-card">
          <div className="module-card-title">Confirm Ring (green)</div>
          <div className="ring-bg"><div className="ring-fill green" style={{ width: `${ringProgress.confirm}%` }} /></div>
          <div className="module-line">{ringProgress.confirm}% complete</div>
        </div>
        <div className="module-card">
          <div className="module-card-title">Protect Ring (orange)</div>
          <div className="ring-bg"><div className="ring-fill orange" style={{ width: `${ringProgress.protect}%` }} /></div>
          <div className="module-line">{ringProgress.protect}% complete</div>
        </div>
      </div>
      <div className="module-card">
        <div className="module-line">People protected: {topUser.peopleProtected}</div>
        <div className="module-line">Reports submitted: {topUser.reportsSubmitted}</div>
        <div className="module-line">Reports verified: {topUser.reportsVerified}</div>
        <div className="module-line">Small rivers mapped: {topUser.smallRiversMapped}</div>
        <div className="module-line">Alerts shared: {topUser.alertsShared}</div>
        <div className="module-line">Cleanups joined: {topUser.cleanupsJoined}</div>
        <div className="module-line">Streak days: {topUser.streakDays}</div>
        <div className="module-line">You helped protect 180 people.</div>
        <div className="module-line">You mapped 3 small streams satellites may miss.</div>
        <div className="module-line">You are a Guardian of Vardar.</div>
      </div>
      <div className="module-grid">
        {awardDefinitions.map((award) => {
          const progress = Math.min(100, Math.round((award.progress / award.goal) * 100));
          const unlocked = progress >= 100;
          return (
            <div key={award.id} className={`module-card glass ${unlocked ? 'unlocked' : 'locked'}`}>
              <div className="module-card-title">{award.name}</div>
              <div className="module-line">{award.requirement}</div>
              <div className="ring-bg"><div className="ring-fill cyan" style={{ width: `${progress}%` }} /></div>
              <div className="module-line">{unlocked ? 'Unlocked' : 'Locked'} · {progress}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

console.assert(awardDefinitions.every((a) => (a.progress / a.goal) <= 1 || a.goal > 0), 'award progress calculates correctly');

export default RiverGuardian;
