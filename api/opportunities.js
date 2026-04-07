// ============================================================
// Opportunities API — Available grants for a city government
// ============================================================
// Fetches from: Grants.gov (federal) + CA Grants Portal (state)
// Normalizes, filters, scores, and returns ranked opportunities
//
// SCALABILITY: All city-specific values come from CITY_CONFIG.
// To serve a different city, pass ?city=Belmont or extend the
// configs object below. Multi-city and multi-state ready.
// ============================================================

const CITY_CONFIGS = {
  'san-bruno': {
    name: 'San Bruno',
    state: 'CA',
    stateCode: '06',
    county: 'San Mateo',
    population: 45000,
    peers: ['Millbrae','Burlingame','Daly City','South San Francisco','Redwood City'],
    // Equal weights — update after first city manager meeting
    categoryWeights: { housing:1, infra:1, transit:1, climate:1, safety:1 },
    awardMin: 25000,
    awardMax: 5000000,
    partnershipThreshold: 15000000,
  },
  // Future cities — add config here, nothing else changes
  // 'belmont': { name: 'Belmont', state: 'CA', ... },
  // 'redwood-city': { name: 'Redwood City', state: 'CA', ... },
};

const DEFAULT_CITY = 'san-bruno';

// ─── Category keyword mapping ───────────────────────────────
const CATEGORY_KEYWORDS = {
  housing:  ['housing','affordable','cdbg','community development','shelter','homelessness','hud','residential'],
  infra:    ['infrastructure','water','sewer','stormwater','flood','road','bridge','utility','public works','hazard mitigation'],
  transit:  ['transportation','transit','highway','bicycle','pedestrian','active transportation','mobility','bus','rail'],
  climate:  ['climate','energy','environment','sustainability','resilience','solar','clean','green','park','recreation','open space'],
  safety:   ['public safety','police','fire','emergency','homeland','justice','byrne','jag','911','law enforcement'],
};

function categorize(title='', description='') {
  const text = (title + ' ' + description).toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = keywords.filter(k => text.includes(k)).length;
  }
  const top = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  return top[1] > 0 ? top[0] : 'other';
}

// ─── Eligibility check ──────────────────────────────────────
const MUNICIPALITY_TERMS = [
  'city','cities','municipality','municipalities','local government',
  'public agency','public agencies','county','counties','unit of general local government',
  'non-profit or government','government entity'
];

const EXCLUSION_TERMS = [
  'individual only','for-profit only','small business only',
  'institution of higher education only','nonprofit only'
];

function checkEligibility(eligibilityText='') {
  const text = eligibilityText.toLowerCase();
  if (EXCLUSION_TERMS.some(t => text.includes(t))) return { eligible: false, partnership: false };
  const eligible = MUNICIPALITY_TERMS.some(t => text.includes(t)) || text === '';
  const partnership = text.includes('joint') || text.includes('partnership') ||
                      text.includes('co-applicant') || text.includes('regional');
  return { eligible, partnership };
}

