/**
 * Aba 4 — Metas financeiras: lista de metas com progresso, aportes manuais
 * e plano de ação sugerido pela IA (structured output, renderizado como
 * lista de passos).
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GoalCard } from '../../src/components/GoalCard';
import { useGoalPlan } from '../../src/hooks/useAiInsight';
import { useGoals } from '../../src/hooks/useGoals';
import { formatCents, parseCents } from '../../src/utils/money';

export default function MetasScreen() {
  const { goals, addGoal, contribute, removeGoal } = useGoals();

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === selectedGoalId) ?? null,
    [goals, selectedGoalId]
  );
  const plan = useGoalPlan(selectedGoal);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [contribution, setContribution] = useState('');
  const [capacity, setCapacity] = useState('');

  async function handleAddGoal() {
    const targetCents = parseCents(target);
    if (!name.trim() || targetCents === null || targetCents <= 0) {
      Alert.alert('Dados incompletos', 'Preencha nome e valor-alvo da meta.');
      return;
    }
    await addGoal({ name: name.trim(), targetCents, deadline: null });
    setName('');
    setTarget('');
    setShowForm(false);
  }

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
    Alert.alert('Excluir meta?', 'O progresso registrado será perdido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          if (selectedGoalId === id) {
            setSelectedGoalId(null);
          }
          removeGoal(id);
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onPress={() => setSelectedGoalId(item.id === selectedGoalId ? null : item.id)}
            onLongPress={() => confirmDelete(item.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma meta ainda. Crie a primeira!</Text>}
        ListFooterComponent={
          selectedGoal ? (
            <View style={styles.detail}>
              <Text style={styles.detailTitle}>{selectedGoal.name}</Text>

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.input, styles.grow]}
                  placeholder="Aporte (ex: 200,00)"
                  keyboardType="decimal-pad"
                  value={contribution}
                  onChangeText={setContribution}
                />
                <Button title="Aportar" onPress={handleContribute} />
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.input, styles.grow]}
                  placeholder="Quanto guarda por mês?"
                  keyboardType="decimal-pad"
                  value={capacity}
                  onChangeText={setCapacity}
                />
                <Button title="Plano IA" onPress={handleGeneratePlan} disabled={plan.loading} />
              </View>

              {plan.loading ? <ActivityIndicator style={styles.spinner} /> : null}
              {plan.error ? <Text style={styles.error}>{plan.error}</Text> : null}
              {plan.data ? (
                <View style={styles.plan}>
                  <Text style={styles.planHeader}>
                    Sugestão: {formatCents(plan.data.suggested_monthly_cents)}/mês · ~
                    {plan.data.estimated_months} meses
                  </Text>
                  {plan.data.steps.map((step) => (
                    <Text key={step.order} style={styles.planStep}>
                      {step.order}. {step.description}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null
        }
      />

      {showForm ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nome da meta (ex: Viagem)"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Valor-alvo (ex: 5000,00)"
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
          />
          <Button title="Criar meta" onPress={handleAddGoal} />
          <Button title="Cancelar" color="#888888" onPress={() => setShowForm(false)} />
        </View>
      ) : (
        <View style={styles.form}>
          <Button title="Nova meta" onPress={() => setShowForm(true)} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F2' },
  list: { paddingVertical: 8 },
  empty: { textAlign: 'center', color: '#888888', marginTop: 32, paddingHorizontal: 24 },
  detail: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#222222' },
  rowInputs: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  grow: { flex: 1 },
  spinner: { marginVertical: 8 },
  error: { color: '#C0392B', fontSize: 14 },
  plan: { marginTop: 8, gap: 6 },
  planHeader: { fontWeight: '600', color: '#2E86AB', fontSize: 14 },
  planStep: { fontSize: 14, lineHeight: 20, color: '#333333' },
  form: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
});
