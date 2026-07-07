/**
 * Aba 2 — Compras parceladas: cards com progresso das parcelas e formulário
 * de cadastro. Cadastrar agenda lembretes locais de vencimento.
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

import { InstallmentCard } from '../../src/components/InstallmentCard';
import { listTags } from '../../src/db/queries/tags';
import { useInstallments } from '../../src/hooks/useInstallments';
import type { Tag } from '../../src/types';
import { installmentAmountCents, parseCents } from '../../src/utils/money';

export default function ParcelasScreen() {
  const { purchases, addPurchase, removePurchase } = useInstallments();

  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  const [count, setCount] = useState('');
  const [current, setCurrent] = useState('1');
  const [tagName, setTagName] = useState('');

  useEffect(() => {
    listTags().then(setTags);
  }, [purchases]);
  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  async function handleAdd() {
    const totalCents = parseCents(total);
    const installmentCount = Number.parseInt(count, 10);
    const currentInstallment = Number.parseInt(current, 10) || 1;
    if (!name.trim() || totalCents === null || totalCents <= 0 || !(installmentCount >= 1)) {
      Alert.alert('Dados incompletos', 'Preencha nome, valor total e número de parcelas.');
      return;
    }
    await addPurchase({
      name: name.trim(),
      totalCents,
      installmentCount,
      currentInstallment: Math.min(Math.max(currentInstallment, 1), installmentCount),
      firstDueDate: new Date(),
      tagName: tagName.trim() || null,
    });
    setName('');
    setTotal('');
    setCount('');
    setCurrent('1');
    setTagName('');
    setShowForm(false);
  }

  function confirmDelete(id: string) {
    Alert.alert('Excluir compra?', 'Os lembretes de parcela serão reagendados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removePurchase(id) },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={purchases}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <InstallmentCard
            name={item.name}
            tagName={item.tag_id ? (tagNameById.get(item.tag_id) ?? null) : null}
            currentInstallment={item.current_installment}
            installmentCount={item.installment_count}
            installmentAmountCents={installmentAmountCents(
              item.total_amount_cents,
              item.installment_count
            )}
            onLongPress={() => confirmDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma compra parcelada cadastrada.</Text>
        }
      />

      {showForm ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nome (ex: Notebook Dell)"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Valor total (ex: 3500,00)"
            keyboardType="decimal-pad"
            value={total}
            onChangeText={setTotal}
          />
          <View style={styles.rowInputs}>
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="Nº parcelas"
              keyboardType="number-pad"
              value={count}
              onChangeText={setCount}
            />
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="Parcela atual"
              keyboardType="number-pad"
              value={current}
              onChangeText={setCurrent}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Tag (opcional)"
            autoCapitalize="none"
            value={tagName}
            onChangeText={setTagName}
          />
          <Button title="Salvar" onPress={handleAdd} />
          <Button title="Cancelar" color="#888888" onPress={() => setShowForm(false)} />
        </View>
      ) : (
        <View style={styles.form}>
          <Button title="Nova compra parcelada" onPress={() => setShowForm(true)} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F2' },
  list: { paddingVertical: 8 },
  empty: { textAlign: 'center', color: '#888888', marginTop: 32, paddingHorizontal: 24 },
  form: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  rowInputs: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
});
