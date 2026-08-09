/**
 * Linha de transação da aba Rotação. Não busca dados sozinho — recebe tudo
 * via props, pra manter a lógica de dados isolada em src/db/queries.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors, type ThemeColors } from '../theme/colors';
import type { Transaction } from '../types';
import { MoneyText } from './MoneyText';

interface TransactionListItemProps {
  transaction: Transaction;
  /** Nome da tag resolvido pelo chamador (a linha não consulta o banco). */
  tagName: string | null;
}

export function TransactionListItem({ transaction, tagName }: TransactionListItemProps) {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
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
          color={transaction.type === 'income' ? themeColors.positive : themeColors.negative}
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

/**
 * Estilos dependem do tema, então são uma fábrica em vez de constante de
 * módulo: `StyleSheet.create` no topo do arquivo congelaria as cores do tema
 * claro na primeira avaliação.
 */
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
  // Véu da própria cor semântica em vez de um tom claro fixo: assim o fundo
  // acompanha o tema em vez de virar uma mancha clara no escuro.
  incomeIcon: { backgroundColor: `${colors.positive}22` },
  expenseIcon: { backgroundColor: `${colors.negative}22` },
  info: { flex: 1, marginRight: 12 },
  description: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  });
