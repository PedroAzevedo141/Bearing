# 0008 — Assinaturas recorrentes: lembrete + confirmação, nunca lançamento automático

## Status

Aceito (2026-07-11)

## Contexto

Assinaturas (Netflix, academia) repetem todo mês num dia fixo. O óbvio seria lançar a transação sozinho no dia. Mas valor e cobrança real variam (reajuste, cancelamento, cobrança que não veio), e lançar automático gera dado que o usuário não revisou — contra a filosofia de revisão humana que já vale para importação de extrato (ADR-0007) e para as dicas de IA.

## Decisão

O app **nunca** cria a transação sozinho. A assinatura (`recurring_transactions`) guarda nome, valor, `day_of_month` e tag. No dia, uma **notificação local mensal** (agendada via `notificationService`, nunca `expo-notifications` direto) avisa o usuário; tocar na notificação leva a uma tela de confirmação pré-preenchida (`app/assinaturas/confirm/[id]`) que reaproveita o `TransactionForm` em modo `create` — o usuário ajusta o valor se precisar e confirma para virar um registro em `transactions`.

Consistência com o resto do app importa mais que automação total: a mesma postura ("app sugere, humano confirma") das outras features.

**Origem via importação de extrato:** ao revisar um extrato (Confirmação 2), o usuário pode marcar um lançamento como "Assinatura". Isso **grava a transação daquele mês** (a cobrança já aconteceu e está no extrato — a marcação na tela de revisão é a própria confirmação humana) **e** cadastra a recorrência para os meses seguintes, deduplicando por nome (`isNameSimilar`) para não repetir a assinatura a cada extrato. Os meses futuros continuam seguindo o fluxo de lembrete + confirmação acima — o app não passa a lançar sozinho. O `day_of_month` é derivado da data da cobrança.

**Revisão (migration v7): o lembrete deixou de ser o único caminho.** A decisão acima deixava um furo que só aparece com o uso: se a notificação passasse batida — celular no silencioso, notificação dispensada sem querer, app desinstalado no dia — a cobrança **nunca** era lançada, e saldo e orçamento ficavam errados sem nada indicar isso. Confiar a integridade do dado financeiro a uma notificação ter sido vista é frágil demais.

A transação passou a guardar `recurring_id`, e com esse vínculo a aba Rotação mostra um card **"Assinaturas a confirmar"** com as recorrências que já venceram na competência e ainda não viraram transação. Um toque leva à mesma tela de confirmação de sempre.

Isto **não** afrouxa a decisão original: o app continua sem lançar nada sozinho, e a confirmação humana segue obrigatória. O que muda é que ela deixou de depender de um evento efêmero e passou a ser um estado visível na tela principal, que espera o usuário pelo tempo que for preciso.

Deduzir o vínculo comparando descrições (em vez de gravar `recurring_id`) foi descartado: quebraria assim que o usuário editasse o texto da transação, recriando a mesma falha silenciosa que a mudança veio corrigir.

## Consequências

**Mais fácil:** nunca gera transação errada silenciosamente; o usuário corrige o valor do mês na hora; reusa o formulário de transação (sem tela nova de captura). A pendência é visível na Rotação, então esquecer uma cobrança deixa de ser invisível — e o vínculo ainda responde "quanto gastei com esta assinatura no ano".

**Mais difícil:** exige um toque do usuário por mês por assinatura (não é 100% automático). A notificação e o deep-link só funcionam em dev build (Expo Go não recebe notificação local agendada). O espaço de notificação é global e compartilhado com os lembretes de parcela: ao excluir uma assinatura, o lembrete mensal já agendado fica órfão até o próximo disparo — a tela de confirmação trata "assinatura não encontrada" graciosamente, em vez de usar "cancelar todas" (que apagaria também os lembretes de parcela).
