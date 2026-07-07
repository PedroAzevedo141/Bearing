/**
 * Aba 1 — Rotação do dinheiro: saldo líquido do período e lista de
 * entradas/saídas, com formulário inline para registrar transações.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
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

import { MoneyText } from '../../src/components/MoneyText';
import { TransactionListItem } from '../../src/components/TransactionListItem';
import { listTags } from '../../src/db/queries/tags';
import { useTransactions } from '../../src/hooks/useTransactions';
import type { Tag, TransactionType } from '../../src/types';
import { parseCents } from '../../src/utils/money';

/** Janela padrão da aba: últimos 30 dias. */
const PERIOD_DAYS = 30;

export default function RotacaoScreen() {
  const { transactions, netFlowCents, addTransaction, removeTransaction } =
    useTransactions(PERIOD_DAYS);

  const [tags, setTags] = useState<Tag[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [tagName, setTagName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');

  // Mapa id -> nome para as linhas da lista (a linha não consulta o banco).
  useEffect(() => {
    listTags().then(setTags);
  }, [transactions]);
  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  async function handleAdd() {
    const cents = parseCents(amount);
    if (cents === null || cents <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero, ex: 45,90');
      return;
    }
    await addTransaction({
      amountCents: cents,
      type,
      description: description.trim() || null,
      tagName: tagName.trim() || null,
    });
    setAmount('');
    setDescription('');
    setTagName('');
  }

  function confirmDelete(id: string) {
    Alert.alert('Excluir transação?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeTransaction(id) },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Saldo dos últimos {PERIOD_DAYS} dias</Text>
        <MoneyText cents={netFlowCents} style={styles.summaryValue} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionListItem
            transaction={item}
            tagName={item.tag_id ? (tagNameById.get(item.tag_id) ?? null) : null}
            onLongPress={() => confirmDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma movimentação no período. Registre a primeira!</Text>
        }
      />

      <View style={styles.form}>
        <View style={styles.typeRow}>
          <Button
            title="Saída"
            color={type === 'expense' ? '#C0392B' : '#AAAAAA'}
            onPress={() => setType('expense')}
          />
          <Button
            title="Entrada"
            color={type === 'income' ? '#1B7F4D' : '#AAAAAA'}
            onPress={() => setType('income')}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Valor (ex: 45,90)"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Tag (ex: mercado)"
          autoCapitalize="none"
          value={tagName}
          onChangeText={setTagName}
        />
        <Button title="Adicionar" onPress={handleAdd} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F2' },
  summary: { alignItems: 'center', paddingVertical: 20 },
  summaryLabel: { fontSize: 13, color: '#888888' },
  summaryValue: { fontSize: 32, marginTop: 4 },
  empty: { textAlign: 'center', color: '#888888', marginTop: 32, paddingHorizontal: 24 },
  form: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  typeRow: { flexDirection: 'row', justifyContent: 'space-around' },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
});
