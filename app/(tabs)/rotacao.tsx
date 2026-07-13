/**
 * Aba 1 — Rotação do dinheiro: saldo líquido do período e lista de
 * entradas/saídas. Criar usa o formulário sempre visível no rodapé; editar
 * e excluir são via swipe em cada linha (ver docs/adr/0006).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import { TransactionForm } from '../../src/components/forms/TransactionForm';
import { MoneyText } from '../../src/components/MoneyText';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { TransactionListItem } from '../../src/components/TransactionListItem';
import { listTags } from '../../src/db/queries/tags';
import { useTransactions } from '../../src/hooks/useTransactions';
import type { Tag, Transaction } from '../../src/types';

/** Janela padrão da aba: últimos 30 dias. */
const PERIOD_DAYS = 30;

export default function RotacaoScreen() {
  const { transactions, netFlowCents, addTransaction, editTransaction, removeTransaction } =
    useTransactions(PERIOD_DAYS);

  const [tags, setTags] = useState<Tag[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Mapa id -> nome para as linhas da lista (a linha não consulta o banco).
  useEffect(() => {
    listTags().then(setTags);
  }, [transactions]);
  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  function confirmDelete(id: string) {
    confirmDestructive({
      title: 'Excluir transação?',
      message: 'Essa ação não pode ser desfeita.',
      onConfirm: () => removeTransaction(id),
    });
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="items-center py-5">
        <Text className="text-sm text-muted">Saldo dos últimos {PERIOD_DAYS} dias</Text>
        <MoneyText cents={netFlowCents} style={{ fontSize: 32, marginTop: 4 }} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow onEdit={() => setEditingTransaction(item)} onDelete={() => confirmDelete(item.id)}>
            <TransactionListItem
              transaction={item}
              tagName={item.tag_id ? (tagNameById.get(item.tag_id) ?? null) : null}
            />
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text className="mt-8 px-6 text-center text-muted">
            Nenhuma movimentação no período. Registre a primeira!
          </Text>
        }
      />

      {editingTransaction ? (
        <TransactionForm
          key={editingTransaction.id}
          mode="edit"
          initialTransaction={editingTransaction}
          initialTagName={
            editingTransaction.tag_id ? (tagNameById.get(editingTransaction.tag_id) ?? null) : null
          }
          onSubmit={async (input) => {
            await editTransaction(editingTransaction, input);
            setEditingTransaction(null);
          }}
          onCancel={() => setEditingTransaction(null)}
        />
      ) : (
        <TransactionForm mode="create" onSubmit={addTransaction} />
      )}
    </KeyboardAvoidingView>
  );
}
