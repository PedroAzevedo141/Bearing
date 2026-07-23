/**
 * Linha de transação da aba Rotação. Não busca dados sozinho — recebe tudo
 * via props, pra manter a lógica de dados isolada em src/db/queries.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
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
      <View
        style={[
          styles.icon,
          transaction.type === 'income' ? styles.incomeIcon : styles.expenseIcon,
        ]}
      >
        <MaterialCommunityIcons
          name={transaction.type === 'income' ? 'arrow-bottom-left' : 'arrow-top-right'}
          size={18}
          color={transaction.type === 'income' ? colors.positive : colors.negative}
        />
      </View>
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
    paddingVertical: 13,
    paddingHorizontal: 14,
    // Fundo opaco: a linha fica dentro de um SwipeableRow, precisa cobrir
    // as ações reveladas atrás dela enquanto ainda não foi arrastada.
    backgroundColor: colors.surface,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  incomeIcon: { backgroundColor: '#E8F7F1' },
  expenseIcon: { backgroundColor: '#FDECEF' },
  info: { flex: 1, marginRight: 12 },
  description: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
});
