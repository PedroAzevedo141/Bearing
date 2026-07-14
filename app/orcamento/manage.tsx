import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Button, TextInput } from 'react-native-paper';
import { useBudgets } from '../../src/hooks/useBudgets';
import { getOrCreateTag } from '../../src/db/queries/tags';
import { parseCents } from '../../src/utils/money';
import { SwipeableRow } from '../../src/components/SwipeableRow';

export default function BudgetManageScreen() {
  const { budgets, saveBudget, removeBudget } = useBudgets();
  const [tagName, setTagName] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    const cents = parseCents(limitAmount);
    if (!tagName.trim() || !cents || cents <= 0) {
      alert('Informe a tag e um valor válido.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const tag = await getOrCreateTag(tagName.trim());
      await saveBudget(tag.id, cents);
      setTagName('');
      setLimitAmount('');
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar orçamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Gerenciar Orçamentos' }} />
      
      <View className="p-4 bg-surface border-b border-border gap-2">
        <Text className="text-sm text-neutral-600 mb-2">
          Defina um limite mensal para os gastos de uma tag. Ao atingir 90%, você receberá um alerta.
        </Text>
        <TextInput
          mode="outlined"
          label="Tag (ex: mercado)"
          value={tagName}
          onChangeText={setTagName}
          autoCapitalize="none"
        />
        <TextInput
          mode="outlined"
          label="Limite Mensal"
          left={<TextInput.Affix text="R$" />}
          value={limitAmount}
          onChangeText={setLimitAmount}
          keyboardType="decimal-pad"
        />
        <Button mode="contained" onPress={handleSave} loading={isSubmitting} disabled={isSubmitting}>
          Salvar Orçamento
        </Button>
      </View>

      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => removeBudget(item.id)}>
            <View className="px-6 py-4 bg-surface flex-row justify-between items-center">
              <Text className="text-base font-bold text-neutral-900">{item.tagName}</Text>
              <Text className="text-base text-neutral-600">Limite: R$ {(item.limit_cents / 100).toFixed(2).replace('.', ',')}</Text>
            </View>
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text className="mt-8 px-6 text-center text-muted">
            Nenhum orçamento definido.
          </Text>
        }
      />
    </KeyboardAvoidingView>
  );
}
