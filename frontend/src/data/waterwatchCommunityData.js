export const citizenReports = [
  { id: 'rep-001', river: 'Vardar', area: 'Skopje upstream', municipality: 'Karpos', reportType: 'chemical_smell', severity: 'HIGH', confirmations: 5, reporterType: 'hiker', photoCount: 3, hasVoiceNote: true, hasLocation: true, satelliteCovered: true, sensorCovered: false },
  { id: 'rep-002', river: 'Treska', area: 'Matka stream', municipality: 'Saraj', reportType: 'foam', severity: 'HIGH', confirmations: 4, reporterType: 'hiker', photoCount: 2, hasVoiceNote: false, hasLocation: true, satelliteCovered: false, sensorCovered: false },
  { id: 'rep-003', river: 'Lepenec', area: 'Side stream north', municipality: 'Gjorce Petrov', reportType: 'oil_spill', severity: 'CRITICAL', confirmations: 6, reporterType: 'citizen', photoCount: 4, hasVoiceNote: true, hasLocation: true, satelliteCovered: false, sensorCovered: true },
  { id: 'rep-004', river: 'Bregalnica', area: 'Runoff canal', municipality: 'Stip', reportType: 'sewage', severity: 'HIGH', confirmations: 3, reporterType: 'citizen', photoCount: 1, hasVoiceNote: false, hasLocation: true, satelliteCovered: true, sensorCovered: true },
  { id: 'rep-005', river: 'Crna Reka', area: 'Bridge segment', municipality: 'Bitola', reportType: 'dead_fish', severity: 'CRITICAL', confirmations: 5, reporterType: 'hiker', photoCount: 3, hasVoiceNote: true, hasLocation: true, satelliteCovered: true, sensorCovered: true },
  { id: 'rep-006', river: 'Vardar', area: 'Aerodrom channel', municipality: 'Aerodrom', reportType: 'trash_buildup', severity: 'MEDIUM', confirmations: 2, reporterType: 'citizen', photoCount: 1, hasVoiceNote: false, hasLocation: true, satelliteCovered: false, sensorCovered: false },
  { id: 'rep-007', river: 'Treska', area: 'Canyon side creek', municipality: 'Saraj', reportType: 'color_change', severity: 'MEDIUM', confirmations: 3, reporterType: 'hiker', photoCount: 2, hasVoiceNote: false, hasLocation: true, satelliteCovered: false, sensorCovered: false },
  { id: 'rep-008', river: 'Lepenec', area: 'Urban runoff point', municipality: 'Butel', reportType: 'sewage', severity: 'HIGH', confirmations: 4, reporterType: 'citizen', photoCount: 2, hasVoiceNote: false, hasLocation: true, satelliteCovered: false, sensorCovered: true },
  { id: 'rep-009', river: 'Vardar', area: 'Center embankment', municipality: 'Centar', reportType: 'oil_spill', severity: 'HIGH', confirmations: 3, reporterType: 'citizen', photoCount: 1, hasVoiceNote: true, hasLocation: true, satelliteCovered: true, sensorCovered: true },
  { id: 'rep-010', river: 'Bregalnica', area: 'Village downstream', municipality: 'Kocani', reportType: 'foam', severity: 'MEDIUM', confirmations: 2, reporterType: 'hiker', photoCount: 1, hasVoiceNote: false, hasLocation: true, satelliteCovered: false, sensorCovered: false },
];

export const municipalityCases = [
  { id: 'CASE-001', title: 'Vardar upstream risk before Skopje', river: 'Vardar', municipality: 'Centar', priority: 'HIGH', confidence: 0.91, status: 'Open', linkedReports: ['rep-001', 'rep-009'], estimatedPeopleAffected: 196000, recommendedAction: 'Dispatch inspection and prepare advisory' },
  { id: 'CASE-002', title: 'Matka small stream foam report', river: 'Treska', municipality: 'Saraj', priority: 'MEDIUM', confidence: 0.83, status: 'Reviewing', linkedReports: ['rep-002', 'rep-007'], estimatedPeopleAffected: 42000, recommendedAction: 'Request samples and verify source' },
  { id: 'CASE-003', title: 'Lepenec chemical smell', river: 'Lepenec', municipality: 'Gjorce Petrov', priority: 'CRITICAL', confidence: 0.9, status: 'Inspection Assigned', linkedReports: ['rep-003', 'rep-008'], estimatedPeopleAffected: 61000, recommendedAction: 'Issue preliminary warning and inspect outlet' },
  { id: 'CASE-004', title: 'Bregalnica agricultural runoff', river: 'Bregalnica', municipality: 'Stip', priority: 'MEDIUM', confidence: 0.74, status: 'Open', linkedReports: ['rep-004', 'rep-010'], estimatedPeopleAffected: 37000, recommendedAction: 'Monitor runoff channels after rain' },
  { id: 'CASE-005', title: 'Crna Reka dead fish report', river: 'Crna Reka', municipality: 'Bitola', priority: 'CRITICAL', confidence: 0.88, status: 'Public Alert Sent', linkedReports: ['rep-005'], estimatedPeopleAffected: 28000, recommendedAction: 'Coordinate emergency sampling and notice' },
];

