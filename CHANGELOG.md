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
- Importação de extratos com OCR Local: Integração do hook com Cloudflare Worker pra processar dados, matching customizado pra compras parceladas usando distância/semelhança no nome e aprovação de usuário (revisão humana obrigatória).
- Orçamentos Mensais: Limites por tag visíveis na aba Rotação e emissão de alerta/push local ao atingir 90% dos gastos previstos no mês.
- Assinaturas Recorrentes: Gestão de contas que ocorrem todo mês num dia específico, com agendamento de notificação mensal para revisão e adição com 1 clique (pré-preenchimento no formulário de transação).
- Chat Inteligente: Suporte a histórico de conversas locais usando as tabelas `chat_conversations` e `chat_messages` e chamando a IA para interagir com o fluxo financeiro e orçamento.
- ADRs 0007 (importação/OCR), 0008 (assinaturas com confirmação humana) e 0009 (chat com tools no client); prompts novos registrados em `docs/AI_PROMPTS.md`.
- Importação de extrato por PDF (até 20 MB), com consentimento explícito, extração temporária no Worker e revisão do texto antes da classificação.
- Componentes compartilhados de cabeçalho e estado vazio para dar consistência às áreas principais.
- Aba **Rotação**: linha "Parcelas do mês" — soma derivada das parcelas ativas, sinalizada como compromisso fixo fora do saldo do período (nunca gravada como transação).
- **Orçamento avaliado por competência**: o card de orçamento da Rotação passa a seguir o mês exibido, e o limite é versionado no tempo (**migration v8**, `budgets.effective_from`). Sem isso, subir um limite reescreveria o julgamento sobre meses passados — um mês em que se estourou passaria a parecer dentro do orçamento. O aviso de 90% só dispara para o mês corrente.
- **Assinaturas a confirmar na aba Rotação**: card com as recorrências que já venceram no mês e ainda não viraram transação, com confirmação em 1 toque. Fecha o furo de o lembrete ser o único caminho — se a notificação passasse batida, a cobrança nunca era lançada e o saldo ficava errado em silêncio. **Migration v7** adiciona `transactions.recurring_id`; o app continua sem lançar nada sozinho (ADR-0008 revisado).
- **Navegação por mês na aba Rotação**: seletor ‹ mês › no cabeçalho e comparação do saldo com o mês anterior. A aba passou de uma janela móvel fixa de 30 dias para competência mensal fechada — é assim que se pergunta "como foi março?". Avançar além do mês corrente fica bloqueado, e registrar uma movimentação enquanto se olha um mês passado volta para o mês corrente (a transação nasce com a data de hoje).
- **Backup e exportação** (tela `/backup`, atalho na aba Rotação): exporta todos os dados num `.json` versionado, restaura a partir dele substituindo o conteúdo atual (com confirmação destrutiva), e gera um CSV das movimentações para planilha. O arquivo sai pelo share sheet do sistema — o app não envia nada sozinho. Nova dependência `expo-sharing`; ver ADR-0010. **Exige reconstruir o development build** (`npx expo run:android`).
- `src/utils/date.ts`: aritmética de calendário compartilhada (`addMonths` com queda para o último dia do mês, `monthsBetween`, parsing/formatação de `DD/MM/AAAA`), com testes.
- Importação de extrato: tipo **Assinatura** na Confirmação 2 (seletor Avulsa/Parcela/Assinatura). Marcar "Assinatura" grava a cobrança do mês E cadastra a recorrência para lembretes futuros, deduplicando por nome (dia do vencimento derivado da data da cobrança).

### Alterado

- Aba **Dicas** (dica diária automática) foi **removida** e substituída pela aba **Chat** — o chat cobre o mesmo caso de uso de forma mais rica (o usuário pergunta o que quiser). O endpoint `/ai/insights` e o cache seguem existindo (usados internamente); só a aba deixou de existir. As 4 abas agora são Rotação, Parcelas, Chat e Metas.
- Interface principal renovada com navegação por ícones, hierarquia visual mais clara, resumos contextuais, cartões de progresso, formulários em modais e ações rápidas.

