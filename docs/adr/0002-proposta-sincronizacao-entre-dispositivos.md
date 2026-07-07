# 0002 — Proposta: sincronização entre dispositivos

## Status

Proposta (não é decisão — evolução futura fora do MVP)

## Contexto

O local-first (ADR-0001) implica que os dados vivem em um único aparelho. Trocar de celular ou usar tablet + celular exigiria sincronização.

## Decisão (proposta)

Se um dia for necessário: reintroduzir um backend com Postgres + RLS (ex: Supabase), com o SQLite local continuando como fonte primária e o servidor como réplica — os UUIDs gerados no client já evitam colisão de chaves. Não implementar no MVP.

## Consequências

Ganharia backup automático e multi-dispositivo; perderia a privacidade por construção, adicionaria Auth/RLS e custo fixo de operação — exatamente o que o ADR-0001 eliminou. Só vale se o uso multi-dispositivo virar necessidade real.
