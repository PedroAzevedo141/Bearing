/**
 * useRecurring.ts
 *
 * Hook da aba Assinaturas: lista as assinaturas recorrentes e cadastra novas,
 * agendando o lembrete mensal no mesmo fluxo (sempre via notificationService,
 * nunca `expo-notifications` direto — isso derruba o app no Expo Go).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  createRecurring,
  deleteRecurring,
  listPendingRecurring,
  listRecurring,
  RecurringWithTag,
} from '../db/queries/recurring';
import { scheduleRecurringReminder } from '../services/notificationService';
import type { MonthRef } from '../utils/date';

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

/** Estado do card "Pendências do mês" da aba Rotação. */
export interface UsePendingRecurringResult {
  pending: RecurringWithTag[];
  /** Recarrega — a tela chama depois de confirmar uma cobrança. */
  reload: () => Promise<void>;
}

/**
 * Assinaturas de uma competência que já venceram e ainda não foram lançadas.
 *
 * Existe porque o lembrete sozinho não fecha o ciclo: se a notificação passar
 * batida, a despesa nunca é registrada e o saldo fica errado em silêncio. Isto
 * não lança nada automaticamente — a confirmação humana do ADR-0008 continua
 * obrigatória; só deixa de depender de a notificação ter sido vista.
 *
 * @param month - Competência exibida na tela.
 * @returns Lista de pendências + recarga manual.
 */
export function usePendingRecurring(month: MonthRef): UsePendingRecurringResult {
  const [pending, setPending] = useState<RecurringWithTag[]>([]);
  const { month: monthNumber, year } = month;

  const reload = useCallback(async () => {
    setPending(await listPendingRecurring(monthNumber, year));
  }, [monthNumber, year]);

  // Recarrega ao focar, não só na montagem: a aba Rotação continua montada
  // enquanto o usuário cadastra uma assinatura ou confirma uma cobrança em
  // outra tela, e sem isto o card mostraria uma lista velha — inclusive
  // seguiria cobrando algo que o usuário acabou de lançar.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { pending, reload };
}
