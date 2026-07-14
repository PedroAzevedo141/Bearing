/**
 * Aba 4 — Metas financeiras: lista de metas com progresso, aportes manuais
 * e plano de ação sugerido pela IA (structured output, renderizado como
 * lista de passos). Editar/excluir a meta são via swipe no card
 * (ver docs/adr/0006); aporte e plano de IA ficam no painel de detalhe.
 */
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { ActivityIndicator, Button, TextInput } from 'react-native-paper';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import { GoalForm } from '../../src/components/forms/GoalForm';
import { GoalCard } from '../../src/components/GoalCard';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { useGoals } from '../../src/hooks/useGoals';
import { colors } from '../../src/theme/colors';
import type { Goal } from '../../src/types';
import { formatCents, parseCents } from '../../src/utils/money';

export default function MetasScreen() {
  const { goals, addGoal, editGoal, contribute, removeGoal } = useGoals();

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === selectedGoalId) ?? null,
    [goals, selectedGoalId]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState('');

  async function handleContribute() {
    const cents = parseCents(contribution);
    if (!selectedGoal || cents === null || cents === 0) {
      return;
    }
    await contribute(selectedGoal.id, cents);
    setContribution('');
  }

  function confirmDelete(id: string) {
    confirmDestructive({
      title: 'Excluir meta?',
      message: 'O progresso registrado será perdido.',
      onConfirm: () => {
        if (selectedGoalId === id) {
          setSelectedGoalId(null);
        }
        removeGoal(id);
      },
    });
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerClassName="py-2"
        renderItem={({ item }) => (
          <SwipeableRow onEdit={() => setEditingGoal(item)} onDelete={() => confirmDelete(item.id)}>
            <GoalCard
              goal={item}
              onPress={() => setSelectedGoalId(item.id === selectedGoalId ? null : item.id)}
            />
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text className="mt-8 px-6 text-center text-muted">
            Nenhuma meta ainda. Crie a primeira!
          </Text>
        }
        ListFooterComponent={
          selectedGoal ? (
            <View className="mx-4 mt-2 gap-2 rounded-xl bg-surface p-4">
              <Text className="text-base font-bold text-neutral-900">{selectedGoal.name}</Text>

              <View className="flex-row items-center gap-2">
                <TextInput
                  mode="outlined"
                  label="Aporte (ex: 200,00)"
                  left={<TextInput.Affix text="R$" />}
                  keyboardType="decimal-pad"
                  value={contribution}
                  onChangeText={setContribution}
                  style={{ flex: 1 }}
                />
                <Button mode="contained" onPress={handleContribute}>
                  Aportar
                </Button>
              </View>
            </View>
          ) : null
        }
      />

      {editingGoal ? (
        <GoalForm
          key={editingGoal.id}
          mode="edit"
          initialGoal={editingGoal}
          onSubmit={async (input) => {
            await editGoal(editingGoal.id, input);
            setEditingGoal(null);
          }}
          onCancel={() => setEditingGoal(null)}
        />
      ) : showForm ? (
        <GoalForm
          mode="create"
          onSubmit={(input) => addGoal({ ...input, deadline: null })}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <View className="border-t border-border bg-surface p-4">
          <Button mode="contained" onPress={() => setShowForm(true)}>
            Nova meta
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
