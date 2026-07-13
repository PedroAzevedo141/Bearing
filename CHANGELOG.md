# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versionamento [SemVer](https://semver.org/lang/pt-BR/). Toda feature nova ganha entrada em **[Não lançado]** antes de virar versão.

## [Não lançado]

### Adicionado

- Estrutura inicial do projeto: Expo SDK 54 + TypeScript + Expo Router.
- Banco SQLite local (`expo-sqlite`) com runner de migrations (`PRAGMA user_version`) e schema v1: `accounts`, `tags`, `transactions`, `installment_purchases`, `goals`, `ai_insights_cache`.
- Aba **Rotação**: saldo líquido do período (30 dias), lista de entradas/saídas e registro de transações com tags livres.
- Aba **Parcelas**: cadastro de compras parceladas com progresso visual e lembretes locais de vencimento (`expo-notifications`).
- Aba **Dicas**: dica financeira gerada por IA a partir do resumo agregado, com cache local de 24h.
- Aba **Metas**: metas com progresso, aportes manuais e plano de ação estruturado gerado por IA.
- Trava biométrica na abertura do app (`expo-local-authentication`).
- Cloudflare Worker `bearing-ai`: proxy stateless para a Claude API (`claude-haiku-4-5`) com `X-App-Secret`, rate limiting e structured output no plano de metas.
- Documentação: README, ARCHITECTURE, CONTRIBUTING, DATA_MODEL, API_CONTRACTS, AI_PROMPTS, ADR-0001 (local-first) e propostas ADR-0002/0003/0004.
- TypeDoc configurado (`npm run docs` → `docs/generated/`).
- Migration v2: `CHECK` no banco pra `transactions.amount_cents > 0` e `installment_purchases` (`total_amount_cents > 0`, `current_installment BETWEEN 1 AND installment_count`) — defesa em profundidade além da validação de UI.
- Seção "Concluídas" (colapsada) na aba Parcelas para compras já quitadas, via `isInstallmentCompleted` (derivado, sem coluna `status` no banco).
- Design system: NativeWind + React Native Paper nas 4 abas, com paleta e tema únicos (`src/theme/`) — ver ADR-0005.
- Edição de transações, compras parceladas e metas, reaproveitando o mesmo formulário de criação (`mode: 'create' | 'edit'`) — ver ADR-0006.
- Exclusão com confirmação (`ConfirmDialog`) e gesto de swipe (`SwipeableRow`, revela "Editar"/"Excluir") em todas as listas — substitui o antigo long-press.
- Testes automatizados (`vitest`, `npm run test`): `src/utils/money.test.ts` e `src/db/applyMigrations.test.ts` (runner de migrations extraído pra `src/db/applyMigrations.ts`, testável sem o módulo nativo `expo-sqlite`).

### Corrigido

- `expo-notifications` derrubava o app inteiro ao abrir dentro do Expo Go (SDK 53+ removeu suporte a push remoto do Expo Go, e o próprio import do pacote já tenta se registrar). `notificationService.ts` agora só carrega o módulo fora do Expo Go; dentro dele, lembretes locais degradam para no-op em vez de crashar.
