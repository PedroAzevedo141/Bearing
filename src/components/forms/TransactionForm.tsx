/**
 * Formulário de transação — usado tanto pra criar (aba Rotação) quanto pra
 * editar (via swipe numa linha existente). O mesmo componente serve os dois
 * casos por `mode`; a tela decide se o `onSubmit` chama `addTransaction` ou
 * `editTransaction`, este componente não fala com o banco.
 *
 * Não busca dados sozinho — recebe tudo via props.
 */
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import type { TransactionInput } from '../../hooks/useTransactions';
import { useThemeColors } from '../../theme/colors';
import type { Transaction, TransactionType } from '../../types';
import { parseCents } from '../../utils/money';

interface TransactionFormProps {
  /** 'create' mostra "Adicionar"; 'edit' mostra "Salvar". */
  mode: 'create' | 'edit';
  /** Transação sendo editada — obrigatório quando `mode === 'edit'`. */
  initialTransaction?: Transaction;
  /** Nome da tag da transação sendo editada, já resolvido pelo chamador. */
  initialTagName?: string | null;
  /** Chamado com os valores validados no submit. */
  onSubmit: (input: TransactionInput) => Promise<void> | void;
  /** Quando presente, mostra um botão "Cancelar" que o chama. */
  onCancel?: () => void;
}

export function TransactionForm({
  mode,
  initialTransaction,
  initialTagName,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const themeColors = useThemeColors();
  const [amount, setAmount] = useState(
    initialTransaction ? String(initialTransaction.amount_cents / 100).replace('.', ',') : ''
  );
  const [description, setDescription] = useState(initialTransaction?.description ?? '');
  const [tagName, setTagName] = useState(initialTagName ?? '');
  const [type, setType] = useState<TransactionType>(initialTransaction?.type ?? 'expense');

  async function handleSubmit() {
    const cents = parseCents(amount);
    if (cents === null || cents <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero, ex: 45,90');
      return;
    }
    await onSubmit({
      amountCents: cents,
      type,
      description: description.trim() || null,
      tagName: tagName.trim() || null,
    });
    if (mode === 'create') {
      setAmount('');
      setDescription('');
      setTagName('');
    }
  }

  return (
    <View className="gap-3 bg-surface p-4">
      <View className="flex-row gap-2">
        <Button
          mode={type === 'expense' ? 'contained' : 'outlined'}
          buttonColor={type === 'expense' ? themeColors.negative : undefined}
          onPress={() => setType('expense')}
          style={{ flex: 1 }}
        >
          Saída
        </Button>
        <Button
          mode={type === 'income' ? 'contained' : 'outlined'}
          buttonColor={type === 'income' ? themeColors.positive : undefined}
          onPress={() => setType('income')}
          style={{ flex: 1 }}
        >
          Entrada
        </Button>
      </View>
      <TextInput
        mode="outlined"
        label="Valor (ex: 45,90)"
        left={<TextInput.Affix text="R$" />}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput
        mode="outlined"
        label="Descrição (opcional)"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        mode="outlined"
        label="Tag (ex: mercado)"
        autoCapitalize="none"
        value={tagName}
        onChangeText={setTagName}
      />
      <Button mode="contained" onPress={handleSubmit} contentStyle={{ height: 48 }}>
        {mode === 'edit' ? 'Salvar' : 'Adicionar'}
      </Button>
      {onCancel ? (
        <Button mode="text" onPress={onCancel}>
          Cancelar
        </Button>
      ) : null}
    </View>
  );
}
