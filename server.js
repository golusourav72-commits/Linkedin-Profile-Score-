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
    const { rawText, mode } = req.body;
    if (!rawText || typeof rawText !== "string") {
      return res.status(400).json({ error: "rawText is required." });
    }

    const isResume = mode === "resume";
    const sectionDefs = isResume ? RUBRIC.resumeSections : RUBRIC.sections;
    const keys = sectionDefs.map((s) => s.key);
    const sourceLabel = isResume ? "resume" : 'LinkedIn "Save to PDF" profile export';

    const prompt = `
You are given raw text extracted from a ${sourceLabel}.
Extract the following sections from it: ${keys.join(", ")}.

Return ONLY a valid JSON object with exactly these keys: ${keys.join(", ")}.
Each value should be a plain string (use "" if a section isn't found in the text).
Do not include markdown formatting, code fences, or any explanation — JSON only.

Raw PDF text:
"""
${rawText}
"""
`.trim();

    const parsed = await callGemini(prompt);

    const safeResult = {};
    keys.forEach((key) => {
      safeResult[key] = typeof parsed[key] === "string" ? parsed[key] : "";
    });

    res.json(safeResult);
  } catch (err) {
    console.error("parse-pdf error:", err.message);
    res.status(500).json({ error: "Failed to parse PDF content." });
  }
});

// ---------- Shared helper: score a set of sections with Gemini ----------
const RESUME_SECTION_KEYS = RUBRIC.resumeSections.map((s) => s.key);

async function scoreSections(sectionDefs, sectionKeys, profileData, roleLabel, kind) {
  const sectionsText = sectionKeys
    .map((key) => {
      const section = sectionDefs.find((s) => s.key === key);
      const value = (profileData[key] || "").trim() || "(empty)";
      return `### ${section.label}\n${value}`;
    })
    .join("\n\n");

  const prompt = `
You are an expert ${kind} reviewer helping a candidate targeting **${roleLabel}** roles at top companies.

Review the following ${kind} sections and score them specifically for a ${roleLabel} career path — judge relevance, keywords, and impact through that lens (e.g. for Data Science focus on ML/stats signal, for Product Management focus on strategy/stakeholder signal, for Digital Marketing focus on campaign/growth signal, for UI/UX Design focus on design process/tools signal, for SDE/Full Stack/Frontend/Backend focus on coding/systems signal, for Cybersecurity focus on security tooling/frameworks, for DevOps focus on CI/CD and infra signal, for Finance focus on modeling/analysis signal).

${sectionsText}

Return ONLY a valid JSON object with this exact shape, no markdown, no explanation:
{
  "overall_score": <number 0-10, one decimal allowed, weighted average across all sections>,
  "top_3_priority_fixes": [<string>, <string>, <string>],
  "sections": {
    ${sectionKeys
      .map(
        (key) => `"${key}": { "score": <number 0-10>, "issues": [<string>, ...], "strengths": [<string>, ...], "rewrite_suggestion": <string or null> }`
      )
      .join(",\n    ")}
  }
}

Scoring guide: 7.5-10 is strong, 5-7.4 needs improvement, 0-4.9 is weak.
Be specific and actionable — reference the actual content given, not generic advice.
If a section is empty, score it low and say so in "issues".
`.trim();

  const result = await callGemini(prompt);
  result.overall_score = Number(result.overall_score) || 0;
  result.top_3_priority_fixes = Array.isArray(result.top_3_priority_fixes) ? result.top_3_priority_fixes.slice(0, 3) : [];
  result.sections = result.sections || {};
  return result;
}

function getRoleLabel(targetRole) {
  const roleMeta = (RUBRIC.targetRoles || []).find((r) => r.key === targetRole);
  return roleMeta ? roleMeta.label : "Software Development (SDE)";
}

// ---------- POST /api/analyze ----------
// Takes the filled-in LinkedIn profile sections and asks Gemini to score them.
app.post("/api/analyze", async (req, res) => {
  try {
    const { targetRole, ...profileData } = req.body || {};
    const result = await scoreSections(RUBRIC.sections, SECTION_KEYS, profileData, getRoleLabel(targetRole), "LinkedIn profile");
    res.json(result);
  } catch (err) {
    console.error("analyze error:", err.message);
    res.status(500).json({ error: "Failed to analyze profile." });
  }
});

