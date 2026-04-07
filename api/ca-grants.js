// Fetches California Grants Portal award CSVs and filters by city
// Data available from FY2022-23 onward per AB132

const CA_CSV_URLS = [
  'https://data.ca.gov/dataset/0ae62873-b7f0-498e-a595-476fa8478b0b/resource/86870d5c-e9fa-46f5-8f86-2a9893662ce1/download/grant-awards-fiscal-year-2022-2023.csv',
  'https://data.ca.gov/dataset/572d06aa-4f1f-44ad-80a4-167bec020881/resource/018f3523-652d-4197-a4a8-a055bfd1544f/download/grant-awards-fiscal-year-2023-2024.csv',
  'https://data.ca.gov/dataset/california-grants-portal-grant-awards-2024-2025/resource/download/grant-awards-fiscal-year-2024-2025.csv',
];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Parse header — handle quoted fields
  const headers = parseRow(lines[0]);
  
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim(); });
    return row;
  }).filter(r => Object.keys(r).length > 1);
}

function parseRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const city = (req.query.city || 'San Bruno').toUpperCase();

  const allAwards = [];

  for (const url of CA_CSV_URLS) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const text = await r.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) continue;

      // Log headers from first file to help debug column names
      const headers = Object.keys(rows[0]);
      
      // Filter rows where any field contains the city name
      const cityRows = rows.filter(row =>
        Object.values(row).some(v => v.toUpperCase().includes(city))
      );

      // Normalize to common shape — column names vary, try multiple possibilities
      cityRows.forEach(row => {
        const amount = parseFloat(
          row['Award Amount'] || row['award_amount'] || row['AwardAmount'] ||
          row['Grant Amount'] || row['grant_amount'] || row['Amount'] || '0'
        );
        const recipient = 
          row['Awardee Name'] || row['awardee_name'] || row['Recipient Name'] ||
          row['recipient_name'] || row['Organization Name'] || row['Grantee'] || '';
        const agency =
          row['Administering Agency'] || row['administering_agency'] || 
          row['Agency'] || row['agency'] || row['Grantor'] || '';
        const startDate =
          row['Award Date'] || row['award_date'] || row['Start Date'] ||
          row['Grant Start Date'] || row['Date'] || '';
        const description =
          row['Grant Title'] || row['grant_title'] || row['Title'] ||
          row['Program Name'] || row['program_name'] || row['Description'] || '';

        if (recipient || amount > 0) {
          allAwards.push({
            id:        row['Grant ID'] || row['grant_id'] || row['ID'] || '',
            recipient: recipient,
            agency:    agency,
            amount:    amount,
            start:     startDate,
            desc:      description,
            city:      city,
            source:    'CA State',
            cat:       'other',
            _headers:  headers, // include for debugging, remove later
          });
        }
      });
    } catch (e) {
      console.warn('Failed to fetch CA CSV:', url, e.message);
    }
  }

  return res.status(200).json({ results: allAwards, count: allAwards.length });
}
