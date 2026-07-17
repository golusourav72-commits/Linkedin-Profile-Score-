# Signal Check — Career Profile Score

A diagnostic tool that scores your **LinkedIn profile, resume, and GitHub activity** together and gives you one combined Career Profile Score — section-by-section, with specific, AI-generated rewrite suggestions. Built for students and early-career engineers targeting roles across 14+ domains (SDE, Data Science, DevOps, Product Management, UI/UX, and more).

**Live:** https://linkedin-profile-analysis-mpnp.onrender.com

## Features

- **Three scoring pillars, one combined score** — LinkedIn (40%), Resume (40%), GitHub (20%). Fill in any one, two, or all three — the score reweights automatically based on what's provided.
- **Role-aware scoring** — pick a target role (Software Development, Data Science/ML, DevOps, Cybersecurity, Product Management, UI/UX Design, Finance, and more) and both the AI review and the ATS keyword match adjust to that role.
- **ATS keyword match** — checks your combined profile/resume text against real keyword sets per role and shows what's matched vs. missing.
- **Rule-based instant checks** — word/character counts, missing links, keyword gaps — computed client-side, no API call needed.
- **AI section scoring** — Gemini reviews each section (headline, About, experience, skills, resume summary, projects, etc.) and returns a score, issues, strengths, and a rewrite suggestion.
- **GitHub scoring is rule-based** (no AI cost) — pulled straight from GitHub's public REST API: profile completeness, repo count, description quality, recent activity, and language diversity.
- **PDF upload** — auto-fills either the LinkedIn or Resume pillar from a "Save to PDF" export.
- **Scan history** — stored locally in your browser (`localStorage`), shows your last 10 scans with score deltas.
- **Share/export** — copy results as text, download a PDF report, or export a shareable PNG score card.
- **Try Example / Clear** — one-click demo data or a full reset.

## Project structure

```
signal-check/
├── index.html          # Page structure
├── style.css            # Dark theme + glowing gradient gauge
├── script.js             # Frontend logic — rule checks, form rendering, PDF upload, combined scoring
├── rubric.json            # Config — LinkedIn/resume section definitions, target roles, ATS keyword sets
├── server.js              # Express backend — Gemini API calls + GitHub public API, kept server-side
├── package.json
├── .env.example
├── robots.txt
├── sitemap.xml
└── README.md
```

## Why there's a backend

Your Gemini API key must never be visible in frontend code (anyone can view-source and steal it). `server.js` holds the key server-side; the browser only ever talks to your own backend. GitHub scoring uses GitHub's public REST API directly from the backend too, so no GitHub token or login is required from the user.

## Setup

1. **Get an API key** from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

2. **Install backend dependencies:**
   ```bash
   npm install
   ```

3. **Set up your environment file:**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in your real API key:
   ```
   GEMINI_API_KEY=your_key_here
   ```
   Optional — pin a specific Gemini model (defaults to `gemini-2.0-flash` if unset; `gemini-flash-latest` or `gemini-flash-lite-latest` are recommended for a higher free-tier daily limit):
   ```
   GEMINI_MODEL=gemini-flash-lite-latest
   ```

4. **Start the backend:**
   ```bash
   npm start
   ```
   You should see: `Signal Check server running on port 3000`

5. **Open the app:**
   Visit `http://localhost:3000` — the same Express server serves the frontend files and the API routes, so nothing else needs to run separately.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/parse-pdf` | POST | Extracts sections from a raw PDF text dump. Pass `mode: "linkedin"` or `mode: "resume"` to target the right section set. |
| `/api/analyze` | POST | Scores the LinkedIn pillar. Accepts profile fields + `targetRole`. |
| `/api/analyze-resume` | POST | Scores the Resume pillar. Same shape as `/api/analyze`, resume fields + `targetRole`. |
| `/api/github-score` | POST | Rule-based GitHub score. Accepts `{ username }`, calls GitHub's public REST API. |
| `/health` | GET | Basic health check. |

## How it works

1. User fills in any combination of LinkedIn, Resume, and GitHub username (or uploads a PDF for LinkedIn/Resume, which gets auto-parsed).
2. **Instant rule-based checks** run client-side in `script.js` for LinkedIn fields — no API needed.
3. On "Run Full Scan", the frontend calls whichever backend routes correspond to the filled-in pillars, in parallel.
4. Each pillar's route builds a role-aware prompt (or, for GitHub, computes a rule-based score) and returns a `0–10` score, issues/strengths, and rewrite suggestions.
5. The frontend combines the available pillar scores using the weights in `rubric.json` (`pillarWeights`), renormalized to whichever pillars were actually scanned, and renders the combined gauge, priority fixes, ATS match, and section breakdown.

## Deploying

Currently deployed as a single Node web service on **Render**:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `GEMINI_API_KEY` (required), `GEMINI_MODEL` (optional)

Since `server.js` serves the frontend files directly (`express.static`), there's no separate frontend deploy — one service handles both.

## Ideas for next steps

- Persist scan history server-side (e.g. MongoDB) instead of `localStorage`, so history follows the user across devices
- Add lightweight auth so people can track score improvement over time
- Add a "before/after" comparison view once history is stored server-side
- Rate-limit the `/api/*` routes per IP to control Gemini API usage
- Expand GitHub scoring to look at README quality on individual pinned repos, not just profile-level signals

---

**Author — Sourav**
