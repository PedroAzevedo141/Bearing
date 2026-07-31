/**
 * Texto de valor monetário com cor semântica: verde para positivo,
 * vermelho para negativo, cinza para zero. Recebe centavos e formata
 * internamente — nunca recebe float.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { colors } from '../theme/colors';
import { formatCents } from '../utils/money';

interface MoneyTextProps {
  /** Valor em centavos (pode ser negativo). */
  cents: number;
  /** Estilo extra mesclado ao padrão (ex: fontSize maior no header). */
  style?: TextStyle;
}

export function MoneyText({ cents, style }: MoneyTextProps) {
  const color = cents > 0 ? styles.positive : cents < 0 ? styles.negative : styles.neutral;
  return <Text style={[styles.base, color, style]}>{formatCents(cents)}</Text>;
}

const styles = StyleSheet.create({
  base: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  positive: { color: colors.positive },
  negative: { color: colors.negative },
  neutral: { color: colors.muted },
});
