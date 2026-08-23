const DB_NAME = "job-market-intelligence";
const DB_VERSION = 1;
const STORE_NAME = "jobs";
const AREAS = ["Negócios", "Comunicação", "Direito", "Saúde", "Tecnologia", "Politécnica", "Humanidades", "Outras áreas"];
const TABLE_PAGE_DEFAULT = 50;

let jobs = [];
let tablePage = 1;
let collectionController = null;

const $ = (selector) => document.querySelector(selector);
const els = {
  queryInput: $("#queryInput"), collectionScope: $("#collectionScope"), collectButton: $("#collectButton"),
  stopButton: $("#stopButton"), clearButton: $("#clearButton"), status: $("#status"),
  progressWrap: $("#progressWrap"), progressBar: $("#progressBar"), headerJobs: $("#headerJobs"),
  table: $("#jobsTable"), tableSummary: $("#tableSummary"), tableAreaFilter: $("#tableAreaFilter"),
  tableCompanyFilter: $("#tableCompanyFilter"), tableRemoteFilter: $("#tableRemoteFilter"),
  tableTextFilter: $("#tableTextFilter"), prevPage: $("#prevPage"), nextPage: $("#nextPage"),
  pageInfo: $("#pageInfo"), pageSize: $("#pageSize"), exportCsv: $("#exportCsv"), exportReport: $("#exportReport"),
  analyticsAreaFilter: $("#analyticsAreaFilter"), queryFilter: $("#queryFilter"), companyFilter: $("#companyFilter"),
  remoteFilter: $("#remoteFilter"), weeklyAreaFilter: $("#weeklyAreaFilter"),
  weeklyCompanyFilter: $("#weeklyCompanyFilter"), weeklyRemoteFilter: $("#weeklyRemoteFilter"),
  screenTabs: document.querySelectorAll(".screen-tab"), screens: document.querySelectorAll(".screen")
};

