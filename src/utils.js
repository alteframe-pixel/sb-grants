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
  const fields = [
    'Award ID', 'Recipient Name', 'Start Date', 'Award Amount',
    'Awarding Agency', 'Description',
    'Place of Performance City Name', 'Place of Performance State Code',
  ];

  // Use keywords filter with city name — searches across recipient name,
  // description, and place of performance fields
  const filters = {
    award_type_codes: ['02', '03', '04', '05'],
    place_of_performance_scope: 'domestic',
    place_of_performance_locations: [{ country: 'USA', state }],
    keywords: [city],
    time_period: [{ start_date: `${startYear}-10-01`, end_date: `${endYear}-09-30` }],
  };

  const allResults = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 10) {
    const body = { subawards: false, limit: 100, page, filters, fields, sort: 'Award Amount', order: 'desc' };
    const res = await fetch(`${API_BASE}/api/grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error ${res.status}`);
    }
    const data = await res.json();
    const results = data.results || [];
    allResults.push(...results);
    hasNext = data.page_metadata?.hasNext ?? false;
    page++;
    if (results.length === 0) break;
  }

  // Post-filter: keep only records where recipient name contains the city
  // City name field is often null in USAspending — recipient name is more reliable
  const cityUpper = city.toUpperCase();
  const filtered = allResults.filter(r =>
    (r['Recipient Name'] || '').toUpperCase().includes(cityUpper)
  );

  return filtered.map(r => ({
    id:        r['Award ID'] || '',
    recipient: r['Recipient Name'] || '',
    agency:    r['Awarding Agency'] || '',
    amount:    parseFloat(r['Award Amount']) || 0,
    start:     r['Start Date'] || '',
    desc:      r['Description'] || '',
    city:      r['Place of Performance City Name'] || city,
    cat:       categorize(r['Awarding Agency'], r['Description']),
  }));
}
