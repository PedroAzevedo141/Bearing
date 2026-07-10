/**
 * Formulário de compra parcelada — usado tanto pra cadastrar quanto pra
 * editar (via swipe num card existente). O mesmo componente serve os dois
 * casos por `mode`; a tela decide se o `onSubmit` chama `addPurchase` ou
 * `editPurchase`, este componente não fala com o banco.
 *
 * Não busca dados sozinho — recebe tudo via props.
 */
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import type { InstallmentInput } from '../../hooks/useInstallments';
import type { InstallmentPurchase } from '../../types';
import { parseCents } from '../../utils/money';

interface InstallmentFormProps {
  /** 'create' mostra "Salvar"; 'edit' mostra o mesmo rótulo (edição não é criação nova). */
  mode: 'create' | 'edit';
  /** Compra sendo editada — obrigatório quando `mode === 'edit'`. */
  initialPurchase?: InstallmentPurchase;
  /** Nome da tag da compra sendo editada, já resolvido pelo chamador. */
  initialTagName?: string | null;
  /** Chamado com os valores validados no submit. */
  onSubmit: (input: InstallmentInput) => Promise<void> | void;
  /** Mostra um botão "Cancelar" que o chama. */
  onCancel: () => void;
}

export function InstallmentForm({
  mode,
  initialPurchase,
  initialTagName,
  onSubmit,
  onCancel,
}: InstallmentFormProps) {
  const [name, setName] = useState(initialPurchase?.name ?? '');
  const [total, setTotal] = useState(
    initialPurchase ? String(initialPurchase.total_amount_cents / 100).replace('.', ',') : ''
  );
  const [count, setCount] = useState(
    initialPurchase ? String(initialPurchase.installment_count) : ''
  );
  const [current, setCurrent] = useState(
    initialPurchase ? String(initialPurchase.current_installment) : '1'
  );
  const [tagName, setTagName] = useState(initialTagName ?? '');

  async function handleSubmit() {
    const totalCents = parseCents(total);
    const installmentCount = Number.parseInt(count, 10);
    const currentInstallment = Number.parseInt(current, 10) || 1;
    if (!name.trim() || totalCents === null || totalCents <= 0 || !(installmentCount >= 1)) {
      Alert.alert('Dados incompletos', 'Preencha nome, valor total e número de parcelas.');
      return;
    }
    if (currentInstallment < 1 || currentInstallment > installmentCount) {
      Alert.alert('Parcela inválida', 'A parcela atual precisa estar entre 1 e o total de parcelas.');
      return;
    }
    await onSubmit({
      name: name.trim(),
      totalCents,
      installmentCount,
      currentInstallment,
      firstDueDate: initialPurchase
        ? new Date(initialPurchase.first_due_date * 1000)
        : new Date(),
      tagName: tagName.trim() || null,
    });
    if (mode === 'create') {
      setName('');
      setTotal('');
      setCount('');
      setCurrent('1');
      setTagName('');
    }
  }

  return (
    <View className="gap-2 border-t border-border bg-surface p-4">
      <TextInput
        mode="outlined"
        label="Nome (ex: Notebook Dell)"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        mode="outlined"
        label="Valor total (ex: 3500,00)"
        keyboardType="decimal-pad"
        value={total}
        onChangeText={setTotal}
      />
      <View className="flex-row gap-2">
        <TextInput
          mode="outlined"
          label="Nº parcelas"
          keyboardType="number-pad"
          value={count}
          onChangeText={setCount}
          style={{ flex: 1 }}
        />
        <TextInput
          mode="outlined"
          label="Parcela atual"
          keyboardType="number-pad"
          value={current}
          onChangeText={setCurrent}
          style={{ flex: 1 }}
        />
      </View>
      <TextInput
        mode="outlined"
        label="Tag (opcional)"
        autoCapitalize="none"
        value={tagName}
        onChangeText={setTagName}
      />
      <Button mode="contained" onPress={handleSubmit}>
        Salvar
      </Button>
      <Button mode="text" onPress={onCancel}>
        Cancelar
      </Button>
    </View>
  );
}
