# 0006 — Padrão de CRUD: editar e excluir

## Status

Aceito (2026-07-07)

## Contexto

O app só tinha criação e exclusão (a exclusão já pedia confirmação via `Alert.alert`, duplicado inline em cada uma das 3 telas com dado editável). Não havia edição — corrigir um valor digitado errado exigia excluir e recriar o registro, perdendo o histórico.

## Decisão

**Edição**: um componente de formulário por entidade (`src/components/forms/{Transaction,Installment,Goal}Form.tsx`), aceitando `mode: 'create' | 'edit'` + `initialValues` opcionais — o mesmo componente que já cria passa a editar, nunca duplicado. Sem rota nova: o app não tem nenhuma rota dinâmica hoje e as 4 telas já são single-file com estado local (`showForm`); a edição vira só mais um estado local (`editingId`) na mesma tela, evitando complexidade de deep-link que nada mais no app usa.

**Exclusão**: `src/components/ConfirmDialog.tsx` (função `confirmDestructive`, wrapper sobre `Alert.alert`) substitui as 3 funções `confirmDelete` que estavam duplicadas inline.

**Gesto de acesso**: `src/components/SwipeableRow.tsx` (`Swipeable` do `react-native-gesture-handler`) envolve cada linha/card, revelando "Editar" (cor `primary`) e "Excluir" (cor `negative`) ao arrastar. Substitui o `onLongPress` que só fazia exclusão — as duas ações (editar, excluir) agora vivem no mesmo gesto, sem duas affordances concorrentes pro mesmo card. O prop `onLongPress` foi removido de `TransactionListItem`, `InstallmentCard` e `GoalCard` (`GoalCard` manteve `onPress`, que é uma ação diferente — seleciona a meta pra ver detalhes).

Edição não pede confirmação (não é destrutiva) — só a exclusão passa por `confirmDestructive`.

## Consequências

**Mais fácil:** corrigir um registro sem recriar; um único ponto de confirmação de exclusão pra manter consistente; um único gesto (swipe) concentra as duas ações por linha, em vez de um long-press escondido.

**Mais difícil:** swipe é menos descobrível que um botão visível — mitigado por ser um padrão comum em apps de lista (mensagens, e-mail); os 3 cards de linha perderam a affordance de toque longo, então qualquer ação nova por linha no futuro deve entrar no `SwipeableRow`, não reintroduzir `onLongPress` ad-hoc.
