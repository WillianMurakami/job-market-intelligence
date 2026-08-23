const STORAGE_KEY = "job-market-intel.jobs.v1";
const STOPWORDS = new Set([
  "vaga", "vagas", "trabalho", "empresa", "projeto", "experiencia", "responsavel",
  "atividades", "requisitos", "realizar", "desejavel", "minimo", "area", "areas",
  "anos", "nivel", "pessoa", "profissional", "processo", "relacionados", "informacoes",
  "outros", "possuir", "candidato", "atuar", "conhecimento", "dominio", "solido",
  "avancado", "familiaridade", "tecnico", "analitico", "proficiente", "essencial",
  "importante", "capacidade", "habilidade", "excelente", "fundamental", "competencia",
  "superior", "ambiente", "colaboradores", "colaborador", "garantindo", "sera",
  "beneficios", "trabalhar", "visando", "utilizacao", "solucao", "implementacao",
  "integracao", "desenvolvimento", "servico", "sistema", "tecnologia", "plataforma",
  "software", "aplicativo", "programa", "time", "estamos", "garantir", "acoes",
  "oportunidades", "voce", "nossos", "nosso", "rotinas", "rotina", "parte", "dados",
  "controle", "clientes", "todos", "equipe", "aqui", "sobre", "tambem", "apoio",
  "cada", "sempre", "setor", "indicadores", "meio", "seguranca", "valores", "todas",
  "formas", "analise", "relacionadas", "pela", "pelo", "demandas", "crescimento",
  "ferramentas", "acesso", "plano", "profissionais", "como", "nossa", "pessoas",
  "suas", "seus", "forma", "saude", "diversas", "formacao", "junto", "pode",
  "atraves", "somos", "quando", "quanto", "temos", "buscamos", "conforme", "entre",
  "conhecimentos", "ensino", "venha", "seja", "nossas", "grupo", "melhor", "dentro",
  "alem", "outras", "diferentes", "incluindo", "nova", "novas", "novo", "novos", "brasil"
]);

let jobs = loadJobs();

const els = {
  queryInput: document.querySelector("#queryInput"),
  limitInput: document.querySelector("#limitInput"),
  collectButton: document.querySelector("#collectButton"),
  clearButton: document.querySelector("#clearButton"),
  exportCsv: document.querySelector("#exportCsv"),
  exportReport: document.querySelector("#exportReport"),
  status: document.querySelector("#status"),
  queryFilter: document.querySelector("#queryFilter"),
  companyFilter: document.querySelector("#companyFilter"),
  remoteFilter: document.querySelector("#remoteFilter"),
  table: document.querySelector("#jobsTable"),
  screenTabs: document.querySelectorAll(".screen-tab"),
  screens: document.querySelectorAll(".screen")
};

const layoutBase = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  margin: { l: 70, r: 24, t: 58, b: 48 },
  font: { family: "Inter, system-ui, sans-serif", color: "#1d2430" }
};

