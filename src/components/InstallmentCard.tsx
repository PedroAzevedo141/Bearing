/**
 * Card que exibe uma compra parcelada, com progresso visual das parcelas
 * pagas.
 *
 * Usado na aba de Parcelas. Não busca dados sozinho — recebe tudo via props,
 * pra manter a lógica de dados isolada em src/db/queries.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.count}>
          {currentInstallment}/{installmentCount}
        </Text>
      </View>
      {tagName ? <Text style={styles.tag}>{tagName}</Text> : null}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: '#222222', flex: 1, marginRight: 8 },
  count: { fontSize: 14, fontWeight: '600', color: '#555555' },
  tag: { fontSize: 12, color: '#888888', marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEEEEE',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#2E86AB', borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  detail: { fontSize: 13, color: '#666666' },
});
