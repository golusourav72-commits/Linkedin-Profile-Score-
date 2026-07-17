// ---------- Config ----------
const ICONS = {
  type: "fa-solid fa-heading",
  user: "fa-solid fa-user",
  briefcase: "fa-solid fa-briefcase",
  cap: "fa-solid fa-graduation-cap",
  bolt: "fa-solid fa-bolt",
  folder: "fa-solid fa-folder-open",
};

const BACKEND_URL = ""; // change to your deployed backend URL in production

const EXAMPLE_PROFILE = {
  headline: "Aspiring SDE | DSA & System Design | MERN Stack | Building CoreDevs India",
  about: "Second-year Computer Science student focused on backend engineering and data structures. I've built and deployed 3 full-stack projects including a real-time multiplayer chess platform (MERN + Socket.io) and a LinkedIn profile scoring tool powered by the Gemini API. Currently solving DSA problems daily following a structured 24-week plan, and leading a 200+ member developer community across multiple colleges. Looking for SDE internship opportunities where I can contribute to real production systems.",
  experience: "Full Stack Development Intern — Built and shipped REST APIs used by 500+ users, reduced average response time by 30% through query optimization, and integrated a third-party payment gateway end-to-end.",
  education: "B.Tech, Computer Science & Engineering, HPTU Hamirpur (2025–2029)",
  skills: "C++, JavaScript, React, Node.js, Express, MongoDB, Git, REST APIs, Socket.io, Data Structures & Algorithms",
  featured: "Signal Check — LinkedIn profile scorer (Node.js, Gemini API) — github.com/example/signal-check\nReal-time Multiplayer Chess Platform (MERN, Socket.io) — github.com/example/chess-app",
};

const EXAMPLE_RESUME = {
  summary: "Second-year Computer Science student with hands-on full-stack development experience, seeking SDE internship opportunities to build scalable, production-grade applications.",
  experience: "Full Stack Development Intern, NoviTech R&D — Built and shipped REST APIs used by 500+ users; reduced average response time by 30% through query optimization.",
  projects: "Signal Check — AI-powered career profile scorer (Node.js, Express, Gemini API). Real-time Multiplayer Chess Platform (MERN, Socket.io).",
  education: "B.Tech, Computer Science & Engineering, HPTU Hamirpur (2025–2029)",
  skills: "C++, JavaScript, React, Node.js, Express, MongoDB, Git, REST APIs, Data Structures & Algorithms",
};
const EXAMPLE_GITHUB_USERNAME = "golusourav72-commits";

let RUBRIC = null;
let profileData = {};
let resumeData = {};
let githubResult = null;
let lastResult = null; // combined result across all filled pillars

// ---------- Init ----------
async function init() {
  const res = await fetch("/rubric.json");
  RUBRIC = await res.json();

  RUBRIC.sections.forEach((s) => (profileData[s.key] = ""));
  RUBRIC.resumeSections.forEach((s) => (resumeData[s.key] = ""));
  renderForm();
  renderResumeForm();
  renderRoleOptions();
  bindEvents();
  renderScanHistory();
}

// ---------- Populate the target-role dropdown from rubric.json ----------
function renderRoleOptions() {
  const select = document.getElementById("targetRoleSelect");
  const roles = RUBRIC.targetRoles || [{ key: "sde", label: "Software Development (SDE)" }];
  select.innerHTML = roles.map((r) => `<option value="${r.key}">${r.label}</option>`).join("");
  select.addEventListener("change", () => {
    if (lastResult) renderAtsMatch(); // live-update the match if results are already showing
  });
}

function getSelectedRole() {
  const select = document.getElementById("targetRoleSelect");
  return select ? select.value : "sde";
}

// ---------- Render form fields from rubric.json ----------
function renderForm() {
  const form = document.getElementById("profileForm");
  form.innerHTML = "";

  RUBRIC.sections.forEach((section) => {
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.className = "field-label";
    label.innerHTML = `<i class="${ICONS[section.icon]}"></i> ${section.label}`;

    const input = section.multiline
      ? document.createElement("textarea")
      : document.createElement("input");

    if (section.multiline) input.rows = 3;
    input.placeholder = section.placeholder;
    input.id = `field-${section.key}`;
    input.value = profileData[section.key] || "";

    const counter = document.createElement("div");
    counter.className = "field-counter";
    counter.id = `counter-${section.key}`;

    const updateCounter = () => updateFieldCounter(section, input.value, counter);
    updateCounter();

    input.addEventListener("input", (e) => {
      profileData[section.key] = e.target.value;
      updateCounter();
      updateRunButtonState();
    });

    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(counter);
    form.appendChild(field);
  });

  updateProgress();
}

