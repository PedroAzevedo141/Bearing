# 0008 — Assinaturas recorrentes: lembrete + confirmação, nunca lançamento automático

## Status

Aceito (2026-07-11)

## Contexto

Assinaturas (Netflix, academia) repetem todo mês num dia fixo. O óbvio seria lançar a transação sozinho no dia. Mas valor e cobrança real variam (reajuste, cancelamento, cobrança que não veio), e lançar automático gera dado que o usuário não revisou — contra a filosofia de revisão humana que já vale para importação de extrato (ADR-0007) e para as dicas de IA.

## Decisão

O app **nunca** cria a transação sozinho. A assinatura (`recurring_transactions`) guarda nome, valor, `day_of_month` e tag. No dia, uma **notificação local mensal** (agendada via `notificationService`, nunca `expo-notifications` direto) avisa o usuário; tocar na notificação leva a uma tela de confirmação pré-preenchida (`app/assinaturas/confirm/[id]`) que reaproveita o `TransactionForm` em modo `create` — o usuário ajusta o valor se precisar e confirma para virar um registro em `transactions`.

Consistência com o resto do app importa mais que automação total: a mesma postura ("app sugere, humano confirma") das outras features.

**Origem via importação de extrato:** ao revisar um extrato (Confirmação 2), o usuário pode marcar um lançamento como "Assinatura". Isso **grava a transação daquele mês** (a cobrança já aconteceu e está no extrato — a marcação na tela de revisão é a própria confirmação humana) **e** cadastra a recorrência para os meses seguintes, deduplicando por nome (`isNameSimilar`) para não repetir a assinatura a cada extrato. Os meses futuros continuam seguindo o fluxo de lembrete + confirmação acima — o app não passa a lançar sozinho. O `day_of_month` é derivado da data da cobrança.

## Consequências

**Mais fácil:** nunca gera transação errada silenciosamente; o usuário corrige o valor do mês na hora; reusa o formulário de transação (sem tela nova de captura).

**Mais difícil:** exige um toque do usuário por mês por assinatura (não é 100% automático). A notificação e o deep-link só funcionam em dev build (Expo Go não recebe notificação local agendada). O espaço de notificação é global e compartilhado com os lembretes de parcela: ao excluir uma assinatura, o lembrete mensal já agendado fica órfão até o próximo disparo — a tela de confirmação trata "assinatura não encontrada" graciosamente, em vez de usar "cancelar todas" (que apagaria também os lembretes de parcela).
