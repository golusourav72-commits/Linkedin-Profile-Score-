require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// gemini-3.5-flash is on Google's free tier as of early 2026.
// If this model name stops working, check https://ai.google.dev/gemini-api/docs/models
// for the current free-tier model name and swap it in below.
const MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.replace(/```json|```/g, "").trim();
}

// ---------- Analyze profile sections ----------
app.post("/api/analyze", async (req, res) => {
  const data = req.body || {};

  const prompt = `You are a LinkedIn profile expert who has reviewed thousands of profiles for recruiters at top tech companies. Analyze the following LinkedIn profile sections and return ONLY valid JSON, no preamble, no markdown fences, no code blocks.

PROFILE DATA:
Headline: ${data.headline || "(empty)"}
About: ${data.about || "(empty)"}
Experience: ${data.experience || "(empty)"}
Education: ${data.education || "(empty)"}
Skills: ${data.skills || "(empty)"}
Featured/Projects: ${data.featured || "(empty)"}

Score each section 0-10. Be honest and critical. For headline and about, give ONE short rewrite_suggestion (max 25 words). For each section give at most 2 strengths and 2 issues, each under 12 words. Return EXACTLY this JSON shape, nothing else:
{"overall_score":0,"sections":{"headline":{"score":0,"strengths":[],"issues":[],"rewrite_suggestion":""},"about":{"score":0,"strengths":[],"issues":[],"rewrite_suggestion":""},"experience":{"score":0,"strengths":[],"issues":[]},"education":{"score":0,"strengths":[],"issues":[]},"skills":{"score":0,"strengths":[],"issues":[]},"featured":{"score":0,"strengths":[],"issues":[]}},"top_3_priority_fixes":[]}`;

  try {
    const clean = await callGemini(prompt);
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed", detail: err.message });
  }
});

// ---------- Parse a LinkedIn "Save to PDF" export into sections ----------
app.post("/api/parse-pdf", async (req, res) => {
  const { rawText } = req.body || {};
  if (!rawText) return res.status(400).json({ error: "rawText is required" });

  const prompt = `The text below was extracted from a LinkedIn "Save to PDF" profile export. Split it into the correct sections and return ONLY valid JSON, no preamble, no markdown fences.

RAW TEXT:
${rawText}

Return EXACTLY this JSON shape (use empty string if a section isn't found):
{"headline":"","about":"","experience":"","education":"","skills":"","featured":""}
For "skills", return a comma-separated list. For "experience", combine role titles and bullet points into one text block, most recent first.`;

  try {
    const clean = await callGemini(prompt);
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF parsing failed", detail: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Signal Check backend running on http://localhost:${PORT}`));
