export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ALL_CITIES = [
    'San Bruno', 'Atherton', 'Belmont', 'Brisbane', 'Burlingame',
    'Colma', 'Daly City', 'East Palo Alto', 'Foster City', 'Half Moon Bay',
    'Hillsborough', 'Menlo Park', 'Millbrae', 'Pacifica', 'Portola Valley',
    'Redwood City', 'San Carlos', 'San Mateo', 'South San Francisco', 'Woodside',
  ];

  async function fetchCity(city) {
    const filters = {
      award_type_codes: ['02', '03', '04', '05'],
      place_of_performance_scope: 'domestic',
      place_of_performance_locations: [{ country: 'USA', state: 'CA' }],
      keywords: [city],
      time_period: [{ start_date: '2010-10-01', end_date: '2025-09-30' }],
    };
    const fields = ['Award ID', 'Award Amount', 'Awarding Agency', 'Start Date', 'Recipient Name'];

    let total = 0, count = 0;
    const byCategory = { housing: 0, infra: 0, transit: 0, climate: 0, safety: 0, other: 0 };
    const byYear = {};
    let page = 1, hasNext = true;

    while (hasNext && page <= 10) {
      try {
        const body = { subawards: false, limit: 100, page, filters, fields, sort: 'Award Amount', order: 'desc' };
        const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!r.ok) break;
        const data = await r.json();
        const results = (data.results || []).filter(a =>
          (a['Recipient Name'] || '').toUpperCase().includes(city.toUpperCase())
        );
        results.forEach(a => {
          const amt = parseFloat(a['Award Amount']) || 0;
          total += amt;
          count++;
          const yr = (a['Start Date'] || '').substring(0, 4);
          if (yr) byYear[yr] = (byYear[yr] || 0) + amt;
          const ag = (a['Awarding Agency'] || '').toUpperCase();
          if (['HUD','HOUSING','CDBG','AFFORD'].some(k => ag.includes(k))) byCategory.housing += amt;
          else if (['FEMA','WATER','SEWER','INFRA','PUBLIC WORKS'].some(k => ag.includes(k))) byCategory.infra += amt;
          else if (['TRANSPORT','TRANSIT','HIGHWAY','DOT'].some(k => ag.includes(k))) byCategory.transit += amt;
          else if (['ENERGY','CLIMATE','ENVIRON','EPA'].some(k => ag.includes(k))) byCategory.climate += amt;
          else if (['JUSTICE','POLICE','HOMELAND','SAFETY'].some(k => ag.includes(k))) byCategory.safety += amt;
          else byCategory.other += amt;
        });
        hasNext = data.page_metadata?.hasNext ?? false;
        page++;
        if ((data.results || []).length === 0) break;
      } catch(e) { break; }
    }
    return { city, total, count, byCategory, byYear };
  }

  try {
    const results = await Promise.all(ALL_CITIES.map(fetchCity));
    results.sort((a, b) => b.total - a.total);
    return res.status(200).json({ results });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