// ---------- Live char/word counter, driven by rubric limits ----------
function updateFieldCounter(section, value, el) {
  const trimmed = value.trim();

  if (section.key === "skills") {
    const count = trimmed ? trimmed.split(",").map((s) => s.trim()).filter(Boolean).length : 0;
    el.textContent = `${count} skill${count === 1 ? "" : "s"}`;
    el.classList.toggle(
      "field-counter-warn",
      count > 0 && (count < (section.minSkillsWarning || 0) || count > (section.maxSkillsWarning || Infinity))
    );
    return;
  }

  if (typeof section.maxChars === "number") {
    const len = value.length;
    el.textContent = `${len}/${section.maxChars} characters`;
    el.classList.toggle("field-counter-warn", len > section.maxChars || (len > 0 && len < (section.minCharsWarning || 0)));
    return;
  }

  if (section.minWordsWarning || section.maxWordsWarning) {
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    el.textContent = `${words} words`;
    el.classList.toggle(
      "field-counter-warn",
      words > 0 && (words < (section.minWordsWarning || 0) || words > (section.maxWordsWarning || Infinity))
    );
    return;
  }

  el.textContent = trimmed ? `${trimmed.split(/\s+/).length} words` : "";
}

// ---------- Render resume form fields from rubric.json's resumeSections ----------
function renderResumeForm() {
  const form = document.getElementById("resumeForm");
  form.innerHTML = "";

  RUBRIC.resumeSections.forEach((section) => {
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.className = "field-label";
    label.innerHTML = `<i class="${ICONS[section.icon]}"></i> ${section.label}`;

    const input = section.multiline ? document.createElement("textarea") : document.createElement("input");
    if (section.multiline) input.rows = 3;
    input.placeholder = section.placeholder;
    input.id = `resume-field-${section.key}`;
    input.value = resumeData[section.key] || "";

    const counter = document.createElement("div");
    counter.className = "field-counter";
    counter.id = `resume-counter-${section.key}`;

    const updateCounter = () => updateFieldCounter(section, input.value, counter);
    updateCounter();

    input.addEventListener("input", (e) => {
      resumeData[section.key] = e.target.value;
      updateCounter();
      updateRunButtonState();
    });

    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(counter);
    form.appendChild(field);
  });

  updateResumeProgress();
}

function updateResumeProgress() {
  const total = RUBRIC.resumeSections.length;
  const filled = Object.values(resumeData).filter((v) => v.trim().length > 0).length;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  document.getElementById("resumeProgressFill").style.width = `${pct}%`;
  document.getElementById("resumeProgressLabel").textContent = `${filled}/${total} sections filled`;
}

// ---------- Sidebar progress indicator ----------
function updateProgress() {
  const total = RUBRIC.sections.length;
  const filled = Object.values(profileData).filter((v) => v.trim().length > 0).length;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  document.getElementById("progressFill").style.width = `${pct}%`;
  document.getElementById("progressLabel").textContent = `${filled}/${total} sections filled`;
}

function updateRunButtonState() {
  const linkedinFilled = Object.values(profileData).some((v) => v.trim().length > 0);
  const resumeFilled = Object.values(resumeData).some((v) => v.trim().length > 0);
  const githubFilled = (document.getElementById("githubUsernameInput")?.value || "").trim().length > 0;
  document.getElementById("runScanBtn").disabled = !(linkedinFilled || resumeFilled || githubFilled);
  updateProgress();
  updateResumeProgress();
}

