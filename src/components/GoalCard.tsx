/**
 * Card de meta financeira com barra de progresso e prazo. Não busca dados
 * sozinho — recebe a meta via props; ações (aporte, plano de IA, exclusão)
 * ficam com o chamador.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Goal } from '../types';
import { formatCents } from '../utils/money';

interface GoalCardProps {
  goal: Goal;
  /** Chamado no toque — a tela abre as ações da meta. */
  onPress?: () => void;
  /** Chamado no toque longo — o chamador decide confirmar/excluir. */
  onLongPress?: () => void;
}

export function GoalCard({ goal, onPress, onLongPress }: GoalCardProps) {
  const progress =
    goal.target_amount_cents > 0
      ? Math.min(goal.current_amount_cents / goal.target_amount_cents, 1)
      : 0;
  const deadline = goal.deadline
    ? new Date(goal.deadline * 1000).toLocaleDateString('pt-BR')
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {goal.name}
        </Text>
        <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.detail}>
          {formatCents(goal.current_amount_cents)} de {formatCents(goal.target_amount_cents)}
        </Text>
        {deadline ? <Text style={styles.detail}>até {deadline}</Text> : null}
      </View>
    </TouchableOpacity>
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
  percent: { fontSize: 14, fontWeight: '700', color: '#2E86AB' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEEEEE',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#1B7F4D', borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  detail: { fontSize: 13, color: '#666666' },
});