export const historicalPollutionEvents = [
  { id: 'hist-001', river: 'Vardar', type: 'chemical_smell', municipality: 'Karpos', responseMinutes: 95, hotspot: 'Vardar upstream segment', afterRain: true },
  { id: 'hist-002', river: 'Vardar', type: 'oil_spill', municipality: 'Centar', responseMinutes: 78, hotspot: 'Center embankment', afterRain: false },
  { id: 'hist-003', river: 'Lepenec', type: 'chemical_smell', municipality: 'Gjorce Petrov', responseMinutes: 120, hotspot: 'Lepenec side stream', afterRain: true },
  { id: 'hist-004', river: 'Lepenec', type: 'sewage', municipality: 'Butel', responseMinutes: 110, hotspot: 'Urban outfall junction', afterRain: true },
  { id: 'hist-005', river: 'Bregalnica', type: 'runoff', municipality: 'Stip', responseMinutes: 145, hotspot: 'Agricultural drainage zone', afterRain: true },
  { id: 'hist-006', river: 'Bregalnica', type: 'foam', municipality: 'Kocani', responseMinutes: 138, hotspot: 'Downstream village bend', afterRain: true },
  { id: 'hist-007', river: 'Crna Reka', type: 'dead_fish', municipality: 'Bitola', responseMinutes: 88, hotspot: 'Bridge segment', afterRain: false },
  { id: 'hist-008', river: 'Treska', type: 'foam', municipality: 'Saraj', responseMinutes: 102, hotspot: 'Matka canyon stream', afterRain: false },
  { id: 'hist-009', river: 'Treska', type: 'color_change', municipality: 'Saraj', responseMinutes: 97, hotspot: 'Matka side branch', afterRain: false },
  { id: 'hist-010', river: 'Vardar', type: 'sewage', municipality: 'Aerodrom', responseMinutes: 92, hotspot: 'Urban drainage section', afterRain: true },
  { id: 'hist-011', river: 'Vardar', type: 'foam', municipality: 'Karpos', responseMinutes: 84, hotspot: 'Western bank segment', afterRain: true },
  { id: 'hist-012', river: 'Crna Reka', type: 'oil_spill', municipality: 'Bitola', responseMinutes: 105, hotspot: 'Industrial crossing', afterRain: false },
];

export const guardianUsers = [
  { id: 'usr-001', name: 'Elena M.', level: 'Guardian', reportsSubmitted: 18, reportsVerified: 12, peopleProtected: 180, smallRiversMapped: 3, alertsShared: 11, cleanupsJoined: 2, streakDays: 9 },
  { id: 'usr-002', name: 'Martin P.', level: 'Sentinel', reportsSubmitted: 31, reportsVerified: 24, peopleProtected: 420, smallRiversMapped: 6, alertsShared: 17, cleanupsJoined: 4, streakDays: 32 },
  { id: 'usr-003', name: 'Ana K.', level: 'Protector', reportsSubmitted: 9, reportsVerified: 6, peopleProtected: 90, smallRiversMapped: 2, alertsShared: 8, cleanupsJoined: 1, streakDays: 6 },
  { id: 'usr-004', name: 'Igor R.', level: 'Observer', reportsSubmitted: 4, reportsVerified: 2, peopleProtected: 25, smallRiversMapped: 1, alertsShared: 2, cleanupsJoined: 0, streakDays: 2 },
  { id: 'usr-005', name: 'Vesna S.', level: 'Guardian', reportsSubmitted: 20, reportsVerified: 15, peopleProtected: 260, smallRiversMapped: 4, alertsShared: 12, cleanupsJoined: 2, streakDays: 15 },
  { id: 'usr-006', name: 'Petar D.', level: 'Protector', reportsSubmitted: 11, reportsVerified: 8, peopleProtected: 120, smallRiversMapped: 2, alertsShared: 6, cleanupsJoined: 1, streakDays: 10 },
];

