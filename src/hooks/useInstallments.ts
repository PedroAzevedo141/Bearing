/**
 * useInstallments.ts
 *
 * Hook da aba Parcelas: lista compras parceladas e cadastra novas,
 * agendando os lembretes de vencimento no mesmo fluxo.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  createInstallmentPurchase,
  deleteInstallmentPurchase,
  listInstallmentPurchases,
  updateInstallmentPurchase,
  type NewInstallmentPurchase,
} from '../db/queries/installments';
import { getOrCreateTag } from '../db/queries/tags';
import {
  cancelAllReminders,
  scheduleInstallmentReminders,
} from '../services/notificationService';
import type { InstallmentPurchase } from '../types';
import { isInstallmentCompleted } from '../utils/money';

/** Campos editáveis de uma compra parcelada, comuns a cadastrar e editar. */
export interface InstallmentInput {
  name: string;
  totalCents: number;
  installmentCount: number;
  currentInstallment: number;
  firstDueDate: Date;
  tagName: string | null;
}

/** Estado e ações expostos pelo hook. */
export interface UseInstallmentsResult {
  purchases: InstallmentPurchase[];
  loading: boolean;
  /** Cadastra uma compra, cria a tag se preciso e agenda lembretes. */
  addPurchase: (input: InstallmentInput) => Promise<void>;
  /**
   * Atualiza uma compra existente; a tag é criada se não existir. Reagenda
   * os lembretes de todas as compras ativas (o app não rastreia lembrete
   * por compra — ver notificationService.ts), evitando duplicar avisos da
   * compra editada.
   */
  editPurchase: (id: string, input: InstallmentInput) => Promise<void>;
  removePurchase: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Carrega e mantém as compras parceladas.
 *
 * @returns Estado reativo + ações de escrita.
 */
export function useInstallments(): UseInstallmentsResult {
  const [purchases, setPurchases] = useState<InstallmentPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPurchases(await listInstallmentPurchases());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toRecord = useCallback(
    async (input: InstallmentInput): Promise<NewInstallmentPurchase> => {
      const tag = input.tagName ? await getOrCreateTag(input.tagName) : null;
      return {
        name: input.name,
        tag_id: tag?.id ?? null,
        total_amount_cents: input.totalCents,
        installment_count: input.installmentCount,
        current_installment: input.currentInstallment,
        first_due_date: Math.floor(input.firstDueDate.getTime() / 1000),
      };
    },
    []
  );

  const addPurchase = useCallback(
    async (input: InstallmentInput) => {
      const data = await toRecord(input);
      const purchase = await createInstallmentPurchase(data);
      // Lembretes são best-effort: falha de permissão não bloqueia o cadastro.
      scheduleInstallmentReminders(purchase).catch(() => undefined);
      await refresh();
    },
    [refresh, toRecord]
  );

  const editPurchase = useCallback(
    async (id: string, input: InstallmentInput) => {
      const data = await toRecord(input);
      await updateInstallmentPurchase(id, data);
      const fresh = await listInstallmentPurchases();
      setPurchases(fresh);
      setLoading(false);
      // Best-effort: reagenda do zero pra não duplicar lembretes da compra editada.
      cancelAllReminders()
        .then(() =>
          Promise.all(
            fresh.filter((p) => !isInstallmentCompleted(p)).map(scheduleInstallmentReminders)
          )
        )
        .catch(() => undefined);
    },
    [toRecord]
  );

  const removePurchase = useCallback(
    async (id: string) => {
      await deleteInstallmentPurchase(id);
      await refresh();
    },
    [refresh]
  );

  return { purchases, loading, addPurchase, editPurchase, removePurchase, refresh };
}
