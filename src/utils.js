// Determine if we're running locally or on Vercel
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

// Step 1: resolve a city to its USAspending location ID
async function resolveLocationId(city, state) {
  const res = await fetch(`${API_BASE}/api/grants?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
  if (!res.ok) throw new Error(`Location lookup failed: ${res.status}`);
  const data = await res.json();
  // Results are objects with a location_id field
  const results = data.results || [];
  if (!results.length) throw new Error(`No location ID found for ${city}, ${state}`);
  // Find exact city match
  const match = results.find(r =>
    (r.city_name || '').toUpperCase() === city.toUpperCase()
  ) || results[0];
  return match.location_id;
}

export async function fetchGrants({ city, state = 'CA', startYear = 2010, endYear = 2025 }) {
  // Resolve city to location ID first
  let locationId;
  try {
    locationId = await resolveLocationId(city, state);
  } catch (e) {
    throw new Error(`Could not resolve location for ${city}, ${state}: ${e.message}`);
  }

  const body = {
    subawards: false,
    limit: 100,
    page: 1,
    filters: {
      award_type_codes: ['02','03','04','05','06','07','08','09','10','11'],
      place_of_performance_scope: 'domestic',
      place_of_performance_locations: [locationId],
      time_period: [{ start_date: `${startYear}-10-01`, end_date: `${endYear}-09-30` }],
    },
    fields: ['Award ID','Recipient Name','Start Date','Award Amount','Awarding Agency','Description'],
    sort: 'Award Amount',
    order: 'desc',
  };

  const allResults = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 10) {
    body.page = page;
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

  return allResults.map(r => ({
    id:        r['Award ID'] || '',
    recipient: r['Recipient Name'] || '',
    agency:    r['Awarding Agency'] || '',
    amount:    parseFloat(r['Award Amount']) || 0,
    start:     r['Start Date'] || '',
    desc:      r['Description'] || '',
    cat:       categorize(r['Awarding Agency'], r['Description']),
  }));
}
