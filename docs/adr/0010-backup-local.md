# 0010 — Backup local por arquivo, sem servidor

## Status

Aceito

## Contexto

O ADR-0001 fixou a arquitetura local-first: os dados financeiros ficam no
`expo-sqlite` do aparelho e nada de bruto sai dali. A consequência que não tinha
sido tratada é que **o app não possuía nenhuma saída de dados**. Perder o
celular, formatá-lo ou simplesmente trocar de aparelho apagava meses de
histórico, sem recuperação possível.

É um risco desproporcional ao esforço de resolvê-lo, e ele cresce com o tempo:
quanto mais o usuário confia no app, mais caro fica o dia em que o aparelho se
perde.

O ADR-0002 propõe sincronização entre dispositivos, que resolveria isto de
forma mais confortável — mas traz servidor, conta de usuário e sincronização de
conflitos de volta para um projeto que decidiu não ter nada disso. É uma
resposta ordens de grandeza maior que o problema imediato.

## Decisão

Exportar e restaurar por **arquivo**, sem serviço remoto envolvido.

- **Formato**: um `.json` com envelope versionado — `format_version` (estrutura
  do arquivo) separado de `schema_version` (`PRAGMA user_version` do banco). Os
  dois são checados na leitura, e um arquivo vindo de versão mais nova é
  recusado: restaurar dados com colunas que este banco não conhece perderia
  informação em silêncio, o que é pior do que falhar visivelmente.
- **Escopo**: todas as tabelas do usuário, menos `ai_insights_cache`, que é
  cache derivado e regenerável.
- **Transporte**: `expo-sharing`. O app escreve no diretório de cache e entrega
  ao share sheet do sistema; **quem escolhe o destino é o usuário**, num gesto
  explícito. O app não fala com Drive, e-mail nem nuvem nenhuma por conta
  própria — o que preserva a promessa do ADR-0001.
- **Restauração**: substitui todo o conteúdo, dentro de uma transação, depois de
  uma confirmação destrutiva que mostra a data do backup e quantas movimentações
  ele traz. Ou o banco fica inteiro com o backup, ou permanece como estava.
- **CSV**: caminho separado, só das transações, para abrir em planilha. Não
  restaura e não tenta ser backup — a distinção é dita na própria tela, porque
  um usuário que confunde os dois só descobre o erro quando precisa restaurar.

A lógica de serialização e validação vive em `src/services/backupFormat.ts`, um
módulo sem nenhum import nativo, para poder ser testado no vitest (CONTRIBUTING:
mockar módulo nativo não vale). O I/O fica em `backupService.ts` e o acesso ao
banco em `src/db/queries/backup.ts`, respeitando a regra de nada de SQL fora da
camada de queries.

## Consequências

**Fica mais fácil:** trocar de aparelho, reinstalar o app e experimentar sem
medo. O arquivo é legível e inspecionável — se o app um dia morrer, os dados do
usuário continuam recuperáveis por qualquer ferramenta que leia JSON, o que é
uma garantia que nem sincronização proprietária dá.

**Fica mais difícil:** o backup é manual. Ninguém é lembrado de fazê-lo, então
na prática o usuário desprevenido continua sem proteção — a diferença é que
agora existe a possibilidade. Um lembrete periódico resolveria isso e não foi
feito aqui para não misturar assuntos.

**Novo custo de manutenção:** toda migration que adicione tabela precisa entrar
em `BACKUP_TABLES`, ou os dados dessa tabela ficam de fora do backup em silêncio
— exatamente o tipo de falha que só aparece quando alguém tenta restaurar. Vale
tratar como parte do checklist de migration.

**Restauração é destrutiva e sem desfazer.** A confirmação explícita é a única
proteção; um "merge" entre backup e dados atuais foi descartado porque exigiria
resolver conflitos linha a linha, que é o problema do ADR-0002 entrando pela
porta dos fundos.
