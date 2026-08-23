# Job Market Intelligence

Aplicativo web para coletar vagas, analisar demandas do mercado e gerar leituras sobre hard skills, soft skills, senioridade, idiomas, empresas e localizacao.

## Versao web

A raiz do projeto contem a versao preparada para Vercel:

- `index.html`
- `assets/app.js`
- `assets/styles.css`
- `api/gupy.js`
- `vercel.json`

Ela nao depende de Streamlit em producao. A coleta Gupy roda por uma funcao serverless em `/api/gupy`, e os dados ficam salvos no navegador nesta primeira versao.

## Deploy na Vercel

1. Acesse o dashboard da Vercel.
2. Clique em **Add New > Project**.
3. Importe o repo `WillianMurakami/job-market-intelligence`.
4. Mantenha as configuracoes padrao.
5. Deploy.

Build command: `npm run build`

Output directory: deixe vazio/padrao.

## Graficos incluidos

- Vagas por data de publicacao
- Hard skills mais pedidas
- Soft skills mais pedidas
- Empresas com mais vagas
- Modalidade de contratacao
- Distribuicao por local
- Distribuicao por estado e cidade
- Senioridade percebida
- Idiomas citados
- Principais caracteristicas requeridas
