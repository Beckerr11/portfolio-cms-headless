# Portfolio CMS Headless

![CI](https://github.com/Beckerr11/portfolio-cms-headless/actions/workflows/ci.yml/badge.svg)

Pequeno CMS headless construído com APIs nativas do Node.js para demonstrar **contrato HTTP, separação entre conteúdo público e rascunho, sessão administrativa e preview temporário** sem esconder a lógica atrás de um framework.

## O que está implementado

- login administrativo baseado em credenciais configuráveis;
- sessões administrativas mantidas no store da aplicação;
- CRUD de projetos e posts;
- slugs únicos gerados automaticamente;
- conteúdo publicado separado de drafts;
- preview de drafts por token temporário;
- TTL configurável e revogação de preview tokens;
- filtro `updatedAfter` para leituras incrementais;
- limite de 1 MB para payload JSON;
- health check em `/health`;
- testes com o runner nativo `node:test`;
- CI e Dependabot.

## Decisões de arquitetura

O projeto usa `node:http` e um store **em memória** de propósito. Isso mantém o exemplo pequeno e torna o comportamento fácil de inspecionar e testar.

```text
HTTP request
    ↓
Node.js http server
    ↓
admin/public routing
    ↓
in-memory CMS store
    ↓
projects · posts · sessions · preview tokens
```

Essa escolha também define um limite importante: reiniciar o processo apaga conteúdo e sessões. O repositório não deve ser confundido com um CMS persistente pronto para produção.

## Segurança e limites explícitos

As credenciais padrão existentes no modo local são apenas conveniência de demonstração. Antes de qualquer deploy, configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` com valores próprios e não reutilize credenciais reais de outros serviços.

O token de sessão e os preview tokens são identificadores aleatórios mantidos apenas em memória. O projeto não implementa banco persistente, RBAC avançado, hashing de senha, rate limiting distribuído ou gestão de segredos de produção.

Esses limites são deliberadamente documentados para separar **capacidade implementada** de **evolução futura**.

## API principal

### Administração

- `POST /admin/login`
- `POST /admin/projects`
- `PATCH /admin/projects/:id`
- `DELETE /admin/projects/:id`
- `POST /admin/posts`
- `PATCH /admin/posts/:id`
- `DELETE /admin/posts/:id`
- `POST /admin/preview-tokens`
- `GET /admin/preview-tokens`
- `DELETE /admin/preview-tokens/:token`

### Conteúdo

- `GET /api/projects`
- `GET /api/projects/:slug`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /health`

`previewToken` permite incluir drafts enquanto o token estiver válido. `updatedAfter` filtra coleções pela data de atualização.

## Como executar

```bash
npm ci
npm test
npm run dev
```

O servidor usa a porta `3000` por padrão ou `PORT` quando configurado.

## Variáveis úteis

```env
PORT=3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-local-demo-password
PREVIEW_TOKEN_TTL_MINUTES=30
```

## O que os testes comprovam

A suíte atual cobre o fluxo central de administração e leitura pública: criação e atualização de conteúdo, geração de slugs distintos, publicação, leitura pública, preview de drafts e revogação de preview token.

## Próximas evoluções coerentes

- adapter persistente para banco de dados;
- hashing de credenciais e sessão persistente;
- rate limiting e proteção contra abuso;
- logs estruturados e métricas;
- deploy público reproduzível.

## Documentação complementar

- [Guia de deploy](docs/DEPLOY.md)
- [Roadmap](docs/ROADMAP.md)
- [Checklist de produção](docs/PRODUCTION-CHECKLIST.md)
- [Contribuição](CONTRIBUTING.md)
- [Segurança](SECURITY.md)

## Autor

**Douglas Silva** · [GitHub](https://github.com/Beckerr11) · [Portfólio](https://douglasdev.tech)
