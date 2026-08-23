const GUPY_ENDPOINT = "https://employability-portal.gupy.io/api/v1/jobs";

const HARD_SKILLS = {
  python: ["python"],
  sql: ["sql", "postgres", "postgresql", "mysql", "sql server", "oracle"],
  excel: ["excel", "vba", "planilhas"],
  "power bi": ["power bi", "powerbi", "dax", "power query"],
  tableau: ["tableau"],
  looker: ["looker", "looker studio", "data studio"],
  pandas: ["pandas"],
  numpy: ["numpy"],
  spark: ["spark", "pyspark", "databricks"],
  aws: ["aws", "amazon web services", "s3", "lambda", "redshift"],
  azure: ["azure", "synapse", "data factory"],
  gcp: ["gcp", "google cloud", "bigquery"],
  "machine learning": ["machine learning", "ml", "aprendizado de maquina"],
  estatistica: ["estatistica", "estatística", "testes estatisticos", "testes estatísticos"],
  etl: ["etl", "elt", "pipeline de dados", "pipelines de dados"],
  git: ["git", "github", "gitlab", "versionamento"],
  scrum: ["scrum", "kanban", "agile", "metodologias ageis", "metodologias ágeis"],
  javascript: ["javascript", "typescript", "node.js", "nodejs"],
  java: ["java", "spring"],
  sap: ["sap"],
  crm: ["crm", "salesforce", "hubspot"]
};

const SOFT_SKILLS = {
  comunicacao: ["comunicacao", "comunicação", "comunicar", "comunicativo", "comunicativa"],
  lideranca: ["lideranca", "liderança", "liderar", "gestao de pessoas", "gestão de pessoas"],
  colaboracao: ["colaboracao", "colaboração", "colaborativo", "colaborativa", "trabalho em equipe"],
  proatividade: ["proatividade", "proativo", "proativa"],
  organizacao: ["organizacao", "organização", "organizado", "organizada"],
  "pensamento analitico": ["pensamento analitico", "pensamento analítico", "perfil analitico", "visao analitica"],
  "resolucao de problemas": ["resolucao de problemas", "resolução de problemas", "solucao de problemas", "solução de problemas"],
  autonomia: ["autonomia", "autonomo", "autônomo", "autonoma", "autônoma"],
  adaptabilidade: ["adaptabilidade", "adaptavel", "adaptável", "flexibilidade"],
  "orientacao a resultados": ["orientacao a resultados", "orientação a resultados", "foco em resultados"],
  negociacao: ["negociacao", "negociação", "negociar"],
  relacionamento: ["relacionamento", "stakeholders", "interfaces"]
};

const LANGUAGES = {
  ingles: ["ingles", "inglês", "english"],
  espanhol: ["espanhol", "spanish"],
  portugues: ["portugues", "português", "portuguese"]
};

const SENIORITY = {
  estagio: ["estagio", "estágio", "estagiario", "estagiário", "estagiaria", "estagiária"],
  junior: ["junior", "júnior", "jr"],
  pleno: ["pleno", "pl"],
  senior: ["senior", "sênior", "sr"],
  especialista: ["especialista", "specialist"],
  coordenacao: ["coordenador", "coordenadora", "coordenacao", "coordenação"],
  gerencia: ["gerente", "gerencia", "gerência", "manager"]
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTaxonomy(text, taxonomy) {
  const normalized = normalizeText(text);
  return Object.entries(taxonomy)
    .filter(([, aliases]) =>
      aliases.some((alias) => {
        const escaped = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalized);
      })
    )
    .map(([canonical]) => canonical)
    .sort();
}

function normalizeJob(raw, query) {
  const title = raw.name || raw.title || "";
  const company = raw.careerPageName || raw.companyName || "";
  const description = raw.description || "";
  const text = [title, description, raw.responsibilities, raw.requirements].join(" ");
  return {
    source: "gupy",
    source_id: String(raw.id || raw.jobId || ""),
    query,
    title,
    company,
    city: raw.city || "",
    state: raw.state || "",
    is_remote: Boolean(raw.isRemoteWork),
    employment_type: raw.type || "",
    published_at: raw.publishedDate || raw.published_date || "",
    application_deadline: raw.applicationDeadline || raw.application_deadline || "",
    url: raw.jobUrl || raw.url || "",
    description,
    hard_skills: matchTaxonomy(text, HARD_SKILLS),
    soft_skills: matchTaxonomy(text, SOFT_SKILLS),
    languages: matchTaxonomy(text, LANGUAGES),
    seniority: matchTaxonomy(text, SENIORITY),
    collected_at: new Date().toISOString()
  };
}

export default async function handler(request, response) {
  const query = String(request.query.query || "analista de dados").slice(0, 120);
  const limit = Math.min(Math.max(Number(request.query.limit || 50), 1), 300);
  const jobs = [];
  const errors = [];
  let offset = 0;

  while (jobs.length < limit) {
    const pageLimit = Math.min(50, limit - jobs.length);
    const url = `${GUPY_ENDPOINT}?${new URLSearchParams({ jobName: query, offset: String(offset), limit: String(pageLimit) })}`;
    let upstream;
    try {
      upstream = await fetch(url, { headers: { "user-agent": "JobMarketIntel/0.1" } });
    } catch (error) {
      errors.push(`Falha ao conectar na Gupy: ${error.message}`);
      break;
    }

    if (!upstream.ok) {
      errors.push(`Gupy retornou HTTP ${upstream.status}.`);
      break;
    }

    const payload = await upstream.json();
    const batch = Array.isArray(payload.data) ? payload.data : [];
    if (!batch.length) break;

    jobs.push(...batch.map((item) => normalizeJob(item, query)));
    offset += batch.length;
    if (batch.length < pageLimit) break;
  }

  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  response.status(200).json({ jobs: jobs.slice(0, limit), errors });
}
