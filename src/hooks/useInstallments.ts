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
  type NewInstallmentPurchase,
} from '../db/queries/installments';
import { getOrCreateTag } from '../db/queries/tags';
import { scheduleInstallmentReminders } from '../services/notificationService';
import type { InstallmentPurchase } from '../types';

/** Estado e ações expostos pelo hook. */
export interface UseInstallmentsResult {
  purchases: InstallmentPurchase[];
  loading: boolean;
  /** Cadastra uma compra, cria a tag se preciso e agenda lembretes. */
  addPurchase: (input: {
    name: string;
    totalCents: number;
    installmentCount: number;
    currentInstallment: number;
    firstDueDate: Date;
    tagName: string | null;
  }) => Promise<void>;
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

  const addPurchase = useCallback(
    async (input: {
      name: string;
      totalCents: number;
      installmentCount: number;
      currentInstallment: number;
      firstDueDate: Date;
      tagName: string | null;
    }) => {
      const tag = input.tagName ? await getOrCreateTag(input.tagName) : null;
      const data: NewInstallmentPurchase = {
        name: input.name,
        tag_id: tag?.id ?? null,
        total_amount_cents: input.totalCents,
        installment_count: input.installmentCount,
        current_installment: input.currentInstallment,
        first_due_date: Math.floor(input.firstDueDate.getTime() / 1000),
      };
      const purchase = await createInstallmentPurchase(data);
      // Lembretes são best-effort: falha de permissão não bloqueia o cadastro.
      scheduleInstallmentReminders(purchase).catch(() => undefined);
      await refresh();
    },
    [refresh]
  );

  const removePurchase = useCallback(
    async (id: string) => {
      await deleteInstallmentPurchase(id);
      await refresh();
    },
    [refresh]
  );

  return { purchases, loading, addPurchase, removePurchase, refresh };
}
