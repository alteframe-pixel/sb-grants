export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Step 1: look up location ID for a city via GET ?city=San+Bruno&state=CA
  if (req.method === 'GET') {
    const { city, state } = req.query;
    try {
      const r = await fetch('https://api.usaspending.gov/api/v2/autocomplete/location/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_text: city,
          field: 'city_name',
          filter: { country_code: 'USA', state_code: state },
          limit: 5,
        }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Step 2: award search — body passed directly from frontend
  if (req.method === 'POST') {
    try {
      const upstream = await fetch(
        'https://api.usaspending.gov/api/v2/search/spending_by_award/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        }
      );

      const text = await upstream.text();
      if (!upstream.ok) {
        // Return the raw error body so the frontend can show it
        return res.status(upstream.status).json({ error: text, status: upstream.status });
      }

      return res.status(200).send(text);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
