// ---------- Config ----------
const ICONS = {
  type: "fa-solid fa-heading",
  user: "fa-solid fa-user",
  briefcase: "fa-solid fa-briefcase",
  cap: "fa-solid fa-graduation-cap",
  bolt: "fa-solid fa-bolt",
  folder: "fa-solid fa-folder-open",
};

const BACKEND_URL = "http://localhost:3001"; // change to your deployed backend URL in production

let RUBRIC = null;
let profileData = {};

// ---------- Init ----------
async function init() {
  const res = await fetch("rubric.json");
  RUBRIC = await res.json();

  RUBRIC.sections.forEach((s) => (profileData[s.key] = ""));
  renderForm();
  bindEvents();
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
    input.addEventListener("input", (e) => {
      profileData[section.key] = e.target.value;
      updateRunButtonState();
    });

    field.appendChild(label);
    field.appendChild(input);
    form.appendChild(field);
  });
}

function updateRunButtonState() {
  const filledCount = Object.values(profileData).filter((v) => v.trim().length > 0).length;
  document.getElementById("runScanBtn").disabled = filledCount === 0;
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
  document.getElementById("resultsLoading").classList.add("hidden");
  document.getElementById("resultsContent").classList.remove("hidden");

  const score = result.overall_score || 0;
  const color = bandColor(score / 10);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const angle = -90 + pct * 180;
  const rad = (angle * Math.PI) / 180;

  document.getElementById("gaugeArc").setAttribute("stroke-dasharray", `${pct * 283} 283`);
  document.getElementById("gaugeArc").setAttribute("stroke", color);
  document.getElementById("gaugeNeedle").setAttribute("x2", 110 + 68 * Math.cos(rad));
  document.getElementById("gaugeNeedle").setAttribute("y2", 110 + 68 * Math.sin(rad));
  document.getElementById("gaugeScore").textContent = Math.round(score);
  document.getElementById("gaugeScore").style.color = color;

  const priorityList = document.getElementById("priorityList");
  priorityList.innerHTML = "";
  (result.top_3_priority_fixes || []).forEach((fix) => {
    const li = document.createElement("li");
    li.textContent = fix;
    priorityList.appendChild(li);
  });

  renderBreakdown(result.sections || {});
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
        ${ai.score !== undefined ? `<span class="section-card-score" style="color:${scoreColor}">${ai.score}/10</span>` : ""}
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
}

document.addEventListener("DOMContentLoaded", init);
