/**
 * Linha de transação da aba Rotação. Não busca dados sozinho — recebe tudo
 * via props, pra manter a lógica de dados isolada em src/db/queries.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Transaction } from '../types';
import { MoneyText } from './MoneyText';

interface TransactionListItemProps {
  transaction: Transaction;
  /** Nome da tag resolvido pelo chamador (a linha não consulta o banco). */
  tagName: string | null;
}

export function TransactionListItem({ transaction, tagName }: TransactionListItemProps) {
  const signedCents =
    transaction.type === 'income' ? transaction.amount_cents : -transaction.amount_cents;
  const date = new Date(transaction.occurred_at * 1000).toLocaleDateString('pt-BR');

  return (
    <View style={styles.row}>
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
    </View>
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
    // Fundo opaco: a linha fica dentro de um SwipeableRow, precisa cobrir
    // as ações reveladas atrás dela enquanto ainda não foi arrastada.
    backgroundColor: '#FFFFFF',
  },
  info: { flex: 1, marginRight: 12 },
  description: { fontSize: 16, color: '#222222' },
  meta: { fontSize: 12, color: '#888888', marginTop: 2 },
});
