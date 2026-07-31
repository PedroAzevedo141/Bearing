# 0009 — Chat com IA: tools executadas no client, contexto nunca no servidor

## Status

Aceito (2026-07-11)

## Contexto

O chat precisa responder sobre as finanças reais do usuário (gastos por tag, parcelas, metas) — dados que vivem só no SQLite local. A restrição do ADR-0001 é absoluta: o Worker nunca acessa dados brutos do usuário. Isso conflita com o modo usual de dar contexto a um chat (o servidor consulta o banco).

## Decisão

Novo endpoint `POST /ai/chat`. O Worker é **puro relay**: declara as tools disponíveis (`getGastosPorTag`, `getParcelasAtivas`, `getMetas`) e repassa a resposta da Claude API — incluindo blocos `tool_use` — de volta ao app. **A execução das tools é 100% no client** (`useChat` → `src/db/queries/`); o Worker nunca toca o SQLite.

- O **system prompt é montado no client** (`buildSystemPrompt`) com o contexto financeiro fresco (agregados, nunca transações individuais) e enviado no corpo. É a exceção documentada ao padrão "prompt vive no Worker" (ver AI_PROMPTS.md), justamente porque o contexto vem do aparelho.
- O **loop de tool use** (executar tool → devolver `tool_result` → rechamar) roda no hook, com teto de iterações.
- **Histórico:** só as últimas 20 mensagens da conversa entram no payload; as mais antigas continuam salvas e visíveis, só não são enviadas — cap por conversa, não global.
- **Título** da conversa é cortado da 1ª mensagem do usuário, sem chamada extra de IA (custo).

## Consequências

**Mais fácil:** o chat responde com dados reais sem que eles saiam do aparelho além do agregado no system prompt; adicionar uma tool nova é declarar no Worker + implementar o executor local.

**Mais difícil:** o app carrega a complexidade do loop de tool use (antes só existia request/response simples); o system prompt fora do Worker significa que mudanças de wording dele não estão centralizadas — por isso ficam registradas em AI_PROMPTS.md. Cada tool nova precisa de tipos client-side (o SDK da Anthropic só existe no Worker).