export const awardDefinitions = [
  { id: 'a1', name: 'First Signal', requirement: 'Submit first report', progress: 1, goal: 1 },
  { id: 'a2', name: 'Small River Scout', requirement: 'Map 3 small streams', progress: 2, goal: 3 },
  { id: 'a3', name: 'Vardar Guardian', requirement: '10 Vardar reports', progress: 8, goal: 10 },
  { id: 'a4', name: 'Cleanup Hero', requirement: 'Join 3 cleanups', progress: 1, goal: 3 },
  { id: 'a5', name: 'Fast Responder', requirement: 'Share 10 alerts', progress: 7, goal: 10 },
  { id: 'a6', name: 'Community Shield', requirement: '100 people warned', progress: 100, goal: 100 },
  { id: 'a7', name: 'Sentinel Ring Complete', requirement: 'Close all River Rings once', progress: 0.7, goal: 1 },
  { id: 'a8', name: '7-Day River Streak', requirement: '7 day streak', progress: 7, goal: 7 },
  { id: 'a9', name: '30-Day Guardian Streak', requirement: '30 day streak', progress: 15, goal: 30 },
];

export const smallRiverBlindSpots = [
  {
    id: 'matka-stream-01',
    name: 'Small stream near Matka',
    municipality: 'Saraj',
    riverSystem: 'Treska / Vardar',
    satelliteCoverage: 'Weak',
    reason: 'Narrow shaded stream and canyon terrain',
    reports: 7,
    evidenceTypes: ['photo', 'hiker report', 'foam', 'color change'],
    confidence: 0.81,
    status: 'Municipality review needed',
    recommendedAction: 'Send field inspection team',
  },
  {
    id: 'vodno-runoff-01',
    name: 'Vodno runoff channel',
    municipality: 'Karpos',
    riverSystem: 'Vardar',
    satelliteCoverage: 'Not reliable',
    reason: 'Small urban drainage channel',
    reports: 5,
    evidenceTypes: ['photo', 'sewage smell', 'trash buildup'],
    confidence: 0.76,
    status: 'Community confirmed',
    recommendedAction: 'Request more reports and inspect outlet',
  },
  {
    id: 'lepenec-side-stream-01',
    name: 'Lepenec side stream',
    municipality: 'Gjorce Petrov',
    riverSystem: 'Lepenec / Vardar',
    satelliteCoverage: 'Partial',
    reason: 'Narrow flow and mixed urban shadows',
    reports: 4,
    evidenceTypes: ['chemical smell', 'oil film'],
    confidence: 0.73,
    status: 'Watchlist',
    recommendedAction: 'Monitor and prepare inspection',
  },
];

export const aggregatedCommunitySignals = {
  reportsSubmittedThisWeek: 38,
  confirmedReports: 24,
  smallRiversMapped: 9,
  lowSatelliteCoverageAreas: 6,
  peopleWarned: 690,
  mostReportedSigns: ['chemical smell', 'foam', 'sewage flow', 'oil rainbow film'],
  repeatedHotspots: ['Lepenec side stream', 'Vardar upstream segment', 'Matka canyon stream'],
  hikerEvidenceContributions: 17,
  privacyNotice: 'WaterWatch uses aggregated community signals. Personal user data is not shown to municipalities.',
};

export const municipalityStatuses = [
  'Open',
  'Reviewing',
  'Inspection Assigned',
  'Public Alert Sent',
  'Resolved',
];

console.assert(citizenReports.length >= 10, 'at least 10 citizen reports');
console.assert(municipalityCases.length >= 5, 'at least 5 municipality cases');
console.assert(historicalPollutionEvents.length >= 12, 'at least 12 historical events');
console.assert(guardianUsers.length >= 6, 'at least 6 guardian users');
console.assert(awardDefinitions.length >= 9, 'at least 9 awards');
console.assert(smallRiverBlindSpots.length >= 3, 'at least 3 blind spots');
