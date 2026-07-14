/**
 * Formulário de meta — usado tanto pra criar quanto pra editar (via swipe
 * num card existente). O mesmo componente serve os dois casos por `mode`;
 * a tela decide se o `onSubmit` chama `addGoal` ou `editGoal`, este
 * componente não fala com o banco.
 *
 * Edita só nome e valor-alvo — a criação também não coleta `deadline` hoje,
 * então a edição mantém o mesmo escopo (ver docs/adr/0006).
 *
 * Não busca dados sozinho — recebe tudo via props.
 */
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import type { Goal } from '../../types';
import { parseCents } from '../../utils/money';

/** Valores editáveis de uma meta (nome + valor-alvo). */
export interface GoalInput {
  name: string;
  targetCents: number;
}

interface GoalFormProps {
  mode: 'create' | 'edit';
  /** Meta sendo editada — obrigatório quando `mode === 'edit'`. */
  initialGoal?: Goal;
  /** Chamado com os valores validados no submit. */
  onSubmit: (input: GoalInput) => Promise<void> | void;
  /** Mostra um botão "Cancelar" que o chama. */
  onCancel: () => void;
}

export function GoalForm({ mode, initialGoal, onSubmit, onCancel }: GoalFormProps) {
  const [name, setName] = useState(initialGoal?.name ?? '');
  const [target, setTarget] = useState(
    initialGoal ? String(initialGoal.target_amount_cents / 100).replace('.', ',') : ''
  );

  async function handleSubmit() {
    const targetCents = parseCents(target);
    if (!name.trim() || targetCents === null || targetCents <= 0) {
      Alert.alert('Dados incompletos', 'Preencha nome e valor-alvo da meta.');
      return;
    }
    await onSubmit({ name: name.trim(), targetCents });
    if (mode === 'create') {
      setName('');
      setTarget('');
    }
  }

  return (
    <View className="gap-2 border-t border-border bg-surface p-4">
      <TextInput
        mode="outlined"
        label="Nome da meta (ex: Viagem)"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        mode="outlined"
        label="Valor-alvo (ex: 5000,00)"
        left={<TextInput.Affix text="R$" />}
        keyboardType="decimal-pad"
        value={target}
        onChangeText={setTarget}
      />
      <Button mode="contained" onPress={handleSubmit}>
        {mode === 'edit' ? 'Salvar' : 'Criar meta'}
      </Button>
      <Button mode="text" onPress={onCancel}>
        Cancelar
      </Button>
    </View>
  );
}