// ─── Scoring engine ─────────────────────────────────────────
function scoreGrant(grant, config, peerWinnerIds = new Set()) {
  let score = 0;
  const breakdown = {};

  // Category match (0-30)
  const weight = config.categoryWeights[grant.category] || 1;
  const catScore = grant.category !== 'other' ? 25 * weight : 5;
  breakdown.category_match = Math.round(catScore);
  score += breakdown.category_match;

  // Deadline urgency (0-25)
  if (grant.deadline) {
    const daysOut = Math.ceil((new Date(grant.deadline) - new Date()) / 86400000);
    if (daysOut < 0) breakdown.deadline_urgency = 0;
    else if (daysOut <= 14) breakdown.deadline_urgency = 25;
    else if (daysOut <= 30) breakdown.deadline_urgency = 20;
    else if (daysOut <= 60) breakdown.deadline_urgency = 15;
    else if (daysOut <= 90) breakdown.deadline_urgency = 10;
    else breakdown.deadline_urgency = 5;
  } else {
    breakdown.deadline_urgency = 3; // forecasted, no deadline yet
  }
  score += breakdown.deadline_urgency;

  // Award size fit (0-20)
  const min = grant.awardMin || 0;
  const max = grant.awardMax || grant.fundingTotal || 0;
  const midpoint = max ? (min + max) / 2 : min;
  if (midpoint >= config.awardMin && midpoint <= config.awardMax) {
    breakdown.population_fit = 20;
  } else if (midpoint < config.awardMin && midpoint > 0) {
    breakdown.population_fit = 10; // small but still doable
  } else if (midpoint > config.awardMax && midpoint <= config.partnershipThreshold) {
    breakdown.population_fit = 8; // stretch goal
  } else {
    breakdown.population_fit = 2; // partnership scale
  }
  score += breakdown.population_fit;

  // Peer history boost (0-15)
  breakdown.peer_history = peerWinnerIds.has(grant.cfda || grant.id) ? 15 : 0;
  score += breakdown.peer_history;

  // Pass-through bonus — state-administered federal is often easier (0-10)
  breakdown.passthrough_bonus = grant.isPassthrough ? 5 : 0;
  score += breakdown.passthrough_bonus;

  return { score: Math.min(100, Math.round(score)), breakdown };
}

// ─── Grants.gov fetcher ──────────────────────────────────────
async function fetchFederalGrants(config) {
  const grants = [];
  try {
    // Grants.gov v2 API — search by eligibility and opportunity status
    const body = {
      rows: 100,
      keyword: '',
      oppStatuses: ['forecasted','posted'],
      eligibilities: ['25'], // 25 = City or Township Government
      sortBy: 'openDate',
      sortOrder: 'desc',
    };

    const r = await fetch('https://api.grants.gov/v2/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) throw new Error(`Grants.gov ${r.status}`);
    const data = await r.json();

    (data.opportunities || data.data || []).forEach(opp => {
      const eligText = [
        opp.eligibleApplicants,
        opp.applicantEligibilityDesc,
        opp.additionalInfo,
      ].filter(Boolean).join(' ');

      const { eligible, partnership } = checkEligibility(eligText);
      if (!eligible) return;

      const category = categorize(opp.title || opp.opportunityTitle || '', opp.description || opp.synopsis || '');
      const awardMax = parseFloat(opp.awardCeiling || opp.awardFloor || '0') || null;
      const awardMin = parseFloat(opp.awardFloor || '0') || null;

      grants.push({
        id:           opp.opportunityId || opp.id || String(Math.random()),
        source:       'federal',
        isPassthrough: false,
        title:        opp.opportunityTitle || opp.title || '',
        agency:       opp.agencyName || opp.agency || '',
        category,
        status:       opp.opportunityStatus === 'posted' ? 'active' : 'forecasted',
        deadline:     opp.closeDate || opp.applicationDeadline || null,
        openDate:     opp.openDate || opp.postDate || null,
        fundingTotal: parseFloat(opp.estimatedFunding || '0') || null,
        awardMin,
        awardMax,
        matchRequired: !!(opp.costSharingOrMatchingRequirement === 'Yes'),
        matchPercent:  null,
        eligibilityText: eligText,
        partnership,
        description:  opp.description || opp.synopsis || '',
        url:          opp.opportunityId
          ? `https://www.grants.gov/search-results-detail/${opp.opportunityId}`
          : 'https://www.grants.gov',
        cfda:         opp.cfdaList?.[0] || null,
      });
    });
  } catch(e) {
    console.warn('Grants.gov fetch error:', e.message);
  }
  return grants;
}

// ─── CA Grants Portal fetcher ────────────────────────────────
async function fetchStateGrants(config) {
  const grants = [];
  try {
    const r = await fetch(
      'https://data.ca.gov/dataset/e1b1c799-cdd4-4219-af6d-93b79747fffb/resource/111c8c88-21f6-453c-ae2c-b4785a0624f5/download/california-grants-portal-data.csv',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) throw new Error(`CA Portal ${r.status}`);
    const text = await r.text();
    const rows = parseCSV(text);

    rows.forEach(row => {
      const status = (row['Status'] || '').toLowerCase();
      if (!['active','forecasted'].includes(status)) return;

      const applicantType = (row['ApplicantType'] || '').toLowerCase();
      const { eligible, partnership } = checkEligibility(applicantType);
      if (!eligible) return;

      // Federal pass-through detection
      const fundingSource = (row['FundingSource'] || '').toLowerCase();
      const isPassthrough = fundingSource.includes('federal') || fundingSource.includes('both');

      const title = row['Title'] || '';
      const desc  = row['Description'] || row['Purpose'] || '';
      const category = categorize(title, desc);

      const awardMax = parseFloat((row['EstAmounts'] || '').replace(/[$,]/g,'')) || null;
      const fundingTotal = parseFloat((row['EstAvailFunds'] || '').replace(/[$,]/g,'')) || null;
      const matchRequired = (row['MatchingFunds'] || '').toLowerCase() === 'yes';
      const matchPercent  = parseFloat(row['MatchingFundsNotes'] || '') || null;

      grants.push({
        id:           row['GrantID'] || row['PortalID'] || String(Math.random()),
        source:       isPassthrough ? 'federal-passthrough' : 'state',
        isPassthrough,
        title,
        agency:       row['AgencyDept'] || '',
        category,
        status:       status === 'active' ? 'active' : 'forecasted',
        deadline:     row['ApplicationDeadline'] || null,
        openDate:     row['OpenDate'] || null,
        fundingTotal,
        awardMin:     null,
        awardMax,
        matchRequired,
        matchPercent,
        eligibilityText: applicantType,
        partnership,
        description:  desc,
        url:          row['GrantURL'] || row['AgencyURL'] ||
                      (row['PortalID'] ? `https://www.grants.ca.gov/grants/${row['PortalID']}/` : 'https://www.grants.ca.gov'),
        cfda:         null,
      });
    });
  } catch(e) {
    console.warn('CA Portal fetch error:', e.message);
  }
  return grants;
}

// ─── CSV parser ──────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseRow(line);
    const row = {};
    headers.forEach((h,i) => { row[h.trim()] = (vals[i]||'').trim(); });
    return row;
  });
}