const layoutBase = {
  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
  margin: { l: 66, r: 20, t: 58, b: 48 },
  font: { family: "DM Sans, system-ui, sans-serif", color: "#26352f" },
  colorway: ["#0d6b55", "#7ba83d", "#d3a847", "#557a8c", "#9b6b8d", "#d07058", "#6e8278", "#b8c5bf"]
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "storage_key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadStoredJobs() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function storeJobBatch(batch) {
  if (!batch.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    batch.forEach((job) => store.put(job));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearStoredJobs() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function fingerprint(job) { return [job.source, job.source_id || job.url].join("|").toLowerCase(); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function unique(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR")); }
function formatNumber(value) { return Number(value || 0).toLocaleString("pt-BR"); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "–" : date.toLocaleDateString("pt-BR", { timeZone: "UTC" }); }
function isRemote(job) { return job.is_remote || job.workplace_type === "remote"; }
function employmentLabel(value) { const key = String(value || "").split("_").pop().toLowerCase(); return ({ effective: "Efetivo", entity: "Pessoa Jurídica", pool: "Banco de talentos", associate: "Associado", autonomous: "Autônomo", temporary: "Temporário" })[key] || value || "Não informado"; }
function renderTags(values, area = false) { return (values || []).length ? values.map((value) => `<span class="tag${area ? " area-tag" : ""}">${escapeHtml(value)}</span>`).join("") : '<span class="muted">–</span>'; }
function countBy(items, getter) { const map = new Map(); items.forEach((item) => { const value = getter(item) || "Não informado"; map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function countList(items, key) { const map = new Map(); items.forEach((item) => (item[key] || []).forEach((value) => map.set(value, (map.get(value) || 0) + 1))); return [...map.entries()].sort((a, b) => b[1] - a[1]); }

function matchesRemote(job, value) {
  if (value === "remote") return isRemote(job);
  if (value === "onsite") return !isRemote(job);
  return true;
}

function tableRows() {
  const text = els.tableTextFilter.value.trim().toLocaleLowerCase("pt-BR");
  return jobs.filter((job) => (!els.tableAreaFilter.value || job.area === els.tableAreaFilter.value)
    && (!els.tableCompanyFilter.value || job.company === els.tableCompanyFilter.value)
    && matchesRemote(job, els.tableRemoteFilter.value)
    && (!text || `${job.title} ${job.company}`.toLocaleLowerCase("pt-BR").includes(text)));
}

function analyticsRows() {
  return jobs.filter((job) => (!els.analyticsAreaFilter.value || job.area === els.analyticsAreaFilter.value)
    && (!els.queryFilter.value || (job.query || "Coleta geral") === els.queryFilter.value)
    && (!els.companyFilter.value || job.company === els.companyFilter.value)
    && matchesRemote(job, els.remoteFilter.value));
}

function isLastSevenDays(job) {
  const published = new Date(job.published_at);
  if (Number.isNaN(published.getTime())) return false;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
  return published >= start;
}

function weeklyRows() {
  return jobs.filter((job) => isLastSevenDays(job)
    && (!els.weeklyAreaFilter.value || job.area === els.weeklyAreaFilter.value)
    && (!els.weeklyCompanyFilter.value || job.company === els.weeklyCompanyFilter.value)
    && matchesRemote(job, els.weeklyRemoteFilter.value));
}

function setStatus(message, warn = false) { els.status.textContent = message; els.status.classList.toggle("warn", warn); }
function setProgress(current, total) { const percent = total ? Math.min(100, current / total * 100) : 0; els.progressBar.style.width = `${percent}%`; }

function setOptions(select, values, allLabel) {
  const selected = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(selected)) select.value = selected;
}

function updateFilters() {
  const availableAreas = AREAS.filter((area) => jobs.some((job) => job.area === area));
  [els.tableAreaFilter, els.analyticsAreaFilter, els.weeklyAreaFilter].forEach((select) => setOptions(select, availableAreas, "Todas as áreas"));
  const companies = unique(jobs.map((job) => job.company));
  setOptions(els.tableCompanyFilter, companies, "Todas as empresas");
  setOptions(els.companyFilter, companies, "Todas as empresas");
  setOptions(els.weeklyCompanyFilter, companies, "Todas as empresas");
  setOptions(els.queryFilter, unique(jobs.map((job) => job.query || "Coleta geral")), "Todas as coletas");
}

function renderTable() {
  const rows = tableRows();
  const size = Number(els.pageSize.value || TABLE_PAGE_DEFAULT);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  tablePage = Math.min(Math.max(tablePage, 1), totalPages);
  const start = (tablePage - 1) * size;
  const pageRows = rows.slice(start, start + size);
  els.table.innerHTML = pageRows.map((job) => `<tr>
    <td><a href="${escapeHtml(job.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(job.title || "Não informado")}</a></td>
    <td>${renderTags([job.area || "Outras áreas"], true)}</td><td>${escapeHtml(job.company || "Não informado")}</td>
    <td>${formatDate(job.published_at)}</td><td>${escapeHtml(isRemote(job) ? "Remoto" : [job.city, job.state].filter(Boolean).join(", ") || "Não informado")}</td>
    <td>${escapeHtml(employmentLabel(job.employment_type))}</td><td>${renderTags(job.hard_skills)}</td><td>${renderTags(job.soft_skills)}</td></tr>`).join("");
  els.tableSummary.textContent = `${formatNumber(rows.length)} vagas filtradas · exibindo ${rows.length ? formatNumber(start + 1) : 0}–${formatNumber(Math.min(start + size, rows.length))}`;
  els.pageInfo.textContent = `Página ${formatNumber(tablePage)} de ${formatNumber(totalPages)}`;
  els.prevPage.disabled = tablePage <= 1; els.nextPage.disabled = tablePage >= totalPages;
}

function metricsHtml(rows) {
  const companies = new Set(rows.map((job) => job.company).filter(Boolean)).size;
  const areas = new Set(rows.map((job) => job.area).filter(Boolean)).size;
  const remote = rows.length ? rows.filter(isRemote).length / rows.length * 100 : 0;
  return `<article class="metric-card"><strong>${formatNumber(rows.length)}</strong><span>Vagas analisadas</span></article>
    <article class="metric-card"><strong>${formatNumber(companies)}</strong><span>Empresas distintas</span></article>
    <article class="metric-card"><strong>${remote.toFixed(1)}%</strong><span>Oportunidades remotas</span></article>
    <article class="metric-card"><strong>${formatNumber(areas)}</strong><span>Áreas representadas</span></article>`;
}

function plotEmpty(id, title) { Plotly.react(id, [], { ...layoutBase, title, annotations: [{ text: "Sem dados para os filtros selecionados", showarrow: false }] }, { responsive: true, displayModeBar: false }); }
function plotBar(id, rows, title, horizontal = true, max = 15) {
  if (!rows.length) return plotEmpty(id, title);
  const selected = rows.slice(0, max).reverse();
  Plotly.react(id, [{ type: "bar", orientation: horizontal ? "h" : "v", x: horizontal ? selected.map(([, n]) => n) : selected.map(([label]) => label), y: horizontal ? selected.map(([label]) => label) : selected.map(([, n]) => n), marker: { color: "#0d6b55", cornerradius: 4 } }],
    { ...layoutBase, title, xaxis: { automargin: true }, yaxis: { automargin: true } }, { responsive: true, displayModeBar: false });
}
function plotPie(id, rows, title) { if (!rows.length) return plotEmpty(id, title); Plotly.react(id, [{ type: "pie", labels: rows.map(([x]) => x), values: rows.map(([, n]) => n), hole: .5, textinfo: "percent+label" }], { ...layoutBase, title, showlegend: false }, { responsive: true, displayModeBar: false }); }
function plotTimeline(id, rows, title) {
  const byDate = countBy(rows.filter((job) => job.published_at), (job) => new Date(job.published_at).toISOString().slice(0, 10)).sort((a, b) => a[0].localeCompare(b[0]));
  if (!byDate.length) return plotEmpty(id, title);
  Plotly.react(id, [{ type: "scatter", mode: "lines+markers", x: byDate.map(([x]) => x), y: byDate.map(([, n]) => n), line: { color: "#0d6b55", width: 3 }, marker: { size: 7 } }], { ...layoutBase, title, xaxis: { automargin: true }, yaxis: { automargin: true } }, { responsive: true, displayModeBar: false });
}

function narrativeHtml(rows) {
  if (!rows.length) return '<p>Não há dados suficientes para produzir uma leitura.</p>';
  const area = countBy(rows, (job) => job.area)[0];
  const hard = countList(rows, "hard_skills").slice(0, 3);
  const soft = countList(rows, "soft_skills").slice(0, 3);
  const responsibilities = countList(rows, "responsibility_signals").slice(0, 3);
  const list = [];
  if (area) list.push(`<div class="insight-item"><strong>${escapeHtml(area[0])}</strong> concentra ${((area[1] / rows.length) * 100).toFixed(1)}% das vagas deste recorte.</div>`);
  if (hard.length) list.push(`<div class="insight-item">Hard skills mais presentes: <strong>${hard.map(([x]) => escapeHtml(x)).join(", ")}</strong>.</div>`);
  if (soft.length) list.push(`<div class="insight-item">Nas competências comportamentais, ganham força <strong>${soft.map(([x]) => escapeHtml(x)).join(", ")}</strong>.</div>`);
  if (responsibilities.length) list.push(`<div class="insight-item">As atribuições sinalizam expectativa de <strong>${responsibilities.map(([x]) => escapeHtml(x.toLocaleLowerCase("pt-BR"))).join(", ")}</strong>.</div>`);
  return `<div class="insight-list">${list.join("")}</div>`;
}

function renderAnalytics() {
  const rows = analyticsRows();
  $("#generalMetrics").innerHTML = metricsHtml(rows); $("#generalNarrative").innerHTML = narrativeHtml(rows);
  plotBar("areasChart", countBy(rows, (job) => job.area), "Distribuição das vagas por área");
  plotTimeline("jobsByDate", rows, "Vagas por data de publicação");
  plotBar("hardSkills", countList(rows, "hard_skills"), "Hard skills mais pedidas");
  plotBar("softSkills", countList(rows, "soft_skills"), "Soft skills mais pedidas");
  plotBar("responsibilitiesChart", countList(rows, "responsibility_signals"), "Principais expectativas nas atribuições");
  plotBar("companiesChart", countBy(rows, (job) => job.company), "Empresas com mais vagas");
  plotPie("modalityChart", countBy(rows, (job) => employmentLabel(job.employment_type)), "Modalidade de contratação");
  plotPie("locationPie", countBy(rows, (job) => isRemote(job) ? "Remoto" : job.state), "Distribuição por local");
  plotBar("seniorityChart", countList(rows, "seniority"), "Senioridade percebida", false, 10);
  plotBar("languagesChart", countList(rows, "languages"), "Idiomas citados", false, 10);
}

function renderWeekly() {
  const rows = weeklyRows();
  $("#weeklyMetrics").innerHTML = metricsHtml(rows); $("#weeklyNarrative").innerHTML = narrativeHtml(rows);
  const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6);
  $("#weeklyPeriod").textContent = `${start.toLocaleDateString("pt-BR")} — ${end.toLocaleDateString("pt-BR")}`;
  plotBar("weeklyAreasChart", countBy(rows, (job) => job.area), "Novas vagas por área");
  plotBar("weeklyHardSkills", countList(rows, "hard_skills"), "Hard skills da semana");
  plotBar("weeklySoftSkills", countList(rows, "soft_skills"), "Soft skills da semana");
  plotBar("weeklyResponsibilities", countList(rows, "responsibility_signals"), "Expectativas nas novas vagas");
  plotTimeline("weeklyByDate", rows, "Novas vagas por dia");
  $("#weeklyTable").innerHTML = rows.sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 100).map((job) => `<tr><td><a href="${escapeHtml(job.url)}" target="_blank" rel="noreferrer">${escapeHtml(job.title)}</a></td><td>${renderTags([job.area], true)}</td><td>${escapeHtml(job.company)}</td><td>${formatDate(job.published_at)}</td><td>${escapeHtml(isRemote(job) ? "Remoto" : [job.city, job.state].filter(Boolean).join(", ") || "Não informado")}</td></tr>`).join("");
}

function renderAll() {
  els.headerJobs.textContent = formatNumber(jobs.length); updateFilters(); renderTable(); renderAnalytics(); renderWeekly();
  if (!jobs.length) setStatus("Base local vazia. Faça uma coleta para iniciar.");
  else if (!collectionController) setStatus(`${formatNumber(jobs.length)} vagas disponíveis nesta base local.`);
}

async function fetchPage(query, offset, signal) {
  const response = await fetch(`/api/gupy?query=${encodeURIComponent(query)}&offset=${offset}&limit=100`, { signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
}

async function collectJobs() {
  const query = els.queryInput.value.trim();
  const scope = els.collectionScope.value;
  const scopeLimit = scope === "all" ? Infinity : Number(scope);
  collectionController = new AbortController();
  els.collectButton.disabled = true; els.stopButton.disabled = false; els.progressWrap.hidden = false; setProgress(0, 1);
  const existing = new Map(jobs.map((job) => [fingerprint(job), job]));
  let offset = 0; let total = 0; let inserted = 0; let processed = 0;
  try {
    while (processed < scopeLimit) {
      const payload = await fetchPage(query, offset, collectionController.signal);
      total = Math.min(payload.pagination.total, scopeLimit);
      if (!payload.jobs.length) break;
      const batch = [];
      for (const rawJob of payload.jobs.slice(0, scopeLimit - processed)) {
        const job = { ...rawJob, storage_key: fingerprint(rawJob) };
        if (!existing.has(job.storage_key)) inserted += 1;
        existing.set(job.storage_key, job); batch.push(job);
      }
      await storeJobBatch(batch);
      processed += batch.length; offset = payload.pagination.nextOffset;
      setProgress(processed, total); setStatus(`Coletando ${query || "todas as vagas"}: ${formatNumber(processed)} de ${formatNumber(total)} processadas · ${formatNumber(inserted)} novas.`);
      if (!payload.pagination.hasMore || processed >= scopeLimit) break;
      if (processed % 500 === 0) { jobs = [...existing.values()]; els.headerJobs.textContent = formatNumber(jobs.length); renderTable(); }
    }
    jobs = [...existing.values()]; tablePage = 1; renderAll();
    setStatus(`Coleta concluída: ${formatNumber(processed)} vagas processadas, ${formatNumber(inserted)} novas e ${formatNumber(processed - inserted)} já existentes.`);
  } catch (error) {
    jobs = [...existing.values()]; renderAll();
    setStatus(error.name === "AbortError" ? `Coleta interrompida após ${formatNumber(processed)} vagas. Os lotes concluídos foram preservados.` : `Falha na coleta: ${error.message}. Os lotes já concluídos foram preservados.`, true);
  } finally {
    collectionController = null; els.collectButton.disabled = false; els.stopButton.disabled = true; setTimeout(() => { els.progressWrap.hidden = true; }, 1200);
  }
}

function download(filename, text, type) { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function csvValue(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function exportCsv() {
  const rows = tableRows(); const keys = ["title", "area", "company", "city", "state", "is_remote", "employment_type", "published_at", "query", "hard_skills", "soft_skills", "responsibility_signals", "url"];
  const csv = [keys.join(","), ...rows.map((job) => keys.map((key) => csvValue(Array.isArray(job[key]) ? job[key].join("; ") : job[key])).join(","))].join("\n");
  download("vagas_analisadas.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
}
function exportReport() {
  const rows = analyticsRows(); const top = (items) => items.slice(0, 10).map(([name, total]) => `- ${name}: ${total}`).join("\n") || "- Nenhum sinal encontrado.";
  download("relatorio_mercado_vagas.md", `# Relatório de Mercado de Vagas\n\n## Visão geral\n\n- Vagas: ${rows.length}\n- Empresas: ${new Set(rows.map((x) => x.company)).size}\n\n## Áreas\n\n${top(countBy(rows, (x) => x.area))}\n\n## Hard skills\n\n${top(countList(rows, "hard_skills"))}\n\n## Soft skills\n\n${top(countList(rows, "soft_skills"))}\n\n## Expectativas nas atribuições\n\n${top(countList(rows, "responsibility_signals"))}\n`, "text/markdown;charset=utf-8");
}

function showScreen(id) {
  els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  els.screenTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.screen === id));
  if (id === "analyticsScreen") renderAnalytics(); if (id === "weeklyScreen") renderWeekly();
  requestAnimationFrame(() => document.querySelectorAll(`#${id} .chart`).forEach((chart) => Plotly.Plots.resize(chart)));
}

els.collectButton.addEventListener("click", collectJobs);
els.stopButton.addEventListener("click", () => collectionController?.abort());
els.clearButton.addEventListener("click", async () => { if (!confirm("Remover todas as vagas armazenadas neste navegador?")) return; await clearStoredJobs(); jobs = []; tablePage = 1; renderAll(); });
els.exportCsv.addEventListener("click", exportCsv); els.exportReport.addEventListener("click", exportReport);
[els.tableAreaFilter, els.tableCompanyFilter, els.tableRemoteFilter, els.tableTextFilter, els.pageSize].forEach((control) => control.addEventListener(control.tagName === "INPUT" ? "input" : "change", () => { tablePage = 1; renderTable(); }));
els.prevPage.addEventListener("click", () => { tablePage -= 1; renderTable(); }); els.nextPage.addEventListener("click", () => { tablePage += 1; renderTable(); });
[els.analyticsAreaFilter, els.queryFilter, els.companyFilter, els.remoteFilter].forEach((control) => control.addEventListener("change", renderAnalytics));
[els.weeklyAreaFilter, els.weeklyCompanyFilter, els.weeklyRemoteFilter].forEach((control) => control.addEventListener("change", renderWeekly));
els.screenTabs.forEach((tab) => tab.addEventListener("click", () => showScreen(tab.dataset.screen)));

(async function init() {
  try { jobs = await loadStoredJobs(); renderAll(); }
  catch (error) { setStatus(`Não foi possível abrir a base local: ${error.message}`, true); renderAll(); }
})();
