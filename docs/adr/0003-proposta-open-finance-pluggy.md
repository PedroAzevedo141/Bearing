# 0003 — Proposta: importação automática via Open Finance (Pluggy)

## Status

Proposta (não é decisão — evolução futura fora do MVP)

## Contexto

Registrar transações manualmente é o maior atrito de uso do app. O Open Finance brasileiro, via agregadores como a Pluggy, permitiria importar transações bancárias automaticamente.

## Decisão (proposta)

Se um dia for adotado: integrar a Pluggy através de um backend próprio (as credenciais do agregador não podem viver no app), importando transações para o SQLite local. Não implementar no MVP.

## Consequências

Eliminaria o registro manual; em troca, dados bancários passariam por um servidor de terceiros + backend próprio, quebrando a garantia "nenhum dado financeiro sai do dispositivo" do ADR-0001. Exige reavaliar o modelo de privacidade inteiro, não é um incremento.