function parseRow(line) {
  const result = []; let current = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += ch;
  }
  result.push(current);
  return result;
}

// ─── Main handler ────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cityKey = (req.query.city || DEFAULT_CITY).toLowerCase().replace(/\s+/g,'-');
  const config  = CITY_CONFIGS[cityKey] || CITY_CONFIGS[DEFAULT_CITY];

  // Fetch both sources in parallel
  const [federal, state] = await Promise.all([
    fetchFederalGrants(config),
    fetchStateGrants(config),
  ]);

  const all = [...federal, ...state];

  // Score and sort
  const scored = all.map(grant => {
    const { score, breakdown } = scoreGrant(grant, config);
    return { ...grant, relevanceScore: score, scoreBreakdown: breakdown };
  });

  // Separate partnership-required from direct
  const direct      = scored.filter(g => !g.partnership);
  const partnership = scored.filter(g =>  g.partnership);

  // Sort each group by relevance
  const byRelevance = (a,b) => b.relevanceScore - a.relevanceScore;
  const byDeadline  = (a,b) => {
    if (!a.deadline && !b.deadline) return byRelevance(a,b);
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  };

  direct.sort(byRelevance);
  partnership.sort(byRelevance);

  // Summary stats
  const now = new Date();
  const closing30 = direct.filter(g => g.deadline && (new Date(g.deadline)-now)/86400000 <= 30).length;
  const totalFunding = direct.reduce((s,g) => s + (g.fundingTotal||0), 0);

  return res.status(200).json({
    city:           config.name,
    generatedAt:    new Date().toISOString(),
    summary: {
      total:          all.length,
      directEligible: direct.length,
      partnership:    partnership.length,
      closingIn30Days: closing30,
      totalAvailableFunding: totalFunding,
      federal:        all.filter(g=>g.source==='federal').length,
      state:          all.filter(g=>g.source==='state').length,
      passthrough:    all.filter(g=>g.source==='federal-passthrough').length,
    },
    direct,
    partnership,
  });
}
