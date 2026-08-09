# Guia de contribuição

Mesmo sendo um projeto individual, estas convenções existem para o projeto escalar sem perder o fio da meada. Trate como regra, não sugestão.

## Regra de ouro para escalar

Toda nova feature ganha:

1. sua pasta/módulo em `src/`;
2. entrada em `[Não lançado]` no [CHANGELOG.md](CHANGELOG.md);
3. se envolver decisão arquitetural (nova dependência, mudança de padrão, nova integração externa), um novo arquivo em [docs/adr/](docs/adr/) seguindo o [template](docs/adr/TEMPLATE.md).

## Documentação de código (obrigatória)

### Toda função e componente exportado leva JSDoc/TSDoc

- `@param` pra cada parâmetro, `@returns` sempre, `@throws` quando a função pode lançar erro.
- `@example` obrigatório em funções que não são óbvias só pela assinatura.
- Comentário explica o **porquê** / o que representa — não repete o óbvio do código (`// soma os valores` acima de um `.reduce()` é ruído, não documentação).

```typescript
/**
 * Calcula o saldo líquido (entradas - saídas) de um período.
 *
 * @param transactions - Lista de transações já filtradas pelo período desejado
 * @returns Saldo em centavos. Positivo = superávit, negativo = déficit.
 *
 * @example
 * const saldo = calculateNetFlow(transactionsDoMes);
 * // saldo = 15000 significa R$ 150,00 de saldo positivo
 */
export function calculateNetFlow(transactions: Transaction[]): number { ... }
```

### Componentes React

Props documentadas campo a campo na interface; o JSDoc do componente diz onde ele é usado e o que ele **não** faz (ex: "não busca dados sozinho — recebe tudo via props"). Ver [src/components/InstallmentCard.tsx](src/components/InstallmentCard.tsx) como referência.

### Cabeçalho de arquivo

Todo arquivo em `src/services/` e `src/db/` começa com um bloco de contexto: o que o módulo faz, restrições importantes e links `Relacionado:` para os docs.

### O que NÃO documentar

Comentário redundante (`// incrementa i` acima de `i++`) e código óbvio de UI puro (um `<View style={styles.container}>` não precisa de JSDoc). Documentação tem custo de manutenção — cada comentário desatualizado é pior que a ausência dele. **Documente decisão e intenção, não sintaxe.**

### Geração automática

`npm run docs` roda o TypeDoc e gera um site navegável em `docs/generated/` a partir dos comentários TSDoc.

## Convenções de código

- **Dinheiro sempre em centavos (inteiro)** — nunca `number` com casas decimais. Float só no `Intl.NumberFormat`, na exibição.
- **Nunca SQL solto em componente** — toda operação de banco é uma função em `src/db/queries/`.
- **Mudança de schema = nova migration** em `src/db/migrations/` (nunca editar uma já aplicada) + atualização de [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
- **Mudança de prompt de IA** = registro em [docs/AI_PROMPTS.md](docs/AI_PROMPTS.md) com data e motivo.
- **Nenhum dado bruto de transação sai do dispositivo** — o `aiService` só envia agregados (ver [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md)).
- **Toda função em `utils/`** e a lógica de aplicação de migrations em `db/applyMigrations.ts` **levam teste unitário** (`npm run test`, vitest).
- **Toda query em `db/queries/` leva teste** contra um SQLite real em memória, via `createTestDatabase()` de [src/db/testSupport.ts](src/db/testSupport.ts): o SQL do teste é o mesmo do app, no mesmo motor, com as migrations reais aplicadas (ver [ADR-0011](docs/adr/0011-testes-de-query-com-node-sqlite.md)).
- A regra sobre módulo nativo continua valendo, nesta forma: **não mocke comportamento de banco; substitua só o transporte.** Um fake de `expo-sqlite` testaria o fake, não o SQL. Trocar `src/db/index.ts` (código nosso) por uma conexão `node:sqlite` real é outra coisa — nenhum comportamento de banco é simulado. Para lógica que não precisa de banco, siga isolando num arquivo sem import de `expo-sqlite`, nem indireto (ver `src/db/applyMigrations.ts` e `src/services/backupFormat.ts` como referência).
- `npm run typecheck` limpo antes de todo commit.

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```text
feat: adiciona filtro de período na aba Rotação
fix: corrige parsing de valor com vírgula decimal
docs: registra ADR-0005 sobre export de backup
chore: atualiza Expo SDK
```

## Pull Requests

- Um assunto por PR.
- Descrição responde: o que muda, por quê, e como testar.
- CHANGELOG e docs atualizados no mesmo PR da feature — não como "tarefa futura".
