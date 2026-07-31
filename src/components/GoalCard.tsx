/**
 * Card de meta financeira com barra de progresso e prazo. Não busca dados
 * sozinho — recebe a meta via props; ações (aporte, plano de IA, exclusão)
 * ficam com o chamador.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme/colors';
import type { Goal } from '../types';
import { formatCents } from '../utils/money';

interface GoalCardProps {
  goal: Goal;
  /** Chamado no toque — a tela abre as ações da meta. */
  onPress?: () => void;
}

export function GoalCard({ goal, onPress }: GoalCardProps) {
  const progress =
    goal.target_amount_cents > 0
      ? Math.min(goal.current_amount_cents / goal.target_amount_cents, 1)
      : 0;
  const deadline = goal.deadline
    ? new Date(goal.deadline * 1000).toLocaleDateString('pt-BR')
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="flag-variant-outline" size={20} color={colors.accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.detail}>
            {deadline ? `Prazo: ${deadline}` : 'Sem prazo definido'}
          </Text>
        </View>
        <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.amount}>
          {formatCents(goal.current_amount_cents)} de {formatCents(goal.target_amount_cents)}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
      </View>
    </TouchableOpacity>
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
    backgroundColor: '#E7F7F3',
    marginRight: 12,
  },
  titleBlock: { flex: 1, marginRight: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  percent: { fontSize: 14, fontWeight: '800', color: colors.accent },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EDF1F7',
    marginTop: 16,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 13, color: colors.muted, fontWeight: '600' },
});
