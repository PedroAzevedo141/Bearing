/**
 * vitest.config.ts
 *
 * Ambiente Node puro (sem RN/Expo) — os testes desta sprint cobrem só
 * lógica pura (src/utils/money.ts) e o runner de migrations abstraído via
 * MigratableDb (src/db/index.ts). Nenhum teste depende de runtime React
 * Native, então não há necessidade de um preset tipo jest-expo aqui.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
