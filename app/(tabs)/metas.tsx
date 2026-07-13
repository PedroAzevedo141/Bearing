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
import { useGoalPlan } from '../../src/hooks/useAiInsight';
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
  const plan = useGoalPlan(selectedGoal);

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState('');
  const [capacity, setCapacity] = useState('');

  async function handleContribute() {
    const cents = parseCents(contribution);
    if (!selectedGoal || cents === null || cents === 0) {
      return;
    }
    await contribute(selectedGoal.id, cents);
    setContribution('');
  }

  async function handleGeneratePlan() {
    const capacityCents = parseCents(capacity);
    if (capacityCents === null || capacityCents <= 0) {
      Alert.alert('Capacidade mensal', 'Informe quanto você consegue guardar por mês.');
      return;
    }
    await plan.generate(capacityCents);
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
                  keyboardType="decimal-pad"
                  value={contribution}
                  onChangeText={setContribution}
                  style={{ flex: 1 }}
                />
                <Button mode="contained" onPress={handleContribute}>
                  Aportar
                </Button>
              </View>

              <View className="flex-row items-center gap-2">
                <TextInput
                  mode="outlined"
                  label="Quanto guarda por mês?"
                  keyboardType="decimal-pad"
                  value={capacity}
                  onChangeText={setCapacity}
                  style={{ flex: 1 }}
                />
                <Button mode="contained" onPress={handleGeneratePlan} disabled={plan.loading}>
                  Plano IA
                </Button>
              </View>

              {plan.loading ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}
              {plan.error ? (
                <Text style={{ color: colors.negative }} className="text-sm">
                  {plan.error}
                </Text>
              ) : null}
              {plan.data ? (
                <View className="mt-2 gap-1.5">
                  <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                    Sugestão: {formatCents(plan.data.suggested_monthly_cents)}/mês · ~
                    {plan.data.estimated_months} meses
                  </Text>
                  {plan.data.steps.map((step) => (
                    <Text key={step.order} className="text-sm leading-5 text-neutral-800">
                      {step.order}. {step.description}
                    </Text>
                  ))}
                </View>
              ) : null}
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
