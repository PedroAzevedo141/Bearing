/**
 * useRecurring.ts
 *
 * Hook da aba Assinaturas: lista as assinaturas recorrentes e cadastra novas,
 * agendando o lembrete mensal no mesmo fluxo (sempre via notificationService,
 * nunca `expo-notifications` direto — isso derruba o app no Expo Go).
 */
import { useCallback, useEffect, useState } from 'react';

import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  RecurringWithTag,
} from '../db/queries/recurring';
import { scheduleRecurringReminder } from '../services/notificationService';

/** Estado e ações da aba Assinaturas. */
export interface UseRecurringResult {
  recurrings: RecurringWithTag[];
  loading: boolean;
  load: () => Promise<void>;
  /** Cadastra uma assinatura e agenda o lembrete mensal. */
  addRecurring: (
    name: string,
    amountCents: number,
    dayOfMonth: number,
    tagId: string | null
  ) => Promise<void>;
  /** Remove uma assinatura. */
  removeRecurring: (id: string) => Promise<void>;
}

/**
 * Carrega e mantém as assinaturas recorrentes.
 *
 * @returns Estado reativo + ações de escrita.
 */
export function useRecurring(): UseRecurringResult {
  const [recurrings, setRecurrings] = useState<RecurringWithTag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRecurrings(await listRecurring());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addRecurring = useCallback(
    async (name: string, amountCents: number, dayOfMonth: number, tagId: string | null) => {
      const rec = await createRecurring(name, amountCents, dayOfMonth, tagId);
      // Best-effort: falha de permissão não bloqueia o cadastro.
      void scheduleRecurringReminder(rec);
      await load();
    },
    [load]
  );

  const removeRecurring = useCallback(
    async (id: string) => {
      await deleteRecurring(id);
      // O lembrete mensal já agendado fica órfão até o próximo disparo — a tela
      // de confirmação trata assinatura inexistente. Não usamos "cancelar tudo"
      // aqui porque isso apagaria também os lembretes de parcela (espaço de
      // notificação é global e compartilhado).
      await load();
    },
    [load]
  );

  return { recurrings, loading, load, addRecurring, removeRecurring };
}
