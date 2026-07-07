# Bearing

App de finanças pessoais **local-first** para iPhone e Android (Expo + TypeScript): rotação do dinheiro, compras parceladas, dicas de IA e metas financeiras. Nenhum dado financeiro sai do dispositivo — só um resumo agregado, pontual e não armazenado, para gerar dicas.

## Stack

| Camada | Escolha |
| --- | --- |
| Cliente | Expo SDK 54 (React Native + TypeScript), Expo Router |
| Distribuição iOS | Expo Go + EAS Update (sem Mac, sem Apple Developer Program) |
| Distribuição Android | Expo Go, ou APK via EAS Build |
| Dados | `expo-sqlite`, 100% local |
| Segurança | Biometria na abertura (`expo-local-authentication`) |
| Notificações | Lembretes locais de parcela (`expo-notifications`) |
| IA | Cloudflare Worker → Claude API (`claude-haiku-4-5`) |

Detalhes e justificativas em [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

Pré-requisito: [Node.js LTS](https://nodejs.org) (≥ 20).

```bash
npm install        # dependências do app
npx expo start     # inicia o Metro bundler
```

Com o QR code na tela, abra o app **Expo Go** no celular (App Store / Play Store) e escaneie. iPhone e Android usam o mesmo fluxo.

### Worker de IA (opcional para rodar o app; obrigatório para as features de IA)

```bash
cd worker
npm install
npx wrangler secret put ANTHROPIC_API_KEY   # chave do Claude Console
npx wrangler secret put APP_SECRET          # segredo compartilhado com o app
npm run deploy
```

Depois, aponte `expo.extra.aiWorkerUrl` e `expo.extra.aiAppSecret` no [app.json](app.json) para a URL publicada e o mesmo segredo. Configure também o spend limit de US$5 em *Settings > Limits* no Claude Console e a regra de rate limiting (20 req/h por IP) no dashboard da Cloudflare.

## Estrutura de pastas

```text
├── app/                 # Rotas (Expo Router): _layout com biometria + 4 abas
├── src/
│   ├── db/              # schema, migrations e queries (nunca SQL em componente)
│   ├── services/        # aiService (Worker) e notificationService
│   ├── components/      # UI reutilizável (cards, linhas de lista)
│   ├── hooks/           # useTransactions, useInstallments, useGoals, useAiInsight
│   ├── utils/           # aritmética/formatação de dinheiro (sempre centavos)
│   └── types/           # tipos compartilhados
├── worker/              # Cloudflare Worker (proxy stateless → Claude API)
└── docs/                # DATA_MODEL, API_CONTRACTS, AI_PROMPTS e ADRs
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o Expo (`npx expo start`) |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run docs` | Gera documentação navegável (TypeDoc) em `docs/generated/` |
| `npm run deploy` (em `worker/`) | Publica o Worker na Cloudflare |

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — diagrama, decisões e links para os ADRs
- [CONTRIBUTING.md](CONTRIBUTING.md) — convenções de código, commits e documentação
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — schema SQLite e o porquê de cada escolha
- [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) — contrato do Worker de IA
- [docs/AI_PROMPTS.md](docs/AI_PROMPTS.md) — histórico dos prompts de IA
- [CHANGELOG.md](CHANGELOG.md) — histórico de versões
