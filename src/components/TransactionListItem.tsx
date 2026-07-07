/**
 * Linha de transação da aba Rotação. Não busca dados sozinho — recebe tudo
 * via props, pra manter a lógica de dados isolada em src/db/queries.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Transaction } from '../types';
import { MoneyText } from './MoneyText';

interface TransactionListItemProps {
  transaction: Transaction;
  /** Nome da tag resolvido pelo chamador (a linha não consulta o banco). */
  tagName: string | null;
  /** Chamado no toque longo — o chamador decide confirmar/excluir. */
  onLongPress?: () => void;
}

export function TransactionListItem({ transaction, tagName, onLongPress }: TransactionListItemProps) {
  const signedCents =
    transaction.type === 'income' ? transaction.amount_cents : -transaction.amount_cents;
  const date = new Date(transaction.occurred_at * 1000).toLocaleDateString('pt-BR');

  return (
    <TouchableOpacity style={styles.row} onLongPress={onLongPress} delayLongPress={400}>
      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description || (transaction.type === 'income' ? 'Entrada' : 'Saída')}
        </Text>
        <Text style={styles.meta}>
          {date}
          {tagName ? ` · ${tagName}` : ''}
        </Text>
      </View>
      <MoneyText cents={signedCents} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  info: { flex: 1, marginRight: 12 },
  description: { fontSize: 16, color: '#222222' },
  meta: { fontSize: 12, color: '#888888', marginTop: 2 },
});
