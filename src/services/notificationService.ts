/**
 * notificationService.ts
 *
 * Agendamento local de lembretes de vencimento de parcela via
 * expo-notifications. Tudo roda no aparelho — não existe push server
 * (decisão registrada em docs/adr/0001-local-first-architecture.md).
 *
 * Relacionado: src/db/queries/installments.ts
 */
import * as Notifications from 'expo-notifications';

import type { InstallmentPurchase } from '../types';
import { formatCents, installmentAmountCents } from '../utils/money';

/** Hora local do dia em que os lembretes disparam. */
const REMINDER_HOUR = 9;

// Exibe alerta mesmo com o app em primeiro plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Pede permissão de notificação ao usuário, se ainda não concedida.
 *
 * @returns true se o app pode agendar notificações.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Agenda um lembrete local para cada parcela futura de uma compra.
 *
 * Vencimentos são projetados somando meses ao `first_due_date` (mesma
 * lógica de fatura de cartão). Parcelas com vencimento no passado são
 * ignoradas silenciosamente.
 *
 * @param purchase - Compra parcelada recém-cadastrada.
 * @returns IDs das notificações agendadas (úteis para cancelamento futuro).
 *
 * @example
 * const ids = await scheduleInstallmentReminders(compra);
 * // 1 notificação por parcela restante, às 9h do dia do vencimento
 */
export async function scheduleInstallmentReminders(
  purchase: InstallmentPurchase
): Promise<string[]> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return [];
  }

  const perInstallment = installmentAmountCents(
    purchase.total_amount_cents,
    purchase.installment_count
  );
  const firstDue = new Date(purchase.first_due_date * 1000);
  const ids: string[] = [];

  for (let n = purchase.current_installment; n <= purchase.installment_count; n += 1) {
    const due = new Date(firstDue);
    due.setMonth(due.getMonth() + (n - 1));
    due.setHours(REMINDER_HOUR, 0, 0, 0);
    if (due.getTime() <= Date.now()) {
      continue;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Parcela ${n}/${purchase.installment_count} — ${purchase.name}`,
        body: `Vence hoje: ${formatCents(perInstallment)}`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: due,
      },
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Cancela todos os lembretes agendados pelo app.
 *
 * Usada quando o usuário apaga uma compra — o MVP não rastreia notificação
 * por compra, então cancela tudo e reagenda as compras restantes.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
