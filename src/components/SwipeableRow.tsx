/**
 * Envolve uma linha de lista (TransactionListItem, InstallmentCard,
 * GoalCard) com gesto de swipe revelando "Editar"/"Excluir" — substitui o
 * antigo padrão de long-press, que só tinha exclusão. Não busca dados
 * sozinho — recebe os callbacks via props, quem decide o que "editar" e
 * "excluir" significam é a tela.
 *
 * Relacionado: docs/adr/0006-padrao-crud-editar-excluir.md
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { colors } from '../theme/colors';

interface SwipeableRowProps {
  /** Conteúdo normal da linha (o card/item já existente). */
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

export function SwipeableRow({ children, onEdit, onDelete }: SwipeableRowProps) {
  return (
    <Swipeable
      renderRightActions={() => (
        <>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: colors.primary }]}
            onPress={onEdit}
          >
            <Text style={styles.actionLabel}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, { backgroundColor: colors.negative }]}
            onPress={onDelete}
          >
            <Text style={styles.actionLabel}>Excluir</Text>
          </TouchableOpacity>
        </>
      )}
    >
      {children}
    </Swipeable>
  );
}

// Estilo em objeto (não className): as ações do Swipeable ficam num
// Animated.View interno do gesture-handler, fora do alcance do NativeWind.
const styles = StyleSheet.create({
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
