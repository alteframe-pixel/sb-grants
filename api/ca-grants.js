const CSV_URLS = {
  awards_2223: 'https://data.ca.gov/dataset/0ae62873-b7f0-498e-a595-476fa8478b0b/resource/86870d5c-e9fa-46f5-8f86-2a9893662ce1/download/grant-awards-fiscal-year-2022-2023.csv',
  awards_2324: 'https://data.ca.gov/dataset/572d06aa-4f1f-44ad-80a4-167bec020881/resource/018f3523-652d-4197-a4a8-a055bfd1544f/download/grant-awards-fiscal-year-2023-2024.csv',
  opportunities: 'https://data.ca.gov/dataset/e1b1c799-cdd4-4219-af6d-93b79747fffb/resource/111c8c88-21f6-453c-ae2c-b4785a0624f5/download/california-grants-portal-data.csv',
};

function parseRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
  return { headers, rows };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const city = (req.query.city || 'San Bruno').toUpperCase();
  const debug = req.query.debug === '1';

  const allAwards = [];
  const debugInfo = {};

  for (const [key, url] of Object.entries(CSV_URLS)) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) {
        debugInfo[key] = `HTTP ${r.status}`;
        continue;
      }
      const text = await r.text();
      const { headers, rows } = parseCSV(text);
      debugInfo[key] = { headers, sample: rows.slice(0, 2) };

      if (!debug) {
        // Filter rows containing the city name in any field
        const cityRows = rows.filter(row =>
          Object.values(row).some(v => v.toUpperCase().includes(city))
        );

        cityRows.forEach(row => {
          // Try every plausible column name for each field
          const amount = parseFloat(
            row['Award Amount'] || row['award_amount'] || row['Amount Awarded'] ||
            row['amount_awarded'] || row['Total Award Amount'] || row['Grant Amount'] ||
            row['Estimated Total Funding'] || row['estimated_total_funding'] || '0'
          ) || 0;

          const recipient =
            row['Awardee Name'] || row['awardee_name'] || row['Recipient'] ||
            row['recipient'] || row['Organization Name'] || row['Grantee Name'] ||
            row['grantee_name'] || '';

          const agency =
            row['Administering Agency'] || row['administering_agency'] ||
            row['Agency'] || row['agency'] || row['Grantor'] || row['grantor'] ||
            row['Grant Making Agency'] || '';

          const start =
            row['Award Date'] || row['award_date'] || row['Start Date'] ||
            row['start_date'] || row['Grant Start Date'] || row['Open Date'] || '';

          const desc =
            row['Grant Title'] || row['grant_title'] || row['Title'] || row['title'] ||
            row['Grant Name'] || row['grant_name'] || row['Program Name'] || '';

          allAwards.push({
            id:        row['Grant ID'] || row['grant_id'] || row['ID'] || key,
            recipient, agency, amount, start, desc,
            city, source: 'CA State',
            cat: 'other',
          });
        });
      }
    } catch (e) {
      debugInfo[key] = `Error: ${e.message}`;
    }
  }

  if (debug) return res.status(200).json(debugInfo);
  return res.status(200).json({ results: allAwards, count: allAwards.length });
}
