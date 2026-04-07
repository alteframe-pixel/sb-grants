# San Bruno Grant Tracker — Phase 1

Federal grant award history for San Bruno, CA. Pulls live data from USAspending.gov.

---

## Deploy to Vercel (15 minutes)

### Prerequisites
- [Node.js](https://nodejs.org) installed (v18+)
- A free [Vercel account](https://vercel.com/signup)

---

### Step 1 — Install dependencies

```bash
cd sb-grants
npm install
```

---

### Step 2 — Install the Vercel CLI

```bash
npm install -g vercel
```

---

### Step 3 — Deploy

```bash
vercel
```

You'll be prompted:
- **Set up and deploy?** → Y
- **Which scope?** → your account
- **Link to existing project?** → N
- **Project name?** → sb-grants (or anything you like)
- **In which directory is your code?** → ./ (just hit Enter)
- **Want to modify settings?** → N

Vercel will build and deploy. You'll get a URL like:
`https://sb-grants-xxxx.vercel.app`

That URL is your live, shareable PoC.

---

### Step 4 — Subsequent deploys

After making changes:

```bash
vercel --prod
```

---

## Run locally (optional)

To develop locally before deploying:

```bash
npm run dev
```

The Vite proxy handles the CORS issue automatically in local dev.

> **Note:** The `/api/grants.js` serverless function only runs on Vercel, not in the
> local Vite dev server. For local testing, either deploy to Vercel first, or run
> `vercel dev` instead of `npm run dev` — this spins up the Vercel runtime locally
> and makes the `/api` routes work.

---

## Project structure

```
sb-grants/
├── api/
│   └── grants.js          # Vercel serverless function — proxies USAspending API
├── src/
│   ├── App.jsx             # Main dashboard UI
│   ├── main.jsx            # React entry point
│   ├── utils.js            # API fetching, categorization, formatting
│   └── components/
│       └── YearChart.jsx   # Chart.js bar chart component
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## What's next — Phase 2

Phase 2 adds peer city comparison: same query run against Millbrae, South San Francisco,
Burlingame, and Daly City, with a side-by-side view showing the funding gap.
