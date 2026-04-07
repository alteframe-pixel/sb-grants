// Queries USAspending for all San Mateo County cities using recipient_search
// which is more reliable than keyword matching

const CITIES = [
  { name: 'San Bruno',         recipients: ['CITY OF SAN BRUNO', 'SAN BRUNO CITY'] },
  { name: 'Atherton',          recipients: ['TOWN OF ATHERTON', 'CITY OF ATHERTON'] },
  { name: 'Belmont',           recipients: ['CITY OF BELMONT'] },
  { name: 'Brisbane',          recipients: ['CITY OF BRISBANE'] },
  { name: 'Burlingame',        recipients: ['CITY OF BURLINGAME'] },
  { name: 'Colma',             recipients: ['TOWN OF COLMA', 'CITY OF COLMA'] },
  { name: 'Daly City',         recipients: ['CITY OF DALY CITY', 'DALY CITY'] },
  { name: 'East Palo Alto',    recipients: ['CITY OF EAST PALO ALTO', 'EAST PALO ALTO CITY'] },
  { name: 'Foster City',       recipients: ['CITY OF FOSTER CITY', 'FOSTER CITY'] },
  { name: 'Half Moon Bay',     recipients: ['CITY OF HALF MOON BAY', 'HALF MOON BAY CITY'] },
  { name: 'Hillsborough',      recipients: ['TOWN OF HILLSBOROUGH', 'CITY OF HILLSBOROUGH'] },
  { name: 'Menlo Park',        recipients: ['CITY OF MENLO PARK', 'MENLO PARK CITY'] },
  { name: 'Millbrae',          recipients: ['CITY OF MILLBRAE', 'MILLBRAE CITY'] },
  { name: 'Pacifica',          recipients: ['CITY OF PACIFICA', 'PACIFICA CITY'] },
  { name: 'Portola Valley',    recipients: ['TOWN OF PORTOLA VALLEY'] },
  { name: 'Redwood City',      recipients: ['CITY OF REDWOOD CITY', 'REDWOOD CITY'] },
  { name: 'San Carlos',        recipients: ['CITY OF SAN CARLOS', 'SAN CARLOS CITY'] },
  { name: 'San Mateo',         recipients: ['CITY OF SAN MATEO', 'SAN MATEO CITY'] },
  { name: 'South San Francisco', recipients: ['CITY OF SOUTH SAN FRANCISCO', 'SOUTH SAN FRANCISCO CITY'] },
  { name: 'Woodside',          recipients: ['TOWN OF WOODSIDE'] },
];

const CAT_KW = {
  housing:  ['HUD','HOUSING','CDBG','AFFORD','SHELTER','HOME PROGRAM'],
  infra:    ['FEMA','WATER','SEWER','INFRA','PUBLIC WORKS','FLOOD','HAZARD'],
  transit:  ['TRANSPORT','TRANSIT','HIGHWAY','FEDERAL TRANSIT','FEDERAL HIGHWAY'],
  climate:  ['ENERGY','CLIMATE','ENVIRON','EPA','SOLAR','GREEN','PARK'],
  safety:   ['JUSTICE','POLICE','HOMELAND','SAFETY','FIRE','BYRNE','JAG'],
};

function categorize(agency = '') {
  const h = agency.toUpperCase();
  for (const [cat, kws] of Object.entries(CAT_KW)) {
    if (kws.some(k => h.includes(k))) return cat;
  }
  return 'other';
}

async function fetchForCity({ name, recipients }) {
  let total = 0, count = 0;
  const byCategory = { housing:0, infra:0, transit:0, climate:0, safety:0, other:0 };
  const byYear = {};

  for (const recipientName of recipients) {
    let page = 1, hasNext = true;
    while (hasNext && page <= 10) {
      try {
        const body = {
          subawards: false,
          limit: 100,
          page,
          filters: {
            award_type_codes: ['02','03','04','05'],
            // Filter by exact recipient name — much more reliable than keywords
            recipient_search_text: [recipientName],
            time_period: [{ start_date: '2010-10-01', end_date: '2025-09-30' }],
          },
          fields: ['Award ID','Award Amount','Awarding Agency','Start Date','Recipient Name'],
          sort: 'Award Amount',
          order: 'desc',
        };

        const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!r.ok) { hasNext = false; break; }
        const data = await r.json();
        const results = data.results || [];

        results.forEach(a => {
          const amt = parseFloat(a['Award Amount']) || 0;
          total += amt;
          count++;
          const yr = (a['Start Date'] || '').substring(0, 4);
          if (yr) byYear[yr] = (byYear[yr] || 0) + amt;
          const cat = categorize(a['Awarding Agency'] || '');
          byCategory[cat] = (byCategory[cat] || 0) + amt;
        });

        hasNext = data.page_metadata?.hasNext ?? false;
        page++;
        if (results.length === 0) break;
      } catch(e) { hasNext = false; break; }
    }
  }

  return { city: name, total, count, byCategory, byYear };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const results = await Promise.all(CITIES.map(fetchForCity));
    results.sort((a, b) => b.total - a.total);
    return res.status(200).json({ results });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