// ---------- Rule-based checks (instant, no API needed) ----------
function ruleChecks(data) {
  const out = {};
  const wc = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

  const h = data.headline || "";
  out.headline = [
    h.length === 0 ? "Empty headline — this is prime real estate, don't leave it blank." : null,
    h.length > 220 ? "Over LinkedIn's 220 character limit, it will get cut off." : null,
    h.length > 0 && h.length < 40 ? "Quite short — you have room for more keywords." : null,
    h.length > 0 && !h.includes("|") ? "Consider using separators (|) to pack in multiple keywords." : null,
  ].filter(Boolean);

  const a = data.about || "";
  out.about = [
    a.length === 0 ? "Empty About section — recruiters skip profiles without one." : null,
    wc(a) > 0 && wc(a) < 50 ? "Under 50 words — too thin to tell a real story." : null,
    wc(a) > 300 ? "Over 300 words — trim it, most readers stop scrolling." : null,
    a.length > 0 && !/\d/.test(a) ? "No numbers found — quantify at least one achievement." : null,
  ].filter(Boolean);

  const e = data.experience || "";
  out.experience = [
    e.length === 0 ? "No experience listed — add internships, projects-as-experience, or leadership roles." : null,
    e.length > 0 && !/\d/.test(e) ? "No metrics — add numbers (%, users, time saved) to show impact." : null,
  ].filter(Boolean);

  const sk = data.skills || "";
  const skillCount = sk.split(",").map((s) => s.trim()).filter(Boolean).length;
  out.skills = [
    skillCount === 0 ? "No skills listed." : null,
    skillCount > 0 && skillCount < 5 ? "Fewer than 5 skills — add more relevant technical keywords." : null,
    skillCount > 20 ? "Over 20 skills — dilutes relevance, trim to your strongest ones." : null,
  ].filter(Boolean);

  const f = data.featured || "";
  out.featured = [
    f.length === 0 ? "No projects/featured items — this is where you prove you can build." : null,
    f.length > 0 && !/http/i.test(f) ? "No links detected — add live demo or GitHub links." : null,
  ].filter(Boolean);

  out.education = [data.education.length === 0 ? "Education section empty." : null].filter(Boolean);

  return out;
}

function bandColor(score0to10) {
  if (score0to10 >= 7.5) return "#22D3A6";
  if (score0to10 >= 5) return "#F5A623";
  return "#F87171";
}

function qualityLabel(score0to10) {
  if (score0to10 >= 9) return "Perfect";
  if (score0to10 >= 7.5) return "Great";
  if (score0to10 >= 6) return "Very Good";
  if (score0to10 >= 5) return "Good";
  return "Needs Work";
}

// ---------- Shared PDF text extraction ----------
async function extractPdfText(file) {
  const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let rawText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    rawText += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return rawText.slice(0, 6000);
}

// ---------- PDF upload + parse: LinkedIn ----------
async function handlePdfUpload(file) {
  const uploadTitle = document.getElementById("uploadTitle");
  uploadTitle.textContent = "Parsing your PDF...";
  document.getElementById("formError").textContent = "";

  try {
    const rawText = await extractPdfText(file);
    const res = await fetch(`${BACKEND_URL}/api/parse-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, mode: "linkedin" }),
    });
    if (!res.ok) throw new Error("Backend error");
    const parsed = await res.json();

    RUBRIC.sections.forEach((s) => {
      profileData[s.key] = parsed[s.key] || "";
    });
    renderForm();
    updateRunButtonState();
    uploadTitle.textContent = `Loaded: ${file.name}`;
  } catch (err) {
    uploadTitle.textContent = "Upload LinkedIn PDF export";
    document.getElementById("formError").textContent =
      "Couldn't parse that PDF. Make sure your backend server is running, or fill sections in manually below.";
  }
}

// ---------- PDF upload + parse: Resume ----------
async function handleResumePdfUpload(file) {
  const uploadTitle = document.getElementById("resumeUploadTitle");
  uploadTitle.textContent = "Parsing your resume...";
  document.getElementById("formError").textContent = "";

  try {
    const rawText = await extractPdfText(file);
    const res = await fetch(`${BACKEND_URL}/api/parse-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, mode: "resume" }),
    });
    if (!res.ok) throw new Error("Backend error");
    const parsed = await res.json();

    RUBRIC.resumeSections.forEach((s) => {
      resumeData[s.key] = parsed[s.key] || "";
    });
    renderResumeForm();
    updateRunButtonState();
    uploadTitle.textContent = `Loaded: ${file.name}`;
  } catch (err) {
    uploadTitle.textContent = "Upload resume PDF";
    document.getElementById("formError").textContent =
      "Couldn't parse that resume PDF. Fill sections in manually below instead.";
  }
}

