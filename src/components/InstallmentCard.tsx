/**
 * Card que exibe uma compra parcelada, com progresso visual das parcelas
 * pagas.
 *
 * Usado na aba de Parcelas. Não busca dados sozinho — recebe tudo via props,
 * pra manter a lógica de dados isolada em src/db/queries.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { formatCents } from '../utils/money';

interface InstallmentCardProps {
  /** Nome da compra, ex: "Notebook Dell". */
  name: string;
  /** Nome da tag resolvido pelo chamador, ou null. */
  tagName: string | null;
  /** Parcela atual, 1-indexed. */
  currentInstallment: number;
  /** Total de parcelas. */
  installmentCount: number;
  /** Valor de cada parcela, em centavos. */
  installmentAmountCents: number;
}

export function InstallmentCard({
  name,
  tagName,
  currentInstallment,
  installmentCount,
  installmentAmountCents,
}: InstallmentCardProps) {
  const paid = Math.min(currentInstallment - 1, installmentCount);
  const progress = installmentCount > 0 ? paid / installmentCount : 0;
  const remainingCents = (installmentCount - paid) * installmentAmountCents;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="credit-card-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.tag}>{tagName || 'Sem categoria'}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.count}>
            {currentInstallment}/{installmentCount}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.detail}>{formatCents(installmentAmountCents)}/mês</Text>
        <Text style={styles.detail}>faltam {formatCents(remainingCents)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
    marginRight: 12,
  },
  titleBlock: { flex: 1, marginRight: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  badge: { backgroundColor: colors.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  count: { fontSize: 12, fontWeight: '700', color: colors.primary },
  tag: { fontSize: 12, color: colors.muted, marginTop: 2 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EDF1F7',
    marginTop: 16,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  detail: { fontSize: 13, color: colors.muted, fontWeight: '500' },
});