// ---------- POST /api/analyze-resume ----------
// Same shape as /api/analyze, but scores resume sections instead.
app.post("/api/analyze-resume", async (req, res) => {
  try {
    const { targetRole, ...profileData } = req.body || {};
    const result = await scoreSections(RUBRIC.resumeSections, RESUME_SECTION_KEYS, profileData, getRoleLabel(targetRole), "resume");
    res.json(result);
  } catch (err) {
    console.error("analyze-resume error:", err.message);
    res.status(500).json({ error: "Failed to analyze resume." });
  }
});

// ---------- POST /api/github-score ----------
// Rule-based (no AI cost) scoring using GitHub's public REST API.
app.post("/api/github-score", async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "GitHub username is required." });
    }

    const headers = { "User-Agent": "signal-check-app", Accept: "application/vnd.github+json" };

    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers });
    if (!userRes.ok) {
      return res.status(404).json({ error: `GitHub user "${username}" not found.` });
    }
    const user = await userRes.json();

    const reposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=15`,
      { headers }
    );
    const repos = reposRes.ok ? await reposRes.json() : [];

    // ---- Rule-based signals ----
    const issues = [];
    const strengths = [];
    let score = 0;

    // Profile completeness (2 pts)
    if (user.bio && user.bio.trim().length > 5) {
      score += 1;
      strengths.push("Profile has a bio.");
    } else {
      issues.push("Add a short bio to your GitHub profile — it's prime real estate recruiters check first.");
    }
    if (user.blog || user.company || user.location) {
      score += 1;
      strengths.push("Profile includes contact/context details (website, company, or location).");
    } else {
      issues.push("Add a portfolio link, company, or location to your GitHub profile.");
    }

    // Repo volume (2 pts)
    const publicRepos = user.public_repos || 0;
    if (publicRepos >= 8) score += 2;
    else if (publicRepos >= 3) score += 1;
    if (publicRepos < 3) issues.push("Fewer than 3 public repos — build and push more projects publicly.");
    else strengths.push(`${publicRepos} public repositories.`);

    // Repo quality — descriptions present (2 pts)
    const withDescription = repos.filter((r) => r.description && r.description.trim().length > 0).length;
    const descRatio = repos.length ? withDescription / repos.length : 0;
    if (descRatio >= 0.7) score += 2;
    else if (descRatio >= 0.4) score += 1;
    if (descRatio < 0.7) issues.push("Many repos are missing descriptions — add a one-line summary to each.");
    else strengths.push("Most repos have clear descriptions.");

    // Recent activity (2 pts)
    const now = Date.now();
    const recentlyPushed = repos.filter((r) => r.pushed_at && now - new Date(r.pushed_at).getTime() < 1000 * 60 * 60 * 24 * 90);
    if (recentlyPushed.length >= 2) score += 2;
    else if (recentlyPushed.length >= 1) score += 1;
    if (recentlyPushed.length === 0) issues.push("No pushes in the last 90 days — recruiters read this as inactivity.");
    else strengths.push("Active with commits in the last 90 days.");

    // Language diversity (2 pts)
    const languages = new Set(repos.map((r) => r.language).filter(Boolean));
    if (languages.size >= 3) score += 2;
    else if (languages.size >= 2) score += 1;
    if (languages.size < 2) issues.push("Limited language diversity — showcase range across a couple of stacks.");
    else strengths.push(`Uses ${languages.size} different languages across repos.`);

    const topRepos = [...repos]
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 5)
      .map((r) => ({ name: r.name, stars: r.stargazers_count || 0, language: r.language, url: r.html_url }));

    res.json({
      score: Math.min(10, score),
      username: user.login,
      avatar: user.avatar_url,
      publicRepos,
      followers: user.followers || 0,
      topLanguages: [...languages].slice(0, 5),
      topRepos,
      issues,
      strengths,
    });
  } catch (err) {
    console.error("github-score error:", err.message);
    res.status(500).json({ error: "Failed to fetch GitHub data." });
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
