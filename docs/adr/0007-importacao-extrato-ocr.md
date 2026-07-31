# 0007 — Importação de extrato: OCR local, PDF opt-in + dupla confirmação

## Status

Aceito (2026-07-11), ampliado em 2026-07-23

## Contexto

Registrar transação a transação é o maior atrito do app. Importar de um extrato reduz isso. Foto e captura de tela continuam com OCR local; PDF digital, que não tem extração local confiável no Expo Go, usa uma exceção voluntária e claramente informada à regra local-first.

## Decisão

Fluxo em duas confirmações, sem pular etapa:

**Foto/print → OCR local → Confirmação 1 (usuário edita o texto bruto) → Worker classifica (IA) → Confirmação 2 (usuário corrige os itens) → grava.**

**PDF → consentimento explícito → Worker extrai texto sem persistir → Confirmação 1 → Worker classifica → Confirmação 2 → grava.**

- **OCR local** via `@react-native-ml-kit/text-recognition` — roda 100% no aparelho, sem rede. É **módulo nativo, não existe no Expo Go** (só em dev build). Por isso o carregamento é condicional (mesma estratégia do `notificationService`): no Expo Go o módulo é `null` e o app não quebra. O caminho **sempre disponível** é colar o texto (funciona em qualquer lugar, inclusive iPhone via Expo Go, copiando do app do banco); a foto+OCR aparece só fora do Expo Go.
- **PDF é opt-in** (`POST /ai/extract-statement-pdf`): antes do envio, a UI explica que o documento será processado pela IA e não será salvo pelo Bearing. O arquivo precisa ser um PDF padrão, sem senha, com no máximo 20 MB. O Worker repassa o documento em memória, devolve apenas o texto e não persiste arquivo nem resposta.
- **Classificação continua separada** (`POST /ai/parse-statement`): depois da extração, o usuário edita o texto na Confirmação 1. Só então o texto revisado é classificado em itens.
- **Itens com `is_installment: true` vão para `installment_purchases`**, não `transactions`, e alimentam a aba Parcelas já existente. Antes de inserir, casa com uma compra existente (`findMatchingInstallment`, lógica pura em `statementMatching.ts`) e só avança a parcela atual, evitando duplicar a mesma compra a cada extrato mensal.
- Gravação sempre pela camada de queries; a tela nunca toca SQL.

## Consequências

**Mais fácil:** importar dezenas de lançamentos de uma vez; fotos continuam inteiramente locais; PDFs de bancos passam a funcionar inclusive no Expo Go.

**Mais difícil:** PDF deixa o aparelho antes da Confirmação 1, portanto exige consentimento adicional e é uma exceção documentada ao local-first. O custo de tokens é maior porque cada página é processada como texto e imagem. OCR por foto exige dev build; colar texto cobre o fallback mais privado. O matching de parcelas é heurístico, por isso a Confirmação 2 continua obrigatória.
