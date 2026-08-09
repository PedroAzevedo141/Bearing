/** Metas financeiras com progresso consolidado e aportes rápidos. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { FAB, Modal, Portal, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import { EmptyState } from '../../src/components/EmptyState';
import { GoalForm } from '../../src/components/forms/GoalForm';
import { GoalCard } from '../../src/components/GoalCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { useGoals } from '../../src/hooks/useGoals';
import { useThemeColors } from '../../src/theme/colors';
import type { Goal } from '../../src/types';
import { formatCents, parseCents } from '../../src/utils/money';

export default function MetasScreen() {
  const themeColors = useThemeColors();
  const { goals, addGoal, editGoal, contribute, removeGoal } = useGoals();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? null,
    [goals, selectedGoalId]
  );
  const totals = useMemo(
    () =>
      goals.reduce(
        (result, goal) => ({
          current: result.current + goal.current_amount_cents,
          target: result.target + goal.target_amount_cents,
        }),
        { current: 0, target: 0 }
      ),
    [goals]
  );
  const overallProgress =
    totals.target > 0 ? Math.min(Math.round((totals.current / totals.target) * 100), 100) : 0;

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState('');

  function closeForm() {
    setShowForm(false);
    setEditingGoal(null);
  }

  async function handleContribute() {
    const cents = parseCents(contribution);
    if (!selectedGoal || cents === null || cents <= 0) {
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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 104 }}
          renderItem={({ item }) => (
            <SwipeableRow
              onEdit={() => setEditingGoal(item)}
              onDelete={() => confirmDelete(item.id)}
            >
              <GoalCard
                goal={item}
                onPress={() => setSelectedGoalId(item.id === selectedGoalId ? null : item.id)}
              />
            </SwipeableRow>
          )}
          ListHeaderComponent={
            <View>
              <ScreenHeader
                eyebrow="Construção"
                title="Metas"
                description="Transforme planos grandes em pequenos avanços visíveis."
                icon="target"
              />
              <View className="mx-5 mb-5 overflow-hidden rounded-3xl bg-spotlight p-5">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm text-white/60">Progresso combinado</Text>
                    <Text className="mt-1 text-2xl font-bold text-white">
                      {formatCents(totals.current)}
                    </Text>
                  </View>
                  <View className="h-14 w-14 items-center justify-center rounded-full border-4 border-accent">
                    <Text className="text-xs font-bold text-white">{overallProgress}%</Text>
                  </View>
                </View>
                <View className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <View
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${overallProgress}%` }}
                  />
                </View>
                <Text className="mt-2 text-xs text-white/60">
                  Objetivo total: {formatCents(totals.target)}
                </Text>
              </View>
              <View className="mb-2 flex-row items-end justify-between px-5">
                <View>
                  <Text className="text-lg font-bold text-ink">Seus objetivos</Text>
                  <Text className="text-xs text-muted">Toque em uma meta para fazer um aporte</Text>
                </View>
                <Text className="text-xs font-bold text-primary">{goals.length} metas</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="flag-plus-outline"
              title="Escolha algo para conquistar"
              description="Crie uma meta e acompanhe cada aporte até chegar ao valor desejado."
              actionLabel="Criar primeira meta"
              onAction={() => setShowForm(true)}
            />
          }
          ListFooterComponent={
            selectedGoal ? (
              <View className="mx-5 mt-3 rounded-3xl border border-primary/20 bg-tint p-4">
                <View className="mb-3 flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface">
                    <MaterialCommunityIcons name="piggy-bank-outline" size={21} color={themeColors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">Aportar em {selectedGoal.name}</Text>
                    <Text className="text-xs text-muted">
                      Faltam {formatCents(Math.max(
                        selectedGoal.target_amount_cents - selectedGoal.current_amount_cents,
                        0
                      ))}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    mode="outlined"
                    label="Valor do aporte"
                    left={<TextInput.Affix text="R$" />}
                    keyboardType="decimal-pad"
                    value={contribution}
                    onChangeText={setContribution}
                    style={{ flex: 1, backgroundColor: themeColors.surface }}
                  />
                  <Button mode="contained" onPress={handleContribute} disabled={!contribution.trim()}>
                    Aportar
                  </Button>
                </View>
              </View>
            ) : null
          }
        />

        <FAB
          icon="plus"
          label="Nova meta"
          onPress={() => setShowForm(true)}
          style={{ position: 'absolute', right: 20, bottom: 18 }}
        />

        <Portal>
          <Modal
            visible={showForm || editingGoal !== null}
            onDismiss={closeForm}
            contentContainerStyle={{
              margin: 20,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: themeColors.surface,
            }}
          >
            <View className="px-4 pt-4">
              <Text className="text-xl font-bold text-ink">
                {editingGoal ? 'Editar meta' : 'Nova meta'}
              </Text>
              <Text className="mt-1 text-sm text-muted">Dê um nome ao plano e defina o valor final.</Text>
            </View>
            {editingGoal ? (
              <GoalForm
                key={editingGoal.id}
                mode="edit"
                initialGoal={editingGoal}
                onSubmit={async (input) => {
                  await editGoal(editingGoal.id, input);
                  closeForm();
                }}
                onCancel={closeForm}
              />
            ) : (
              <GoalForm
                mode="create"
                onSubmit={async (input) => {
                  await addGoal({ ...input, deadline: null });
                  closeForm();
                }}
                onCancel={closeForm}
              />
            )}
          </Modal>
        </Portal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
