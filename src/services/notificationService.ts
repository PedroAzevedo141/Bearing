/**
 * notificationService.ts
 *
 * Agendamento local de lembretes de vencimento de parcela via
 * expo-notifications. Tudo roda no aparelho — não existe push server
 * (decisão registrada em docs/adr/0001-local-first-architecture.md).
 *
 * O import de `expo-notifications` tem efeito colateral: registra push
 * remoto assim que o módulo carrega, o que derruba o bundle inteiro dentro
 * do Expo Go desde o SDK 53 (suportado só em dev build/produção). Como este
 * app só usa notificação local agendada, o módulo real só é carregado fora
 * do Expo Go — dentro dele, os lembretes degradam silenciosamente para
 * no-op em vez de crashar o app.
 *
 * Relacionado: src/db/queries/installments.ts, src/hooks/useBudgets.ts,
 * src/hooks/useRecurring.ts
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';

import type { InstallmentPurchase, RecurringTransaction } from '../types';
import { formatCents, installmentAmountCents } from '../utils/money';

declare const require: (id: string) => unknown;

/** Hora local do dia em que os lembretes disparam. */
const REMINDER_HOUR = 9;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** null dentro do Expo Go — ver nota no topo do arquivo. */
const Notifications: typeof ExpoNotifications | null = isExpoGo
  ? null
  : (require('expo-notifications') as typeof ExpoNotifications);

if (Notifications) {
  // Exibe alerta mesmo com o app em primeiro plano.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Pede permissão de notificação ao usuário, se ainda não concedida.
 *
 * @returns true se o app pode agendar notificações. Sempre false no Expo Go.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) {
    return false;
  }
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
 *   Sempre `[]` no Expo Go.
 *
 * @example
 * const ids = await scheduleInstallmentReminders(compra);
 * // 1 notificação por parcela restante, às 9h do dia do vencimento
 */
export async function scheduleInstallmentReminders(
  purchase: InstallmentPurchase
): Promise<string[]> {
  if (!Notifications) {
    return [];
  }
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
  if (!Notifications) {
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Dispara imediatamente um aviso de orçamento (usado quando uma tag cruza 90%
 * do limite mensal). No-op no Expo Go.
 *
 * @param tagName - Nome da tag que atingiu o limite.
 * @param spentCents - Gasto atual da tag no mês, em centavos.
 * @param limitCents - Limite mensal da tag, em centavos.
 */
export async function notifyBudgetThreshold(
  tagName: string,
  spentCents: number,
  limitCents: number
): Promise<void> {
  if (!Notifications) {
    return;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Atenção ao orçamento ⚠️',
      body: `"${tagName}": ${formatCents(spentCents)} de ${formatCents(limitCents)} este mês (90%+).`,
    },
    trigger: null, // imediato
  });
}

/**
 * Agenda um lembrete mensal recorrente de uma assinatura, no dia do mês
 * escolhido. Ao tocar, a notificação carrega dados de deep link para a tela
 * de confirmação (o app nunca lança a transação sozinho — ver ADR-0008).
 * No-op no Expo Go; devolve o ID da notificação (ou null).
 *
 * @param recurring - Assinatura recém-cadastrada.
 * @returns ID da notificação agendada, ou null.
 */
export async function scheduleRecurringReminder(
  recurring: RecurringTransaction
): Promise<string | null> {
  if (!Notifications) {
    return null;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Assinatura recorrente 🗓️',
      body: `Chegou o dia de registrar "${recurring.name}" (${formatCents(recurring.amount_cents)}). Toque para confirmar.`,
      data: { href: `/assinaturas/confirm/${recurring.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: recurring.day_of_month,
      hour: REMINDER_HOUR,
      minute: 0,
    },
  });
}