// ---------- Run full scan across all filled-in pillars ----------
async function runFullScan() {
  const btn = document.getElementById("runScanBtn");
  const errorEl = document.getElementById("formError");
  btn.disabled = true;
  btn.textContent = "Scanning...";
  errorEl.textContent = "";

  document.getElementById("resultsEmpty").classList.add("hidden");
  document.getElementById("resultsContent").classList.add("hidden");
  document.getElementById("resultsLoading").classList.remove("hidden");
  document.getElementById("breakdown").classList.add("hidden");

  const targetRole = getSelectedRole();
  const linkedinFilled = Object.values(profileData).some((v) => v.trim().length > 0);
  const resumeFilled = Object.values(resumeData).some((v) => v.trim().length > 0);
  const githubUsername = (document.getElementById("githubUsernameInput")?.value || "").trim();

  const jobs = {};
  if (linkedinFilled) {
    jobs.linkedin = fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profileData, targetRole }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("linkedin analyze failed"))));
  }
  if (resumeFilled) {
    jobs.resume = fetch(`${BACKEND_URL}/api/analyze-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...resumeData, targetRole }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("resume analyze failed"))));
  }
  if (githubUsername) {
    jobs.github = fetch(`${BACKEND_URL}/api/github-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: githubUsername }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("github score failed"))));
  }

  try {
    const keys = Object.keys(jobs);
    const settled = await Promise.allSettled(Object.values(jobs));
    const pillars = {};
    let anySucceeded = false;
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") {
        pillars[keys[i]] = s.value;
        anySucceeded = true;
      } else {
        pillars[keys[i]] = null;
      }
    });

    if (!anySucceeded) throw new Error("All pillar scans failed");
    renderCombinedResults(pillars);
  } catch (err) {
    errorEl.textContent = "Scan failed. Is your backend server running? Check your GitHub username and try again.";
    document.getElementById("resultsLoading").classList.add("hidden");
    document.getElementById("resultsEmpty").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Full Scan";
  }
}

