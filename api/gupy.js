const GUPY_ENDPOINT = "https://employability-portal.gupy.io/api/v1/jobs";
const PAGE_SIZE_MAX = 100;

const HARD_SKILLS = {
  python: ["python"], sql: ["sql", "postgres", "mysql", "oracle"], excel: ["excel", "vba", "planilhas"],
  "power bi": ["power bi", "powerbi", "dax", "power query"], tableau: ["tableau"],
  "gestao de projetos": ["gestao de projetos", "gestão de projetos", "pmo", "project management"],
  "analise de dados": ["analise de dados", "análise de dados", "analytics", "data analysis"],
  "machine learning": ["machine learning", "aprendizado de maquina"], cloud: ["aws", "azure", "gcp", "cloud"],
  etl: ["etl", "elt", "pipeline de dados"], git: ["git", "github", "gitlab"], agile: ["scrum", "kanban", "agile"],
  javascript: ["javascript", "typescript", "node.js"], java: ["java", "spring"], sap: ["sap"],
  crm: ["crm", "salesforce", "hubspot"], "marketing digital": ["marketing digital", "seo", "midia paga"],
  "gestao financeira": ["gestao financeira", "fluxo de caixa", "dre"], legislacao: ["legislacao", "compliance", "lgpd"],
  "atendimento clinico": ["atendimento clinico", "prontuario"]
};

const SOFT_SKILLS = {
  comunicacao: ["comunicacao", "comunicar", "comunicativo"], lideranca: ["lideranca", "liderar", "gestao de pessoas"],
  colaboracao: ["colaboracao", "trabalho em equipe"], proatividade: ["proatividade", "proativo"],
  organizacao: ["organizacao", "organizado"], "pensamento analitico": ["pensamento analitico", "perfil analitico"],
  "resolucao de problemas": ["resolucao de problemas", "solucao de problemas"], autonomia: ["autonomia", "autonomo"],
  adaptabilidade: ["adaptabilidade", "adaptavel", "flexibilidade"],
  "orientacao a resultados": ["orientacao a resultados", "foco em resultados"], negociacao: ["negociacao", "negociar"],
  relacionamento: ["relacionamento", "stakeholders", "interfaces"]
};

const LANGUAGES = { ingles: ["ingles", "english"], espanhol: ["espanhol", "spanish"], portugues: ["portugues", "portuguese"] };
const SENIORITY = {
  estagio: ["estagio", "estagiario"], junior: ["junior", " jr "], pleno: ["pleno", " pl "],
  senior: ["senior", " sr "], especialista: ["especialista", "specialist"], coordenacao: ["coordenador", "coordenacao"],
  gerencia: ["gerente", "gerencia", "manager"], diretoria: ["diretor", "diretora", "head"]
};

const AREAS = {
  "Negócios": ["administr", "comercial", "vendas", "financeir", "contab", "controladoria", "compras", "marketing", "produto", "customer success", "recursos humanos", "recrutamento", "planejamento", "estrateg", "negocios", "business"],
  "Comunicação": ["comunicacao", "jornalismo", "publicidade", "redator", "conteudo", "social media", "design grafico", "relacoes publicas", "audiovisual", "editor", "copywriter", "branding"],
  "Direito": ["direito", "juridic", "advogad", "legal", "contratos", "tributar", "compliance", "paralegal", "lgpd", "regulatorio"],
  "Saúde": ["saude", "medic", "enferm", "farmac", "psicolog", "fisioter", "nutri", "odont", "clinica", "hospital", "biomed", "terapeuta", "prontuario"],
  "Tecnologia": ["tecnologia", "software", "desenvolvedor", "programador", "engenheiro de dados", "cientista de dados", "dados", "devops", "cloud", "infraestrutura", "suporte ti", "seguranca da informacao", "product owner", "ux", "qa", "sistemas", "python", "javascript", "java", "sql"],
  "Politécnica": ["engenharia", "engenheiro", "arquitet", "civil", "mecanica", "eletrica", "eletronica", "producao", "industrial", "manutencao", "automacao", "qualidade", "logistica", "obras", "tecnico", "tecnica"],
  "Humanidades": ["educacao", "educacional", "professor", "pedagog", "docente", "instrutor", "sociolog", "historia", "geografia", "filosofia", "servico social", "ciencias sociais", "bibliotec", "pesquisa academica"]
};

