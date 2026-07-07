# 0004 — Proposta: metas compartilhadas entre duas contas

## Status

Proposta (não é decisão — evolução futura fora do MVP)

## Contexto

Metas como "viagem em casal" fazem sentido compartilhadas entre duas pessoas, cada uma registrando seus aportes.

## Decisão (proposta)

Se um dia for adotado: exigiria contas de usuário e um backend para o estado compartilhado da meta (depende do backend do ADR-0002). Os aportes individuais poderiam continuar locais, sincronizando apenas o total por participante. Não implementar no MVP.

## Consequências

Ganharia o caso de uso social; em troca, introduz identidade de usuário, permissões e resolução de conflito de escrita — o app deixa de ser "de uso individual" (premissa do ADR-0001).
