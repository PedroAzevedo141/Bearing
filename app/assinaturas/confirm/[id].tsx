import { Stack, useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { getRecurringById, RecurringWithTag } from '../../../src/db/queries/recurring';
import { TransactionForm } from '../../../src/components/forms/TransactionForm';
import { useTransactions } from '../../../src/hooks/useTransactions';
import { colors } from '../../../src/theme/colors';

export default function ConfirmRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recurring, setRecurring] = useState<RecurringWithTag | null>(null);
  const [loading, setLoading] = useState(true);
  const { addTransaction } = useTransactions(30);

  useEffect(() => {
    async function load() {
      if (id) {
        const data = await getRecurringById(id);
        setRecurring(data);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const header = (
    <Stack.Screen
      options={{
        title: 'Confirmar assinatura',
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
      }}
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <View className="flex-1 justify-center items-center bg-background">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!recurring) {
    return (
      <>
        {header}
        <View className="flex-1 justify-center items-center bg-background p-4">
          <Text className="text-lg text-neutral-800 text-center">Assinatura não encontrada.</Text>
        </View>
      </>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {header}
      <View className="p-4">
        <Text className="text-base text-neutral-800 mb-4 text-center">
          Chegou o dia de registrar o pagamento da sua assinatura. Confirme os dados abaixo para registrar na sua movimentação.
        </Text>
      </View>
      <View className="flex-1">
        <TransactionForm
          mode="create"
          initialTransaction={{
            id: 'temp',
            amount_cents: recurring.amount_cents,
            description: recurring.name,
            type: 'expense',
            tag_id: recurring.tag_id,
            account_id: 'temp',
            occurred_at: Math.floor(Date.now() / 1000),
            created_at: Math.floor(Date.now() / 1000)
          }}
          initialTagName={recurring.tagName}
          onSubmit={async (input) => {
            await addTransaction(input);
            router.replace('/(tabs)/rotacao'); // Volta para a tela principal
          }}
          onCancel={() => router.back()}
        />
      </View>
    </View>
  );
}
