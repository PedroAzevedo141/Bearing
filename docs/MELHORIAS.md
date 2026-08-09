# Plano de melhorias — concluído

Backlog levantado a partir de uma leitura do schema, das queries e das telas, e
executado inteiro na branch `feat/melhorias`. Cada item fechou com código +
JSDoc + `CHANGELOG.md` + docs afetados + `npm run typecheck` e `npm run test`
limpos, e virou **um commit**.

Este arquivo fica como registro: o que foi feito, em que ordem, e onde a
estimativa inicial errou. O detalhe de cada decisão está no ADR ou no
`DATA_MODEL.md` correspondente — aqui só o mapa.

Schema: **v5 → v9**.

## O que foi entregue

| # | Commit | Migration | ADR |
| --- | --- | --- | --- |
| 1 | `fix: compra parcelada nunca era marcada como concluida` | v6 | — |
| 2 | `feat: adiciona backup e exportacao dos dados locais` | — | 0010 (novo) |
| 3 | `feat: adiciona navegacao por mes na aba Rotacao` | — | — |
| 4 | `feat: mostra assinaturas pendentes do mes na aba Rotacao` | v7 | 0008 (revisado) |
| 5 | `feat: avalia orcamento por competencia mensal` | v8 | — |
| 6 | `refactor: remove o conceito de contas do schema` | v9 | — |
| 8 | `test: cobre a camada de queries com SQLite real em memoria` | — | 0011 (novo) |
| 7 | `feat: adiciona tema escuro` | — | 0005 (revisado) |

Os itens 6 e 8 trocaram de lugar na execução: o 6 mexe no schema, e escrever os
testes do 8 antes dele significaria reescrevê-los em seguida.

## Bugs encontrados no caminho

Nenhum destes estava no plano; apareceram durante a implementação ou a
verificação no emulador.

- **Lembretes de parcela pulavam um mês** quando o vencimento caía no dia 29, 30
  ou 31: `setMonth` transborda para o mês seguinte quando o dia não existe no
  destino (31/01 + 1 mês virava 03/03). Corrigido no item 1, junto do `addMonths`
  de `src/utils/date.ts`.
- **Card de pendências não recarregava** ao voltar para a aba Rotação, porque o
  hook só carregava na montagem e a aba fica montada. Corrigido no item 4 com
  `useFocusEffect`.
- **FAB e botões tonais saíam roxos no tema escuro**: o MD3 dirige esses
  componentes pelos tokens `*Container`, que o tema do app não sobrescrevia. No
  tema claro passava despercebido. Corrigido no item 7.
- **Fundo do ícone de transação** era um tom claro fixo e virava mancha no
  escuro. Corrigido no item 7.

## Onde a estimativa errou

Vale registrar, porque o erro tem um padrão.

**Item 7 (tema escuro) foi muito subestimado.** O plano dizia que "o trabalho é
sobretudo definir a paleta escura e ligar o `colorScheme` — não é uma reescrita
de UI", com base em as telas já usarem tokens semânticos. Medindo antes de
começar: **84 referências a `colors.*` em 17 arquivos**, passadas via `style` e
props (que não passam por token do NativeWind), mais ~25 pontos com cor fixa. A
parte via `className` de fato saiu de graça; o resto não. Acabou comparável em
tamanho aos itens de feature.

A lição: "as telas usam tokens" descrevia o CSS, não o TypeScript, e a metade
que não usava era invisível na leitura que gerou a estimativa.

**Item 8 (testes) foi resolvido melhor do que o previsto.** O plano oferecia duas
saídas — extrair lógica pura ou adicionar `better-sqlite3` como devDependency —
e a segunda exigiria dependência nova. `node:sqlite`, embutido no Node 22.5+,
dá o mesmo resultado sem dependência alguma (ADR-0011).

## O que continua fora

- **Hooks e componentes sem teste.** Cobri-los exige runtime React Native
  (`jest-expo` ou `@testing-library/react-native`), que é outra decisão, de custo
  bem maior — ver "Ainda descoberto" no ADR-0011.
- **Backup é manual.** Ninguém é lembrado de fazê-lo, então o usuário
  desprevenido segue sem proteção; a diferença é que agora existe a
  possibilidade. Um lembrete periódico resolveria — ver ADR-0010.
- **Sincronização entre dispositivos e Open Finance** seguem como propostas
  (ADR-0002, ADR-0003), intocadas.