function loadJobs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveJobs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function fingerprint(job) {
  return [job.source, job.source_id, job.company, job.title, job.url].join("|").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function countBy(items, getter) {
  const counts = new Map();
  for (const item of items) {
    const value = getter(item) || "Nao informado";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function countList(items, key) {
  const counts = new Map();
  for (const item of items) {
    for (const value of item[key] || []) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function employmentLabel(value) {
  const key = String(value || "").split("_").pop().toLowerCase();
  return {
    effective: "Efetivo",
    entity: "Pessoa Juridica",
    pool: "Banco de talentos",
    associate: "Associado",
    autonomous: "Autonomo",
    temporary: "Temporario"
  }[key] || value || "Nao informado";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function daysOpen(value) {
  if (!value) return "-";
  const published = new Date(value);
  if (Number.isNaN(published.getTime())) return "-";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  published.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - published) / 86400000));
}

function renderTags(values) {
  const list = values || [];
  if (!list.length) return '<span class="muted">-</span>';
  return list.map((value) => `<span class="tag">${value}</span>`).join("");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
}

function relevantTerms(items) {
  const counts = new Map();
  const text = normalizeText(items.map((job) => job.description || "").join(" "));
  const words = text.match(/[a-z0-9+#.]{4,}/g) || [];
  for (const word of words) {
    if (!STOPWORDS.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 75);
}

function currentRows() {
  return jobs.filter((job) => {
    const query = els.queryFilter.value;
    const company = els.companyFilter.value;
    const remote = els.remoteFilter.value;
    if (query && job.query !== query) return false;
    if (company && job.company !== company) return false;
    if (remote === "remote" && !job.is_remote) return false;
    if (remote === "onsite" && job.is_remote) return false;
    return true;
  });
}

function setStatus(message, warn = false) {
  els.status.textContent = message;
  els.status.classList.toggle("warn", warn);
}

function showScreen(screenId) {
  els.screens.forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });
  els.screenTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.screen === screenId);
  });
  if (screenId === "analyticsScreen") {
    requestAnimationFrame(() => {
      document.querySelectorAll(".chart").forEach((chart) => Plotly.Plots.resize(chart));
    });
  }
}

function updateFilters() {
  const selectedQuery = els.queryFilter.value;
  const selectedCompany = els.companyFilter.value;
  els.queryFilter.innerHTML = `<option value="">Todas</option>${unique(jobs.map((job) => job.query)).map((value) => `<option>${value}</option>`).join("")}`;
  els.companyFilter.innerHTML = `<option value="">Todas</option>${unique(jobs.map((job) => job.company)).map((value) => `<option>${value}</option>`).join("")}`;
  els.queryFilter.value = selectedQuery;
  els.companyFilter.value = selectedCompany;
}

function plotEmpty(id, title) {
  Plotly.react(id, [], { ...layoutBase, title, annotations: [{ text: "Sem dados", showarrow: false }] }, { responsive: true, displayModeBar: false });
}

function plotBar(id, rows, title, xTitle, yTitle, horizontal = true) {
  if (!rows.length) return plotEmpty(id, title);
  const labels = rows.slice(0, 20).map(([label]) => label).reverse();
  const values = rows.slice(0, 20).map(([, value]) => value).reverse();
  Plotly.react(id, [{
    type: "bar",
    orientation: horizontal ? "h" : "v",
    x: horizontal ? values : labels,
    y: horizontal ? labels : values,
    marker: { color: "#126f63" }
  }], { ...layoutBase, title, xaxis: { title: xTitle }, yaxis: { title: yTitle, automargin: true } }, { responsive: true, displayModeBar: false });
}

function plotPie(id, rows, title) {
  if (!rows.length) return plotEmpty(id, title);
  Plotly.react(id, [{ type: "pie", labels: rows.map(([label]) => label), values: rows.map(([, value]) => value), hole: 0.36 }], { ...layoutBase, title }, { responsive: true, displayModeBar: false });
}

function render() {
  updateFilters();
  const rows = currentRows();
  const companies = new Set(rows.map((job) => job.company).filter(Boolean));
  const sources = new Set(rows.map((job) => job.source).filter(Boolean));
  document.querySelector("#metricJobs").textContent = rows.length;
  document.querySelector("#metricCompanies").textContent = companies.size;
  document.querySelector("#metricRemote").textContent = `${rows.length ? (rows.filter((job) => job.is_remote).length / rows.length * 100).toFixed(1) : 0}%`;
  document.querySelector("#metricSources").textContent = sources.size;

  if (!jobs.length) {
    setStatus("Base local vazia. Faca uma coleta para iniciar.");
  } else {
    setStatus(`${rows.length} vagas exibidas de ${jobs.length} salvas neste navegador.`);
  }

  const byDate = countBy(rows.filter((job) => job.published_at), (job) => new Date(job.published_at).toISOString().slice(0, 10)).sort((a, b) => a[0].localeCompare(b[0]));
  Plotly.react("jobsByDate", [{
    type: "scatter",
    mode: "lines+markers",
    x: byDate.map(([date]) => date),
    y: byDate.map(([, total]) => total),
    line: { color: "#126f63", width: 3 }
  }], { ...layoutBase, title: "Vagas por data de publicacao", xaxis: { title: "Data" }, yaxis: { title: "Vagas" } }, { responsive: true, displayModeBar: false });

  plotBar("hardSkills", countList(rows, "hard_skills"), "Hard skills mais pedidas", "Vagas", "Hard skill");
  plotBar("softSkills", countList(rows, "soft_skills"), "Soft skills mais pedidas", "Vagas", "Soft skill");
  plotBar("companiesChart", countBy(rows, (job) => job.company).slice(0, 16), "Vagas por empresas", "Vagas", "Empresa");
  plotPie("modalityChart", countBy(rows, (job) => employmentLabel(job.employment_type)), "Modalidade de contratacao");
  plotPie("locationPie", countBy(rows, (job) => job.is_remote ? "Remoto" : job.state || "Nao informado"), "Distribuicao por local");
  plotBar("seniorityChart", countList(rows, "seniority"), "Senioridade percebida", "Vagas", "Senioridade", false);
  plotBar("languagesChart", countList(rows, "languages"), "Idiomas citados", "Vagas", "Idioma", false);

  const stateCityRows = rows.map((job) => ({
    state: job.is_remote ? "Remoto" : job.state || "Nao informado",
    city: job.is_remote ? "Remoto" : job.city || "Nao informado"
  }));
  const stateCity = countBy(stateCityRows, (item) => `${item.state}|${item.city}`);
  Plotly.react("stateCityChart", [{
    type: "sunburst",
    labels: ["Vagas", ...stateCity.flatMap(([key]) => key.split("|"))],
    parents: ["", ...stateCity.flatMap(([key]) => {
      const [state] = key.split("|");
      return ["Vagas", state];
    })],
    values: [rows.length, ...stateCity.flatMap(([, value]) => [value, value])],
    branchvalues: "total"
  }], { ...layoutBase, title: "Distribuicao por estado e cidade" }, { responsive: true, displayModeBar: false });

  const terms = relevantTerms(rows);
  Plotly.react("termsTreemap", [{
    type: "treemap",
    labels: terms.map(([label]) => label),
    parents: terms.map(() => ""),
    values: terms.map(([, value]) => value),
    marker: { colorscale: "Teal" }
  }], { ...layoutBase, title: "Principais caracteristicas requeridas" }, { responsive: true, displayModeBar: false });

  els.table.innerHTML = rows.slice(0, 200).map((job) => `
    <tr>
      <td><a href="${job.url || "#"}" target="_blank" rel="noreferrer">${job.title || "Nao informado"}</a></td>
      <td>${job.company || "Nao informado"}</td>
      <td>${formatDate(job.published_at)}</td>
      <td>${daysOpen(job.published_at)}</td>
      <td>${job.is_remote ? "Remoto" : [job.city, job.state].filter(Boolean).join(", ") || "Nao informado"}</td>
      <td>${employmentLabel(job.employment_type)}</td>
      <td class="tags-cell">${renderTags(job.hard_skills)}</td>
      <td class="tags-cell">${renderTags(job.soft_skills)}</td>
    </tr>
  `).join("");
}

async function collectJobs() {
  const query = els.queryInput.value.trim();
  const limit = Number(els.limitInput.value || 80);
  els.collectButton.disabled = true;
  setStatus("Coletando vagas da Gupy...");
  try {
    const response = await fetch(`/api/gupy?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}`);
    const payload = await response.json();
    const existing = new Set(jobs.map(fingerprint));
    let inserted = 0;
    for (const job of payload.jobs || []) {
      const key = fingerprint(job);
      if (!existing.has(key)) {
        jobs.push(job);
        existing.add(key);
        inserted += 1;
      }
    }
    saveJobs();
    setStatus(`${inserted} vagas novas salvas. ${(payload.jobs || []).length - inserted} duplicadas ignoradas.${payload.errors?.length ? ` ${payload.errors.join(" ")}` : ""}`, Boolean(payload.errors?.length));
    render();
  } catch (error) {
    setStatus(`Falha na coleta: ${error.message}`, true);
  } finally {
    els.collectButton.disabled = false;
  }
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = currentRows();
  const header = ["title", "company", "city", "state", "is_remote", "employment_type", "published_at", "query", "hard_skills", "soft_skills", "url"];
  const csv = [header.join(","), ...rows.map((job) => header.map((key) => csvValue(Array.isArray(job[key]) ? job[key].join("; ") : job[key])).join(","))].join("\n");
  download("vagas_analisadas.csv", csv, "text/csv");
}

function exportReport() {
  const rows = currentRows();
  const top = (items) => items.slice(0, 10).map(([name, total]) => `- ${name}: ${total}`).join("\n") || "- Nenhum sinal encontrado.";
  const report = `# Relatorio de Mercado de Vagas

## Visao geral

- Total de vagas analisadas: ${rows.length}
- Empresas distintas: ${new Set(rows.map((job) => job.company).filter(Boolean)).size}
- Percentual remoto: ${rows.length ? (rows.filter((job) => job.is_remote).length / rows.length * 100).toFixed(1) : 0}%

## Hard skills mais citadas

${top(countList(rows, "hard_skills"))}

## Soft skills mais citadas

${top(countList(rows, "soft_skills"))}

## Empresas com mais vagas

${top(countBy(rows, (job) => job.company))}
`;
  download("relatorio_mercado_vagas.md", report, "text/markdown");
}

els.collectButton.addEventListener("click", collectJobs);
els.clearButton.addEventListener("click", () => {
  jobs = [];
  saveJobs();
  render();
});
els.exportCsv.addEventListener("click", exportCsv);
els.exportReport.addEventListener("click", exportReport);
els.queryFilter.addEventListener("change", render);
els.companyFilter.addEventListener("change", render);
els.remoteFilter.addEventListener("change", render);
els.screenTabs.forEach((tab) => {
  tab.addEventListener("click", () => showScreen(tab.dataset.screen));
});

render();
