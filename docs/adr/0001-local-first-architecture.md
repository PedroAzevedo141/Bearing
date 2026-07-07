# 0001 — Arquitetura local-first

## Status

Aceito (2026-07-07)

## Contexto

App de controle financeiro pessoal, de uso individual (não compartilhado), que precisa rodar em iPhone e Android a partir do mesmo código-fonte — **sem Mac, sem Apple Developer Program e com custo de operação próximo de zero**. Dados financeiros são sensíveis; qualquer backend com banco na nuvem traria custo, superfície de ataque, e a obrigação de resolver Auth e RLS para um único usuário.

## Decisão

Nenhum dado financeiro sai do dispositivo. A única exceção é o resumo **agregado** (totais por tag + saldo do período) enviado pontualmente para gerar dicas de IA — e mesmo esse resumo não é armazenado em nenhum servidor.

Concretamente:

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Cliente | Expo (React Native + TypeScript), fixado no **SDK 54** | Expo Go SDK 54 continua aprovado na App Store — permite rodar no iPhone sem Apple Developer Program e sem Mac |
| Distribuição iOS | Expo Go + **EAS Update** | Publica o bundle JS na nuvem da Expo; o Expo Go já instalado carrega a versão publicada, sem rebuild |
| Distribuição Android | Expo Go (mesmo fluxo) ou APK via EAS Build | Android não tem a mesma restrição de loja; pode virar app standalone quando quiser |
| Dados | `expo-sqlite`, 100% local | Elimina backend, Auth e RLS; dados financeiros nunca saem do aparelho |
| Segurança do app | `expo-local-authentication` (biometria na abertura) | Única camada de proteção possível já que não existe servidor guardando os dados |
| Notificações | `expo-notifications`, agendamento local | Lembretes de parcela sem push server |
| IA | Cloudflare Worker (proxy stateless) → Claude API (`claude-haiku-4-5-20251001`) | Worker segura a API key fora do bundle do app; Haiku é o modelo mais barato adequado à tarefa |
| Controle de custo | Spend limit de US$5 no Claude Console + rate limiting no Worker/WAF + header `X-App-Secret` | Teto de segurança contra abuso do endpoint |

Fora do escopo do MVP, propositalmente: Supabase ou qualquer backend com banco na nuvem, sincronização entre dispositivos (ADR-0002), Open Finance/Pluggy (ADR-0003) e metas compartilhadas (ADR-0004).

## Consequências

**Mais fácil:**

- Custo de operação ~zero (Worker no free tier; IA limitada a US$5/mês).
- Privacidade por construção — não há servidor para vazar dados.
- Sem Auth, sem RLS, sem gestão de sessão.
- App funciona offline (exceto as features de IA, que degradam para o cache local).

**Mais difícil:**

- **Perda do aparelho = perda dos dados.** Mitigação obrigatória: export manual de backup (JSON) no roadmap próximo.
- Sem sincronização entre dispositivos — exigiria reintroduzir um backend (ADR-0002).
- A proteção do endpoint de IA é rasa (secret no bundle é extraível); o teto real de dano é o spend limit.
- Upgrade de Expo SDK é compulsório quando o Expo Go abandonar o SDK 54.