### Removido

- Conceito de **contas/carteiras** (`accounts` e `transactions.account_id`), **migration v9**. A tabela existia desde a v1 mas nenhuma tela a expôs: o app criava uma "Carteira" implícita e usava sempre a mesma, então o campo nunca variava. Tabela viva sem uso confunde quem lê o schema e obrigava cada escrita a resolver uma conta sem significado. O app é sobre fluxo de dinheiro, não saldo por conta; cartão de crédito já é coberto por `installment_purchases`.

### Corrigido

- Compra parcelada nunca era marcada como concluída: a seção "Concluídas" da aba Parcelas era inalcançável por construção. A UI define quitada como `current_installment > installment_count`, mas o `CHECK` da migration v2 proibia exatamente esse estado e o `advanceInstallment` travava no total. Junto disso, o contador só mudava se alguém o avançasse — e nada no app fazia isso, então a projeção de "quanto falta pagar" envelhecia em silêncio. **Migration v6** remove `current_installment`: a parcela atual agora é derivada de `first_due_date` + data de hoje (`currentInstallmentFor`), como já acontecia com o valor da parcela. Quem tinha compras cadastradas vai ver a posição corrigida para a que a data indica.
- Formulário de compra parcelada trocou o campo "Parcela atual" pelo vencimento da 1ª parcela — é essa data que ancora o cronograma; sem ela, uma compra iniciada meses atrás aparecia como parcela 1.
- Lembretes de parcela pulavam um mês quando o vencimento caía no dia 29, 30 ou 31: `setMonth` transborda para o mês seguinte quando o dia não existe no destino (31/01 + 1 mês virava 03/03). O novo `addMonths` (`src/utils/date.ts`) cai para o último dia do mês.
- Importação de extrato deixou de "avançar o contador" da compra parcelada e passa a reancorar `first_due_date` a partir da cobrança observada (`firstDueDateFor`), só quando o extrato aponta um começo anterior ao registrado.
- Chat: hook fazia `fetch` direto e ignorava o mês/ano da tool `getGastosPorTag`; agora passa pelo `aiService`, é tipado (sem `any`) e a tool consulta o mês pedido. Erro de rede vira estado da tela (Snackbar), não mais mensagem falsa gravada no histórico.
- Chat dava respostas financeiras erradas (confundia valor da parcela com o total da compra): as tools devolviam números crus em centavos. Agora devolvem valores já derivados, rotulados sem ambiguidade (`valor_de_cada_parcela` vs `valor_total_da_compra`, `ainda_falta_pagar`) e formatados em reais, e o system prompt proíbe recalcular — ver `docs/AI_PROMPTS.md`.
- Orçamento e Assinaturas travavam o app no Expo Go — os hooks `useBudgets`/`useRecurring` importavam `expo-notifications` direto. Agora as notificações passam pelo `notificationService` (carregamento condicional), como o resto do app.
- Importação de extrato: OCR nativo travava no Expo Go — agora o módulo é carregado condicionalmente e colar texto é o caminho sempre disponível; a tela de revisão parou de tocar SQL direto (usa a camada de queries).
- Importação de extrato por PDF: a mensagem de erro era genérica e culpava o PDF do usuário mesmo quando a falha era do servidor. Agora diferencia PDF sem texto selecionável, indisponibilidade do serviço de IA (5xx) e falha de conexão.

- `expo-notifications` derrubava o app inteiro ao abrir dentro do Expo Go (SDK 53+ removeu suporte a push remoto do Expo Go, e o próprio import do pacote já tenta se registrar). `notificationService.ts` agora só carrega o módulo fora do Expo Go; dentro dele, lembretes locais degradam para no-op em vez de crashar.