const RESPONSIBILITY_SIGNALS = {
  "Analisar dados e indicadores": ["analisar dados", "analise de dados", "indicadores", "dashboard", "metricas"],
  "Planejar e executar projetos": ["planejar", "planejamento", "gestao de projetos", "projetos", "cronograma"],
  "Gerir processos e rotinas": ["gestao de processos", "gerir processos", "rotinas", "procedimentos", "melhoria continua"],
  "Relacionar-se com clientes": ["clientes", "atendimento", "customer success", "experiencia do cliente"],
  "Articular stakeholders": ["stakeholders", "areas parceiras", "interfaces", "times multidisciplinares"],
  "Liderar pessoas e equipes": ["liderar", "lideranca", "gestao de pessoas", "desenvolver equipe"],
  "Elaborar relatórios e apresentações": ["relatorios", "apresentacoes"],
  "Desenvolver soluções": ["desenvolver solucoes", "desenvolvimento de solucoes", "implementar solucoes", "construir solucoes"],
  "Negociar e apoiar decisões": ["negociar", "negociacao", "tomada de decisao", "apoiar decisoes"],
  "Ensinar e desenvolver pessoas": ["ministrar aulas", "ensinar", "treinamento", "capacitar", "desenvolvimento de pessoas"]
};

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/<[^>]+>/g, " ")
    .toLowerCase().replace(/[^a-z0-9+#./ -]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchTaxonomy(text, taxonomy) {
  const normalized = normalizeText(text);
  return Object.entries(taxonomy).filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeText(alias))))
    .map(([canonical]) => canonical).sort();
}

function classifyArea(title, text) {
  const normalizedTitle = normalizeText(title);
  const normalizedText = normalizeText(text);
  const scores = Object.entries(AREAS).map(([area, aliases]) => [area, aliases.reduce((total, alias) => {
    const term = normalizeText(alias);
    return total + (normalizedTitle.includes(term) ? 5 : 0) + (normalizedText.includes(term) ? 1 : 0);
  }, 0)]).sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "Outras áreas";
}

function compactDescription(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 700);
}

function normalizeJob(raw, query) {
  const title = raw.name || raw.title || "";
  const description = raw.description || "";
  const text = [title, description, raw.responsibilities, raw.requirements].join(" ");
  return {
    source: "gupy", source_id: String(raw.id || raw.jobId || ""), query,
    title, company: raw.careerPageName || raw.companyName || "", city: raw.city || "", state: raw.state || "",
    is_remote: Boolean(raw.isRemoteWork), workplace_type: raw.workplaceType || "", employment_type: raw.type || "",
    published_at: raw.publishedDate || raw.published_date || "", application_deadline: raw.applicationDeadline || "",
    url: raw.jobUrl || raw.url || "", description_excerpt: compactDescription(description), area: classifyArea(title, text),
    hard_skills: matchTaxonomy(text, HARD_SKILLS), soft_skills: matchTaxonomy(text, SOFT_SKILLS),
    languages: matchTaxonomy(text, LANGUAGES), seniority: matchTaxonomy(` ${text} `, SENIORITY),
    responsibility_signals: matchTaxonomy(text, RESPONSIBILITY_SIGNALS), collected_at: new Date().toISOString()
  };
}

export default async function handler(request, response) {
  const query = String(request.query.query || "").trim().slice(0, 120);
  const offset = Math.max(Number(request.query.offset || 0), 0);
  const limit = Math.min(Math.max(Number(request.query.limit || 50), 1), PAGE_SIZE_MAX);
  const params = { offset: String(offset), limit: String(limit) };
  if (query) params.jobName = query;

  try {
    const upstream = await fetch(`${GUPY_ENDPOINT}?${new URLSearchParams(params)}`, { headers: { "user-agent": "JobMarketIntel/0.2" } });
    if (!upstream.ok) return response.status(502).json({ jobs: [], error: `Gupy retornou HTTP ${upstream.status}.` });
    const payload = await upstream.json();
    const jobs = (Array.isArray(payload.data) ? payload.data : []).map((item) => normalizeJob(item, query));
    const total = Number(payload.pagination?.total || jobs.length);
    const nextOffset = offset + jobs.length;
    response.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return response.status(200).json({ jobs, pagination: { total, offset, limit, nextOffset, hasMore: nextOffset < total && jobs.length > 0 } });
  } catch (error) {
    return response.status(502).json({ jobs: [], error: `Falha ao conectar na Gupy: ${error.message}` });
  }
}
