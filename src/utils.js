export const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

export const CATEGORIES = {
  housing:  ['HUD','HOUSING','COMMUNITY DEVELOPMENT','HOME PROGRAM','CDBG','AFFORDABLE','SHELTER','HOMELESSNESS'],
  infra:    ['PUBLIC WORKS','INFRASTRUCTURE','WATER','SEWER','FEMA','FLOOD','HAZARD MITIGATION','STORMWATER'],
  transit:  ['TRANSPORT','TRANSIT','HIGHWAY','FEDERAL HIGHWAY','FEDERAL TRANSIT','BIKE','PEDESTRIAN','ROAD'],
  climate:  ['ENERGY','CLIMATE','ENVIRONMENT','SOLAR','EFFICIENCY','GREEN','PARK','RECREATION','SUSTAINABILITY'],
  safety:   ['JUSTICE','POLICE','FIRE','HOMELAND','SAFETY','BYRNE','JAG','EMERGENCY MANAGEMENT','911'],
};

export const CAT_LABELS = {
  housing: 'Housing', infra: 'Infrastructure', transit: 'Transit',
  climate: 'Climate', safety: 'Safety', other: 'Other'
};

export function categorize(agency = '', description = '') {
  const haystack = (agency + ' ' + description).toUpperCase();
  for (const [key, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => haystack.includes(k))) return key;
  }
  return 'other';
}

export function fmtMoney(n, compact = false) {
  if (n == null || isNaN(n)) return '—';
  if (compact) {
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString() + 'K';
  }
  return '$' + Math.round(n).toLocaleString();
}

export async function fetchGrants({ city, state = 'CA', startYear = 2010, endYear = 2025 }) {
  const baseFilters = {
    place_of_performance_scope: 'domestic',
    place_of_performance_locations: [{ country: 'USA', state }],
    time_period: [{ start_date: `${startYear}-10-01`, end_date: `${endYear}-09-30` }],
  };

  const fields = [
    'Award ID', 'Recipient Name', 'Start Date', 'Award Amount',
    'Awarding Agency', 'Description',
    'Place of Performance City Name', 'Place of Performance State Code',
  ];

  // Must split by award type group — USAspending rejects mixed groups
  const queries = [
    { ...baseFilters, award_type_codes: ['02', '03', '04', '05'] },  // grants
    { ...baseFilters, award_type_codes: ['06', '10', '11'] },         // other financial assistance
  ];

  const allResults = [];

  for (const filters of queries) {
    let page = 1;
    let hasNext = true;
    while (hasNext && page <= 5) {
      const body = { subawards: false, limit: 100, page, filters, fields, sort: 'Award Amount', order: 'desc' };
      const res = await fetch(`${API_BASE}/api/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { console.warn('batch error', res.status); break; }
      const data = await res.json();
      const results = data.results || [];
      allResults.push(...results);
      hasNext = data.page_metadata?.hasNext ?? false;
      page++;
      if (results.length === 0) break;
    }
  }

  // Post-filter by city
  const cityUpper = city.toUpperCase();
  const cityFiltered = city
    ? allResults.filter(r => (r['Place of Performance City Name'] || '').toUpperCase() === cityUpper)
    : allResults;

  return cityFiltered.map(r => ({
    id:        r['Award ID'] || '',
    recipient: r['Recipient Name'] || '',
    agency:    r['Awarding Agency'] || '',
    amount:    parseFloat(r['Award Amount']) || 0,
    start:     r['Start Date'] || '',
    desc:      r['Description'] || '',
    city:      r['Place of Performance City Name'] || '',
    cat:       categorize(r['Awarding Agency'], r['Description']),
  }));
}
