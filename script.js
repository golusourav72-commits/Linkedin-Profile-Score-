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

let RUBRIC = null;
let profileData = {};
let lastResult = null;

// ---------- Init ----------
async function init() {
  const res = await fetch("/rubric.json");
  RUBRIC = await res.json();

  RUBRIC.sections.forEach((s) => (profileData[s.key] = ""));
  renderForm();
  bindEvents();
  renderScanHistory();
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

// ---------- Sidebar progress indicator ----------
function updateProgress() {
  const total = RUBRIC.sections.length;
  const filled = Object.values(profileData).filter((v) => v.trim().length > 0).length;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  document.getElementById("progressFill").style.width = `${pct}%`;
  document.getElementById("progressLabel").textContent = `${filled}/${total} sections filled`;
}

function updateRunButtonState() {
  const filledCount = Object.values(profileData).filter((v) => v.trim().length > 0).length;
  document.getElementById("runScanBtn").disabled = filledCount === 0;
  updateProgress();
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
  if (score0to10 >= 7.5) return "#35C48F";
  if (score0to10 >= 5) return "#F5A623";
  return "#E5484D";
}

// ---------- PDF upload + parse ----------
async function handlePdfUpload(file) {
  const uploadTitle = document.getElementById("uploadTitle");
  uploadTitle.textContent = "Parsing your PDF...";
  document.getElementById("formError").textContent = "";

  try {
    const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    let rawText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      rawText += content.items.map((it) => it.str).join(" ") + "\n";
    }

    const res = await fetch(`${BACKEND_URL}/api/parse-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: rawText.slice(0, 6000) }),
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

// ---------- Run AI analysis via backend ----------
async function runAnalysis() {
  const btn = document.getElementById("runScanBtn");
  const errorEl = document.getElementById("formError");
  btn.disabled = true;
  btn.textContent = "Scanning...";
  errorEl.textContent = "";

  document.getElementById("resultsEmpty").classList.add("hidden");
  document.getElementById("resultsContent").classList.add("hidden");
  document.getElementById("resultsLoading").classList.remove("hidden");
  document.getElementById("breakdown").classList.add("hidden");

  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    });
    if (!res.ok) throw new Error("Backend error");
    const result = await res.json();
    renderResults(result);
  } catch (err) {
    errorEl.textContent = "Analysis failed. Is your backend server running on " + BACKEND_URL + "?";
    document.getElementById("resultsLoading").classList.add("hidden");
    document.getElementById("resultsEmpty").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Scan";
  }
}

// ---------- Render results ----------
function renderResults(result) {
  lastResult = result;
  document.getElementById("resultsLoading").classList.add("hidden");
  const resultsContent = document.getElementById("resultsContent");
  resultsContent.classList.remove("hidden");
  resultsContent.classList.remove("fade-in");
  void resultsContent.offsetWidth; // restart animation on repeated scans
  resultsContent.classList.add("fade-in");
  document.getElementById("resultsActions").classList.remove("hidden");

  const rawScore = result.overall_score || 0; // 0–10 scale, same as section scores
  const score = rawScore * 10; // scale to /100 for display
  const color = bandColor(rawScore);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const angle = -90 + pct * 180;
  const rad = (angle * Math.PI) / 180;

  document.getElementById("gaugeArc").setAttribute("stroke-dasharray", `${pct * 283} 283`);
  document.getElementById("gaugeArc").setAttribute("stroke", color);
  document.getElementById("gaugeNeedle").setAttribute("x2", 110 + 68 * Math.cos(rad));
  document.getElementById("gaugeNeedle").setAttribute("y2", 110 + 68 * Math.sin(rad));
  document.getElementById("gaugeScore").style.color = color;
  animateScoreCountUp(Math.round(score));

  const priorityList = document.getElementById("priorityList");
  priorityList.innerHTML = "";
  (result.top_3_priority_fixes || []).forEach((fix, i) => {
    const li = document.createElement("li");
    li.textContent = fix;
    li.style.animationDelay = `${i * 0.12}s`;
    li.classList.add("fade-in-item");
    priorityList.appendChild(li);
  });

  renderBreakdown(result.sections || {});
  renderAtsMatch();
  saveScanToHistory(Math.round(score));
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
  const keywordSet = (RUBRIC.targetRoleKeywords && RUBRIC.targetRoleKeywords.sde) || [];
  if (!keywordSet.length) {
    document.getElementById("atsMatch").classList.add("hidden");
    return;
  }

  const combinedText = Object.values(profileData).join(" ").toLowerCase();
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

function renderBreakdown(aiSections) {
  const flags = ruleChecks(profileData);
  const grid = document.getElementById("breakdownGrid");
  grid.innerHTML = "";
  document.getElementById("breakdown").classList.remove("hidden");

  RUBRIC.sections.forEach((section) => {
    const ai = aiSections[section.key] || {};
    const card = document.createElement("div");
    card.className = "section-card";

    const scoreColor = ai.score !== undefined ? bandColor(ai.score) : "#7C8798";

    card.innerHTML = `
      <div class="section-card-head">
        <span class="section-card-title">
          <span class="section-icon-box"><i class="${ICONS[section.icon]}"></i></span>
          ${section.label}
        </span>
        ${ai.score !== undefined ? `<span class="section-card-score" style="color:${scoreColor}">${Math.round(ai.score * 10)}/100</span>` : ""}
      </div>
      ${ai.score !== undefined ? `
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${ai.score * 10}%; background:${scoreColor}"></div>
        </div>` : ""}
      ${flags[section.key]?.length ? `<ul class="flags-list">${flags[section.key].map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
      ${ai.issues?.length ? `<ul class="issues-list">${ai.issues.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
      ${ai.strengths?.length ? `<ul class="strengths-list">${ai.strengths.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
      ${ai.rewrite_suggestion ? `<div class="rewrite-box">Suggested rewrite: ${ai.rewrite_suggestion}</div>` : ""}
    `;
    grid.appendChild(card);
  });
}

// ---------- Clear form ----------
function clearForm() {
  RUBRIC.sections.forEach((s) => (profileData[s.key] = ""));
  renderForm();
  updateRunButtonState();

  document.getElementById("uploadTitle").textContent = "Upload LinkedIn PDF export";
  document.getElementById("formError").textContent = "";
  document.getElementById("pdfInput").value = "";

  lastResult = null;
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
  renderForm();
  updateRunButtonState();
  document.getElementById("formError").textContent = "";
}

// ---------- Copy results to clipboard ----------
function copyResults() {
  if (!lastResult) return;
  const btn = document.getElementById("copyBtn");
  const original = btn.innerHTML;

  let text = `Signal Check Report\nOverall Score: ${Math.round((lastResult.overall_score || 0) * 10)}/100\n\n`;
  text += `Priority Fixes:\n`;
  (lastResult.top_3_priority_fixes || []).forEach((f, i) => {
    text += `${i + 1}. ${f}\n`;
  });
  text += `\nSection Scores:\n`;
  RUBRIC.sections.forEach((s) => {
    const sec = (lastResult.sections || {})[s.key];
    if (sec && sec.score !== undefined) {
      text += `${s.label}: ${Math.round(sec.score * 10)}/100\n`;
    }
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
  doc.text("Signal Check — LinkedIn Profile Report", marginX, y);
  y += 10;

  doc.setFontSize(13);
  doc.text(`Overall Score: ${Math.round((lastResult.overall_score || 0) * 10)}/100`, marginX, y);
  y += 10;

  doc.setFontSize(14);
  doc.text("Priority Fixes", marginX, y);
  y += 8;
  doc.setFontSize(11);
  (lastResult.top_3_priority_fixes || []).forEach((f, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${f}`, pageWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 6 + 2;
  });

  y += 6;
  doc.setFontSize(14);
  doc.text("Section Scores", marginX, y);
  y += 8;
  doc.setFontSize(11);
  RUBRIC.sections.forEach((s) => {
    const sec = (lastResult.sections || {})[s.key];
    if (sec && sec.score !== undefined) {
      doc.text(`${s.label}: ${Math.round(sec.score * 10)}/100`, marginX, y);
      y += 7;
    }
  });

  doc.save("signal-check-report.pdf");
}

// ---------- Share result as a downloadable image card ----------
function shareResultAsImage() {
  if (!lastResult) return;

  const score = Math.round((lastResult.overall_score || 0) * 10);
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
  ctx.fillText("LinkedIn Profile Report", 76, 125);

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
  (lastResult.top_3_priority_fixes || []).slice(0, 3).forEach((fix, i) => {
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
  document.getElementById("runScanBtn").addEventListener("click", runAnalysis);
  document.getElementById("clearBtn").addEventListener("click", clearForm);
  document.getElementById("exampleBtn").addEventListener("click", loadExample);
  document.getElementById("copyBtn").addEventListener("click", copyResults);
  document.getElementById("downloadBtn").addEventListener("click", downloadReport);
  document.getElementById("shareBtn").addEventListener("click", shareResultAsImage);
}

document.addEventListener("DOMContentLoaded", init);
