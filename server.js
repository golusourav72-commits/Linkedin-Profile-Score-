require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

// ---------- Load rubric.json once at startup ----------
const RUBRIC = JSON.parse(fs.readFileSync(path.join(__dirname, "rubric.json"), "utf-8"));
const SECTION_KEYS = RUBRIC.sections.map((s) => s.key);

// ---------- Gemini helper ----------
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set on the server.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ---------- POST /api/parse-pdf ----------
// Takes raw text extracted from a LinkedIn PDF export and asks Gemini to
// split it into the rubric's sections.
app.post("/api/parse-pdf", async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== "string") {
      return res.status(400).json({ error: "rawText is required." });
    }

    const prompt = `
You are given raw text extracted from a LinkedIn "Save to PDF" profile export.
Extract the following sections from it: ${SECTION_KEYS.join(", ")}.

Return ONLY a valid JSON object with exactly these keys: ${SECTION_KEYS.join(", ")}.
Each value should be a plain string (use "" if a section isn't found in the text).
Do not include markdown formatting, code fences, or any explanation — JSON only.

Raw PDF text:
"""
${rawText}
"""
`.trim();

    const parsed = await callGemini(prompt);

    const safeResult = {};
    SECTION_KEYS.forEach((key) => {
      safeResult[key] = typeof parsed[key] === "string" ? parsed[key] : "";
    });

    res.json(safeResult);
  } catch (err) {
    console.error("parse-pdf error:", err.message);
    res.status(500).json({ error: "Failed to parse PDF content." });
  }
});

// ---------- POST /api/analyze ----------
// Takes the filled-in profile sections and asks Gemini to score them.
app.post("/api/analyze", async (req, res) => {
  try {
    const { targetRole, ...profileData } = req.body || {};

    const roleMeta = (RUBRIC.targetRoles || []).find((r) => r.key === targetRole);
    const roleLabel = roleMeta ? roleMeta.label : "Software Development (SDE)";

    const sectionsText = SECTION_KEYS.map((key) => {
      const section = RUBRIC.sections.find((s) => s.key === key);
      const value = (profileData[key] || "").trim() || "(empty)";
      return `### ${section.label}\n${value}`;
    }).join("\n\n");

    const prompt = `
You are an expert LinkedIn profile reviewer helping a candidate targeting **${roleLabel}** roles at top companies.

Review the following LinkedIn profile sections and score them specifically for a ${roleLabel} career path — judge relevance, keywords, and impact through that lens (e.g. for Data Science focus on ML/stats signal, for Product Management focus on strategy/stakeholder signal, for Digital Marketing focus on campaign/growth signal, for UI/UX Design focus on design process/tools signal, for SDE focus on coding/systems signal).

${sectionsText}

Return ONLY a valid JSON object with this exact shape, no markdown, no explanation:
{
  "overall_score": <number 0-10, one decimal allowed, weighted average across all sections>,
  "top_3_priority_fixes": [<string>, <string>, <string>],
  "sections": {
    ${SECTION_KEYS.map(
      (key) => `"${key}": { "score": <number 0-10>, "issues": [<string>, ...], "strengths": [<string>, ...], "rewrite_suggestion": <string or null> }`
    ).join(",\n    ")}
  }
}

Scoring guide: 7.5-10 is strong, 5-7.4 needs improvement, 0-4.9 is weak.
Be specific and actionable — reference the actual content given, not generic advice.
If a section is empty, score it low and say so in "issues".
`.trim();

    const result = await callGemini(prompt);

    // Basic shape safety so the frontend never chokes on a malformed response
    result.overall_score = Number(result.overall_score) || 0;
    result.top_3_priority_fixes = Array.isArray(result.top_3_priority_fixes)
      ? result.top_3_priority_fixes.slice(0, 3)
      : [];
    result.sections = result.sections || {};

    res.json(result);
  } catch (err) {
    console.error("analyze error:", err.message);
    res.status(500).json({ error: "Failed to analyze profile." });
  }
});

// ---------- Health check ----------
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ---------- Fallback to index.html for the root route ----------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Signal Check server running on port ${PORT}`);
});
