import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { listRecurring, createRecurring, deleteRecurring, RecurringWithTag } from '../db/queries/recurring';

export function useRecurring() {
  const [recurrings, setRecurrings] = useState<RecurringWithTag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listRecurring();
    setRecurrings(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addRecurring = useCallback(async (
    name: string,
    amount_cents: number,
    day_of_month: number,
    tag_id: string | null
  ) => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    const rec = await createRecurring(name, amount_cents, day_of_month, tag_id);
    
    // Agendar notificação mensal no dia selecionado
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Assinatura Recorrente 🗓️',
        body: `Chegou o dia de registrar o pagamento de "${name}". Toque para confirmar.`,
        data: { url: '/rotacao', action: 'recurring_prompt', recurring_id: rec.id }
      },
      trigger: {
        day: day_of_month,
        hour: 9, // 9 da manhã
        minute: 0,
        repeats: true,
      } as any,
    });

    await load();
  }, [load]);

  const removeRecurring = useCallback(async (id: string) => {
    await deleteRecurring(id);
    // Idealmente cancelar a notificação agendada aqui,
    // mas pro MVP vamos deixar (ela abrirá o app, mas o registro não existirá).
    await load();
  }, [load]);

  return { recurrings, loading, load, addRecurring, removeRecurring };
}
