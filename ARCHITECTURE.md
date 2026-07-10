# Arquitetura

Princípio central: **local-first**. Nenhum dado financeiro sai do dispositivo, exceto o resumo agregado enviado pontualmente para gerar dicas de IA — e mesmo esse resumo não é armazenado em nenhum servidor. A decisão completa está registrada em [ADR-0001](docs/adr/0001-local-first-architecture.md).

## Diagrama

```mermaid
flowchart LR
    subgraph Dispositivo["📱 Dispositivo (iPhone/Android)"]
        UI["UI (Expo Router)<br/>4 abas · NativeWind + Paper"]
        Hooks["Hooks<br/>(useTransactions, useGoals...)"]
        Queries["src/db/queries<br/>(uma função por operação)"]
        DB[("SQLite local<br/>expo-sqlite")]
        Bio["Biometria<br/>expo-local-authentication"]
        Notif["Lembretes locais<br/>expo-notifications"]
        AiSvc["aiService.ts<br/>(só agregados)"]
    end

    subgraph Cloudflare["☁️ Cloudflare (stateless)"]
        Worker["Worker bearing-ai<br/>valida X-App-Secret<br/>rate limiting"]
    end

    Anthropic["Claude API<br/>claude-haiku-4-5"]

    Bio --> UI
    UI --> Hooks --> Queries --> DB
    Hooks --> AiSvc
    Hooks --> Notif
    AiSvc -- "resumo agregado<br/>(nunca transações)" --> Worker
    Worker -- "API key em secret" --> Anthropic
```

## Decisões-chave

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Cliente | Expo (React Native + TypeScript), fixado no **SDK 54** | Expo Go SDK 54 continua aprovado na App Store — permite rodar no iPhone sem Apple Developer Program e sem Mac |
| Distribuição iOS | Expo Go + **EAS Update** | Publica o bundle JS na nuvem da Expo; o Expo Go já instalado carrega a versão publicada, sem rebuild |
| Distribuição Android | Expo Go (mesmo fluxo) ou APK gerado via EAS Build | Android não tem a mesma restrição de loja; pode virar app standalone quando quiser |
| Dados | `expo-sqlite`, 100% local | Elimina necessidade de backend, Auth e RLS; dados financeiros nunca saem do aparelho |
| Segurança do app | `expo-local-authentication` (Face ID / biometria) | Única camada de proteção possível já que não existe servidor guardando os dados |
| Notificações | `expo-notifications`, agendamento local | Lembretes de vencimento de parcela sem precisar de push server |
| Design system | NativeWind (layout/tipografia) + React Native Paper (botões, inputs, cards) | Elimina `StyleSheet` duplicado e paleta de cor solta repetida em cada tela |
| IA | Cloudflare Worker (proxy stateless) → Claude API (`claude-haiku-4-5-20251001`) | Worker segura a API key fora do bundle do app; Haiku é o modelo mais barato adequado à tarefa |
| Controle de custo | Spend limit de US$5 em Settings > Limits no Claude Console | Teto de segurança contra abuso do endpoint |

## Fora do escopo do MVP (propositalmente)

Supabase, qualquer backend com banco na nuvem, sincronização entre dispositivos e integração com Open Finance (Pluggy) ficam documentados como **propostas** em `docs/adr/` — não como parte do MVP:

- [ADR-0002 — Proposta: sincronização entre dispositivos](docs/adr/0002-proposta-sincronizacao-entre-dispositivos.md)
- [ADR-0003 — Proposta: Open Finance via Pluggy](docs/adr/0003-proposta-open-finance-pluggy.md)
- [ADR-0004 — Proposta: metas compartilhadas](docs/adr/0004-proposta-metas-compartilhadas.md)

## ADRs

Toda decisão arquitetural relevante (nova lib, mudança de padrão, nova integração) vira um arquivo em [docs/adr/](docs/adr/), seguindo o [template](docs/adr/TEMPLATE.md). Índice atual:

| ADR | Status |
| --- | --- |
| [0001 — Arquitetura local-first](docs/adr/0001-local-first-architecture.md) | Aceito |
| [0002 — Sincronização entre dispositivos](docs/adr/0002-proposta-sincronizacao-entre-dispositivos.md) | Proposta |
| [0003 — Open Finance via Pluggy](docs/adr/0003-proposta-open-finance-pluggy.md) | Proposta |
| [0004 — Metas compartilhadas](docs/adr/0004-proposta-metas-compartilhadas.md) | Proposta |
| [0005 — Design system: NativeWind + React Native Paper](docs/adr/0005-design-system-nativewind-paper.md) | Aceito |
| [0006 — Padrão de CRUD: editar e excluir](docs/adr/0006-padrao-crud-editar-excluir.md) | Aceito |
