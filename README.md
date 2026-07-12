# Signal Check — LinkedIn Profile Scorer

A diagnostic tool that scores your LinkedIn profile section-by-section (headline, about, experience, education, skills, featured) using rule-based checks + Gemini API analysis, with rewrite suggestions.

## Project structure

```
linkedin-scorer/
├── index.html        # Page structure
├── css/style.css     # Dark diagnostic theme
├── script.js         # Frontend logic — rule checks, form rendering, PDF upload
├── rubric.json       # Config — section definitions, scoring thresholds
├── server.js         # Express backend — proxies Gemini API calls securely
├── package.json
├── .env.example
└── README.md
```

## Why there's a backend

Your  Gemini API key must never be visible in frontend code (anyone can view-source and steal it). `server.js` holds the key server-side; the browser only ever talks to your own backend.

## Setup

1. **Get an API key from aistudio.google.com/apikey

2. **Install backend dependencies:**
   ```bash
   npm install
   ```

3. **Set up your environment file:**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in your real API key.

4. **Start the backend:**
   ```bash
   npm start
   ```
   You should see: `Signal Check backend running on http://localhost:3001`

5. **Open the frontend:**
   Just open `index.html` in your browser (or serve it with a simple static server / VS Code Live Server). Make sure `server.js` is running at the same time — the frontend calls `http://localhost:3001` for analysis.

## How it works

1. User pastes profile sections (or uploads a LinkedIn "Save to PDF" export)
2. **Instant rule-based checks** run client-side in `script.js` — no API needed (word counts, missing links, keyword gaps)
3. On "Run Scan", the frontend sends the profile data to `/api/analyze` on your backend
4. Backend forwards it to Claude with a scoring rubric prompt, gets structured JSON back, returns it to the frontend
5. Frontend renders the gauge, priority fixes, and per-section breakdown

## Next steps to extend this

- Add MongoDB to save scan history per user (Mongoose model: `{ userId, sections, result, createdAt }`)
- Add user auth (JWT) so people can track score improvement over time
- Deploy backend to Render/Railway, frontend to Vercel/Netlify or GitHub Pages
- Add a "before/after" comparison view once history is stored
- Rate-limit `/api/analyze` per IP to control API costs

## Deploying

- **Frontend**: any static host (GitHub Pages, Vercel, Netlify) — just update `BACKEND_URL` in `js/script.js` to your deployed backend's URL
- **Backend**: Render, Railway, or Fly.io — set `GEMINI_API_KEY` as an environment variable in your host's dashboard, never commit `.env`



**Author Name- Sourav**