// ---------- Render combined results across all scanned pillars ----------
function renderCombinedResults(pillars) {
  lastResult = pillars;
  githubResult = pillars.github || null;
  document.getElementById("resultsLoading").classList.add("hidden");
  const resultsContent = document.getElementById("resultsContent");
  resultsContent.classList.remove("hidden");
  resultsContent.classList.remove("fade-in");
  void resultsContent.offsetWidth; // restart animation on repeated scans
  resultsContent.classList.add("fade-in");
  document.getElementById("resultsActions").classList.remove("hidden");

  const weights = RUBRIC.pillarWeights || { linkedin: 0.4, resume: 0.4, github: 0.2 };
  const scoreOf = { linkedin: pillars.linkedin?.overall_score, resume: pillars.resume?.overall_score, github: pillars.github?.score };

  let weightedSum = 0;
  let totalWeight = 0;
  Object.keys(scoreOf).forEach((p) => {
    if (typeof scoreOf[p] === "number") {
      weightedSum += scoreOf[p] * (weights[p] || 0);
      totalWeight += weights[p] || 0;
    }
  });
  const rawScore = totalWeight ? weightedSum / totalWeight : 0; // 0–10 scale
  const score = rawScore * 10; // scale to /100 for display
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const circumference = 2 * Math.PI * 90; // r=90

  document.getElementById("gaugeArc").setAttribute("stroke-dasharray", `${pct * circumference} ${circumference}`);
  animateScoreCountUp(Math.round(score));
  renderScoreStatus(rawScore);
  renderPillarBadges(pillars, scoreOf);

  // ---- Combined priority fixes (round-robin across pillars) ----
  const perPillarFixes = [
    (pillars.linkedin?.top_3_priority_fixes || []).map((f) => ({ tag: "LinkedIn", text: f })),
    (pillars.resume?.top_3_priority_fixes || []).map((f) => ({ tag: "Resume", text: f })),
    (pillars.github?.issues || []).map((f) => ({ tag: "GitHub", text: f })),
  ];
  const combinedFixes = [];
  let round = 0;
  while (combinedFixes.length < 6 && perPillarFixes.some((arr) => arr[round])) {
    perPillarFixes.forEach((arr) => {
      if (arr[round] && combinedFixes.length < 6) combinedFixes.push(arr[round]);
    });
    round++;
  }

  const priorityList = document.getElementById("priorityList");
  priorityList.innerHTML = "";
  combinedFixes.forEach((fix, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="pillar-tag">${fix.tag}</span> ${fix.text}`;
    li.style.animationDelay = `${i * 0.1}s`;
    li.classList.add("fade-in-item");
    priorityList.appendChild(li);
  });

  // ---- Breakdown grid: accumulate cards from every scanned pillar ----
  document.getElementById("breakdownGrid").innerHTML = "";
  if (pillars.linkedin) appendBreakdownCards("LinkedIn", "fa-brands fa-linkedin", RUBRIC.sections, pillars.linkedin.sections || {}, ruleChecks(profileData));
  if (pillars.resume) appendBreakdownCards("Resume", "fa-solid fa-file-lines", RUBRIC.resumeSections, pillars.resume.sections || {}, null);
  if (pillars.github) appendGithubCard(pillars.github);

  renderAtsMatch();
  saveScanToHistory(Math.round(score));
}

// ---------- Pillar sub-score badges above the combined gauge ----------
function renderPillarBadges(pillars, scoreOf) {
  const wrap = document.getElementById("pillarBadges");
  const defs = [
    { key: "linkedin", label: "LinkedIn", icon: "fa-brands fa-linkedin" },
    { key: "resume", label: "Resume", icon: "fa-solid fa-file-lines" },
    { key: "github", label: "GitHub", icon: "fa-brands fa-github" },
  ];

  wrap.innerHTML = defs
    .map((d) => {
      const has = pillars[d.key] && typeof scoreOf[d.key] === "number";
      const val = has ? Math.round(scoreOf[d.key] * 10) : null;
      return `<div class="pillar-badge ${has ? "" : "pillar-badge-empty"}">
        <i class="${d.icon}"></i>
        <span class="pillar-badge-label">${d.label}</span>
        <span class="pillar-badge-score">${has ? val + "/100" : "—"}</span>
      </div>`;
    })
    .join("");
}

// ---------- Status label + star rating under the ring ----------
function renderScoreStatus(rawScore) {
  const labelEl = document.getElementById("gaugeStatusLabel");
  const starsEl = document.getElementById("gaugeStars");

  let label, color;
  if (rawScore >= 8.5) {
    label = "Excellent! 🎉";
    color = "var(--green)";
  } else if (rawScore >= 7) {
    label = "Strong Profile";
    color = "var(--green)";
  } else if (rawScore >= 5) {
    label = "Good, Needs Polish";
    color = "var(--gold)";
  } else {
    label = "Needs Work";
    color = "var(--red)";
  }

  labelEl.textContent = label;
  labelEl.style.color = color;

  const filledStars = Math.max(0, Math.min(5, Math.round(rawScore / 2)));
  starsEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
    i < filledStars ? `<i class="fa-solid fa-star"></i>` : `<i class="fa-solid fa-star star-empty"></i>`
  ).join("");
}

// ---------- Animate the gauge number counting up ----------
function animateScoreCountUp(target) {
  const el = document.getElementById("gaugeScore");
  const duration = 700;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- ATS keyword match, using rubric.json's targetRoleKeywords ----------
function renderAtsMatch() {
  const roleKey = getSelectedRole();
  const roleMeta = (RUBRIC.targetRoles || []).find((r) => r.key === roleKey);
  const keywordSet = (RUBRIC.targetRoleKeywords && RUBRIC.targetRoleKeywords[roleKey]) || [];

  document.getElementById("atsRoleLabel").textContent = roleMeta ? roleMeta.label : "SDE Roles";

  if (!keywordSet.length) {
    document.getElementById("atsMatch").classList.add("hidden");
    return;
  }

  const combinedText = [...Object.values(profileData), ...Object.values(resumeData), ...(githubResult?.topLanguages || [])]
    .join(" ")
    .toLowerCase();
  const matched = keywordSet.filter((kw) => combinedText.includes(kw.toLowerCase()));
  const missing = keywordSet.filter((kw) => !matched.includes(kw));
  const pct = Math.round((matched.length / keywordSet.length) * 100);

  document.getElementById("atsMatch").classList.remove("hidden");
  document.getElementById("atsMatchFill").style.width = `${pct}%`;
  document.getElementById("atsMatchFill").style.background = pct >= 60 ? "#057642" : pct >= 35 ? "#C98A1E" : "#B0290D";
  document.getElementById("atsMatchPct").textContent = `${pct}% match`;

  const matchedEl = document.getElementById("atsMatched");
  matchedEl.innerHTML = matched.map((kw) => `<span class="chip chip-matched">${kw}</span>`).join("");

  const missingEl = document.getElementById("atsMissing");
  missingEl.innerHTML = missing.length
    ? missing.map((kw) => `<span class="chip chip-missing">${kw}</span>`).join("")
    : `<span class="chip chip-matched">All target keywords present 🎉</span>`;
}

// ---------- Scan history (stored locally in this browser) ----------
function saveScanToHistory(score) {
  const history = getScanHistory();
  history.unshift({ score, date: new Date().toISOString() });
  localStorage.setItem("signalCheckHistory", JSON.stringify(history.slice(0, 10)));
  renderScanHistory();
}

function getScanHistory() {
  try {
    return JSON.parse(localStorage.getItem("signalCheckHistory")) || [];
  } catch {
    return [];
  }
}

function renderScanHistory() {
  const history = getScanHistory();
  const listEl = document.getElementById("historyList");
  const panelEl = document.getElementById("historyPanel");

  if (!history.length) {
    panelEl.classList.add("hidden");
    return;
  }
  panelEl.classList.remove("hidden");

  listEl.innerHTML = history
    .map((h, i) => {
      const d = new Date(h.date);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const diff = i < history.length - 1 ? h.score - history[i + 1].score : null;
      const diffHtml =
        diff === null || diff === 0
          ? ""
          : diff > 0
          ? `<span class="history-diff history-diff-up">+${diff}</span>`
          : `<span class="history-diff history-diff-down">${diff}</span>`;
      return `<div class="history-row">
        <span class="history-score">${h.score}/100</span>
        <span class="history-date">${label}</span>
        ${diffHtml}
      </div>`;
    })
    .join("");
}

function appendBreakdownCards(pillarLabel, pillarIcon, sectionDefs, aiSections, flags) {
  const grid = document.getElementById("breakdownGrid");
  document.getElementById("breakdown").classList.remove("hidden");

  sectionDefs.forEach((section) => {
    const ai = aiSections[section.key] || {};
    const card = document.createElement("div");
    card.className = "section-card";

    const scoreColor = ai.score !== undefined ? bandColor(ai.score) : "#7C8798";
    const qualityWord = ai.score !== undefined ? qualityLabel(ai.score) : "";

    card.innerHTML = `
      <div class="section-card-head">
        <span class="section-card-title">
          <span class="section-icon-box"><i class="${ICONS[section.icon]}"></i></span>
          ${section.label} <span class="pillar-tag">${pillarLabel}</span>
        </span>
        ${ai.score !== undefined ? `<span class="section-card-score" style="color:${scoreColor}">${Math.round(ai.score * 10)}/100 <span class="quality-word">${qualityWord}</span></span>` : ""}
      </div>
      ${ai.score !== undefined ? `
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${ai.score * 10}%; background:${scoreColor}"></div>
        </div>` : ""}
      ${flags?.[section.key]?.length ? `<ul class="flags-list">${flags[section.key].map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
      ${ai.issues?.length ? `<ul class="issues-list">${ai.issues.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
      ${ai.strengths?.length ? `<ul class="strengths-list">${ai.strengths.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
      ${ai.rewrite_suggestion ? `<div class="rewrite-box">Suggested rewrite: ${ai.rewrite_suggestion}</div>` : ""}
    `;
    grid.appendChild(card);
  });
}

function appendGithubCard(github) {
  const grid = document.getElementById("breakdownGrid");
  document.getElementById("breakdown").classList.remove("hidden");
  const scoreColor = bandColor(github.score);

  const card = document.createElement("div");
  card.className = "section-card";
  card.innerHTML = `
    <div class="section-card-head">
      <span class="section-card-title">
        <span class="section-icon-box"><i class="fa-brands fa-github"></i></span>
        Profile &amp; Activity <span class="pillar-tag">GitHub</span>
      </span>
      <span class="section-card-score" style="color:${scoreColor}">${Math.round(github.score * 10)}/100 <span class="quality-word">${qualityLabel(github.score)}</span></span>
    </div>
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${github.score * 10}%; background:${scoreColor}"></div></div>
    <div class="field-hint" style="margin-bottom:8px;">${github.publicRepos} public repos · ${github.followers} followers · ${(github.topLanguages || []).join(", ") || "no languages detected"}</div>
    ${github.issues?.length ? `<ul class="issues-list">${github.issues.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
    ${github.strengths?.length ? `<ul class="strengths-list">${github.strengths.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
  `;
  grid.appendChild(card);
}

// ---------- Clear form ----------
function clearForm() {
  RUBRIC.sections.forEach((s) => (profileData[s.key] = ""));
  RUBRIC.resumeSections.forEach((s) => (resumeData[s.key] = ""));
  renderForm();
  renderResumeForm();
  document.getElementById("githubUsernameInput").value = "";
  updateRunButtonState();

  document.getElementById("uploadTitle").textContent = "Upload LinkedIn PDF export";
  document.getElementById("resumeUploadTitle").textContent = "Upload resume PDF";
  document.getElementById("formError").textContent = "";
  document.getElementById("pdfInput").value = "";
  document.getElementById("resumePdfInput").value = "";

  lastResult = null;
  githubResult = null;
  document.getElementById("resultsContent").classList.add("hidden");
  document.getElementById("resultsLoading").classList.add("hidden");
  document.getElementById("resultsActions").classList.add("hidden");
  document.getElementById("resultsEmpty").classList.remove("hidden");
  document.getElementById("breakdown").classList.add("hidden");
  document.getElementById("atsMatch").classList.add("hidden");
}

// ---------- Load example profile ----------
function loadExample() {
  RUBRIC.sections.forEach((s) => (profileData[s.key] = EXAMPLE_PROFILE[s.key] || ""));
  RUBRIC.resumeSections.forEach((s) => (resumeData[s.key] = EXAMPLE_RESUME[s.key] || ""));
  document.getElementById("githubUsernameInput").value = EXAMPLE_GITHUB_USERNAME;
  renderForm();
  renderResumeForm();
  updateRunButtonState();
  document.getElementById("formError").textContent = "";
}

// ---------- Copy results to clipboard ----------
function copyResults() {
  if (!lastResult) return;
  const btn = document.getElementById("copyBtn");
  const original = btn.innerHTML;

  const gauge = document.getElementById("gaugeScore").textContent;
  let text = `Signal Check — Career Profile Report\nCombined Score: ${gauge}/100\n\n`;

  if (lastResult.linkedin) {
    text += `LinkedIn Score: ${Math.round((lastResult.linkedin.overall_score || 0) * 10)}/100\n`;
  }
  if (lastResult.resume) {
    text += `Resume Score: ${Math.round((lastResult.resume.overall_score || 0) * 10)}/100\n`;
  }
  if (lastResult.github) {
    text += `GitHub Score: ${Math.round((lastResult.github.score || 0) * 10)}/100\n`;
  }

  text += `\nPriority Fixes:\n`;
  document.querySelectorAll("#priorityList li").forEach((li, i) => {
    text += `${i + 1}. ${li.textContent}\n`;
  });

  navigator.clipboard
    .writeText(text)
    .then(() => {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
      setTimeout(() => (btn.innerHTML = original), 1500);
    })
    .catch(() => {
      document.getElementById("formError").textContent = "Couldn't copy — try selecting the text manually.";
    });
}

// ---------- Download report as PDF ----------
function downloadReport() {
  if (!lastResult || !window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 20;

  doc.setFontSize(18);
  doc.text("Signal Check — Career Profile Report", marginX, y);
  y += 10;

  doc.setFontSize(13);
  doc.text(`Combined Score: ${document.getElementById("gaugeScore").textContent}/100`, marginX, y);
  y += 8;

  doc.setFontSize(10);
  if (lastResult.linkedin) doc.text(`  LinkedIn: ${Math.round((lastResult.linkedin.overall_score || 0) * 10)}/100`, marginX, (y += 6));
  if (lastResult.resume) doc.text(`  Resume: ${Math.round((lastResult.resume.overall_score || 0) * 10)}/100`, marginX, (y += 6));
  if (lastResult.github) doc.text(`  GitHub: ${Math.round((lastResult.github.score || 0) * 10)}/100`, marginX, (y += 6));
  y += 6;

  doc.setFontSize(14);
  doc.text("Priority Fixes", marginX, y);
  y += 8;
  doc.setFontSize(11);
  document.querySelectorAll("#priorityList li").forEach((li, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${li.textContent}`, pageWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 6 + 2;
  });

  y += 6;
  doc.setFontSize(14);
  doc.text("Section Scores", marginX, y);
  y += 8;
  doc.setFontSize(11);
  if (lastResult.linkedin) {
    RUBRIC.sections.forEach((s) => {
      const sec = (lastResult.linkedin.sections || {})[s.key];
      if (sec && sec.score !== undefined) {
        doc.text(`[LinkedIn] ${s.label}: ${Math.round(sec.score * 10)}/100`, marginX, y);
        y += 7;
      }
    });
  }
  if (lastResult.resume) {
    RUBRIC.resumeSections.forEach((s) => {
      const sec = (lastResult.resume.sections || {})[s.key];
      if (sec && sec.score !== undefined) {
        doc.text(`[Resume] ${s.label}: ${Math.round(sec.score * 10)}/100`, marginX, y);
        y += 7;
      }
    });
  }
  if (lastResult.github) {
    doc.text(`[GitHub] Profile & Activity: ${Math.round((lastResult.github.score || 0) * 10)}/100`, marginX, y);
    y += 7;
  }

  doc.save("signal-check-career-report.pdf");
}

// ---------- Share result as a downloadable image card ----------
function shareResultAsImage() {
  if (!lastResult) return;

  const score = Number(document.getElementById("gaugeScore").textContent) || 0;
  const color = score >= 75 ? "#057642" : score >= 50 ? "#C98A1E" : "#B0290D";
  const W = 800,
    H = 500;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#0A2A4A");
  bgGrad.addColorStop(1, "#0A66C2");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Card
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.fill();

  // Title
  ctx.fillStyle = "#1D2226";
  ctx.font = "700 30px Arial";
  ctx.fillText("Signal Check", 76, 100);
  ctx.font = "400 15px Arial";
  ctx.fillStyle = "#56687A";
  ctx.fillText("Career Profile Report", 76, 125);

  // Score circle
  ctx.beginPath();
  ctx.arc(160, 240, 80, 0, Math.PI * 2);
  ctx.strokeStyle = "#DCE1E6";
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(160, 240, 80, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * score) / 100);
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "700 44px Arial";
  ctx.textAlign = "center";
  ctx.fillText(String(score), 160, 252);
  ctx.font = "400 13px Arial";
  ctx.fillStyle = "#56687A";
  ctx.fillText("/ 100", 160, 272);
  ctx.textAlign = "left";

  // Priority fixes
  ctx.fillStyle = "#1D2226";
  ctx.font = "700 16px Arial";
  ctx.fillText("Top Priority Fixes", 300, 175);

  ctx.font = "400 13px Arial";
  let y = 205;
  const shareFixes = [...document.querySelectorAll("#priorityList li")].slice(0, 3).map((li) => li.textContent);
  shareFixes.forEach((fix, i) => {
    const lines = wrapCanvasText(ctx, `${i + 1}. ${fix}`, 400);
    lines.forEach((line) => {
      ctx.fillText(line, 300, y);
      y += 20;
    });
    y += 8;
  });

  ctx.font = "400 12px Arial";
  ctx.fillStyle = "#8A97A3";
  ctx.fillText("Generated with Signal Check", 76, H - 60);

  const link = document.createElement("a");
  link.download = "signal-check-result.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

// ---------- Event bindings ----------
function bindEvents() {
  document.getElementById("chooseFileBtn").addEventListener("click", () => {
    document.getElementById("pdfInput").click();
  });
  document.getElementById("pdfInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
  });
  document.getElementById("chooseResumeBtn").addEventListener("click", () => {
    document.getElementById("resumePdfInput").click();
  });
  document.getElementById("resumePdfInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleResumePdfUpload(file);
  });
  document.getElementById("githubUsernameInput").addEventListener("input", updateRunButtonState);
  document.getElementById("runScanBtn").addEventListener("click", runFullScan);
  document.getElementById("clearBtn").addEventListener("click", clearForm);
  document.getElementById("exampleBtn").addEventListener("click", loadExample);
  document.getElementById("copyBtn").addEventListener("click", copyResults);
  document.getElementById("downloadBtn").addEventListener("click", downloadReport);
  document.getElementById("shareBtn").addEventListener("click", shareResultAsImage);
}

document.addEventListener("DOMContentLoaded", init);
