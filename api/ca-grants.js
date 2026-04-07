const CSV_URLS = {
  awards_2223: 'https://data.ca.gov/dataset/0ae62873-b7f0-498e-a595-476fa8478b0b/resource/86870d5c-e9fa-46f5-8f86-2a9893662ce1/download/grant-awards-fiscal-year-2022-2023.csv',
  awards_2324: 'https://data.ca.gov/dataset/572d06aa-4f1f-44ad-80a4-167bec020881/resource/018f3523-652d-4197-a4a8-a055bfd1544f/download/grant-awards-fiscal-year-2023-2024.csv',
};

function parseRow(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const city = (req.query.city || 'San Bruno').toUpperCase();
  const allAwards = [];

  for (const [key, url] of Object.entries(CSV_URLS)) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const rows = parseCSV(await r.text());

      // Only include rows where RecipientName directly contains the city name
      // This avoids the county-level false positives
      rows
        .filter(row => (row['RecipientName'] || '').toUpperCase().includes(city))
        .forEach(row => {
          // TotalNominalAmount is the grant face value; TotalAwardUsed is what was spent
          // Both are often blank — show what we have
          const rawAmount = row['TotalNominalAmount'] || row['TotalAwardUsed'] || '0';
          const amount = parseFloat(rawAmount.replace(/[$,]/g, '')) || 0;

          allAwards.push({
            id:        row['GrantID'] || row['PortalID'] || '',
            recipient: row['RecipientName'] || '',
            agency:    row['AgencyDept'] || '',
            amount,
            start:     (row['ProjectStartDate'] || '').substring(0, 10),
            desc:      row['ProjectTitle'] || '',
            city,
            source:    'CA State',
            cat:       'other',
            fiscalYear: row['FiscalYear'] || key,
            // Link to the grant detail page on grants.ca.gov
            portalUrl: row['PortalID'] ? `https://www.grants.ca.gov/grants/${row['PortalID']}/` : '',
          });
        });
    } catch (e) {
      console.warn('CA CSV error:', key, e.message);
    }
  }

  return res.status(200).json({ results: allAwards, count: allAwards.length });
}
