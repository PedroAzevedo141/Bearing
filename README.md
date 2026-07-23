# Bearing

App de finanças pessoais **local-first** para iPhone e Android (Expo + TypeScript): rotação do dinheiro, compras parceladas, dicas de IA e metas financeiras. Dados financeiros ficam no dispositivo; só resumos agregados saem para gerar dicas. A importação opcional por PDF exige consentimento explícito e usa processamento temporário, sem persistência no Worker.

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

### Rodando no emulador Android (desktop)

Supõe o Android Studio já instalado, com pelo menos um dispositivo virtual (AVD) criado. O binário `emulator` do Android SDK **não fica no PATH por padrão**, então os comandos abaixo usam o caminho completo (testado com um AVD `Medium_Phone_API_36.1`):

- Windows (PowerShell): `$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe`
- macOS: `~/Library/Android/sdk/emulator/emulator`

1. Liste os emuladores disponíveis:

   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds
   ```

2. Abra o emulador desejado (substitua pelo nome retornado acima):

   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Medium_Phone_API_36.1
   ```

3. Com o emulador aberto, escolha uma das formas de execução abaixo.

   **Expo Go — início rápido**

   ```bash
   npx expo start --go --android
   ```

   Isso inicia o Metro, abre o Expo Go e carrega o app. Importação por PDF e
   texto funcionam nesse modo; OCR de foto não funciona porque depende do
   módulo nativo do ML Kit.

   **Development build — necessário para OCR de foto**

   Na primeira execução, ou sempre que uma dependência nativa for adicionada:

   ```bash
   npx expo run:android
   ```

   O comando compila, instala e abre um novo aplicativo de desenvolvimento no
   emulador. Nas execuções seguintes, enquanto as dependências nativas não
   mudarem:

   ```bash
   npx expo start --dev-client --android
   ```

> O parâmetro correto é `--android`, não `--andoid`.
>
> Se aparecer `Cannot find native module 'ExpoDocumentPicker'`, o development
> build instalado é anterior à dependência. Pare o Metro e execute
> `npx expo run:android` novamente. Apenas usar `--clear` não adiciona módulos
> nativos ao aplicativo já instalado.

> Dica: se quiser digitar só `emulator` sem o caminho completo, adicione a pasta do binário (`<SDK do Android>/emulator`) ao `PATH` do sistema.

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
