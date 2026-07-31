/**
 * Resumo financeiro: visão do período, atalhos e movimentações recentes.
 * Os formulários são abertos sob demanda para manter o foco no conteúdo.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FAB, Modal, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import { EmptyState } from '../../src/components/EmptyState';
import { TransactionForm } from '../../src/components/forms/TransactionForm';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { TransactionListItem } from '../../src/components/TransactionListItem';
import { listTags } from '../../src/db/queries/tags';
import { useBudgets } from '../../src/hooks/useBudgets';
import { useInstallments } from '../../src/hooks/useInstallments';
import { useTransactions } from '../../src/hooks/useTransactions';
import { colors } from '../../src/theme/colors';
import type { Tag, Transaction } from '../../src/types';
import { formatCents, installmentAmountCents, isInstallmentCompleted } from '../../src/utils/money';

const PERIOD_DAYS = 30;

interface QuickActionProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  hint: string;
  onPress: () => void;
}

function QuickAction({ icon, label, hint, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity
      className="min-w-0 flex-1 rounded-2xl border border-border bg-surface p-2.5"
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${hint}`}
    >
      <View className="mb-2.5 h-9 w-9 items-center justify-center rounded-xl bg-tint">
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} />
      </View>
      <Text
        className="text-sm font-bold text-ink"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
      >
        {label}
      </Text>
      <Text className="mt-0.5 text-xs text-muted" numberOfLines={2}>
        {hint}
      </Text>
    </TouchableOpacity>
  );
}

export default function RotacaoScreen() {
  const { transactions, netFlowCents, addTransaction, editTransaction, removeTransaction } =
    useTransactions(PERIOD_DAYS);
  const { budgets } = useBudgets();
  const { purchases } = useInstallments();
  const [tags, setTags] = useState<Tag[]>([]);

  // Compromisso mensal das parcelas ativas — derivado, nunca gravado como
  // transação (por isso não entra no saldo acima). Ver ADR sobre parcelas.
  const monthlyInstallmentCents = useMemo(
    () =>
      purchases
        .filter((p) => !isInstallmentCompleted(p))
        .reduce(
          (sum, p) => sum + installmentAmountCents(p.total_amount_cents, p.installment_count),
          0
        ),
    [purchases]
  );
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    listTags().then(setTags);
  }, [transactions]);

  const tagNameById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const totals = useMemo(
    () =>
      transactions.reduce(
        (result, transaction) => {
          result[transaction.type] += transaction.amount_cents;
          return result;
        },
        { income: 0, expense: 0 }
      ),
    [transactions]
  );

  function closeForm() {
    setShowForm(false);
    setEditingTransaction(null);
  }

  function confirmDelete(id: string) {
    confirmDestructive({
      title: 'Excluir transação?',
      message: 'Essa ação não pode ser desfeita.',
      onConfirm: () => removeTransaction(id),
    });
  }

  const listHeader = (
    <View>
      <ScreenHeader
        eyebrow="Seu dinheiro"
        title="Visão geral"
        description={`Acompanhe o ritmo dos últimos ${PERIOD_DAYS} dias.`}
        icon="chart-areaspline"
      />

      <View className="mx-5 overflow-hidden rounded-3xl bg-ink p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-medium text-white/60">Saldo do período</Text>
            <Text className="mt-1 text-3xl font-bold tracking-tight text-white">
              {formatCents(netFlowCents)}
            </Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <MaterialCommunityIcons name="wallet-outline" size={23} color="#FFFFFF" />
          </View>
        </View>
        <View className="mt-5 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-white/10 p-3">
            <Text className="text-xs text-white/60">Entradas</Text>
            <Text className="mt-1 text-base font-bold text-white">{formatCents(totals.income)}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/10 p-3">
            <Text className="text-xs text-white/60">Saídas</Text>
            <Text className="mt-1 text-base font-bold text-white">{formatCents(totals.expense)}</Text>
          </View>
        </View>
      </View>

      {monthlyInstallmentCents > 0 ? (
        <View className="mx-5 mt-4 flex-row items-center justify-between rounded-3xl border border-border bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-tint">
              <MaterialCommunityIcons
                name="credit-card-clock-outline"
                size={21}
                color={colors.primary}
              />
            </View>
            <View>
              <Text className="text-sm font-bold text-ink">Parcelas do mês</Text>
              <Text className="text-xs text-muted">Compromisso fixo — não entra no saldo acima</Text>
            </View>
          </View>
          <Text className="text-base font-bold text-ink">
            {formatCents(monthlyInstallmentCents)}
          </Text>
        </View>
      ) : null}

      <View className="mx-4 mt-4 flex-row gap-2">
        <QuickAction
          icon="file-upload-outline"
          label="Extrato"
          hint="PDF, foto ou texto"
          onPress={() => router.push('/transactions/import')}
        />
        <QuickAction
          icon="chart-donut"
          label="Orçamento"
          hint="Defina limites"
          onPress={() => router.push('/orcamento/manage')}
        />
        <QuickAction
          icon="calendar-sync-outline"
          label="Assinaturas"
          hint="Recorrências"
          onPress={() => router.push('/assinaturas')}
        />
      </View>

      {budgets.length > 0 ? (
        <View className="mx-5 mt-5 rounded-3xl border border-border bg-surface p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-ink">Orçamento do mês</Text>
            <Text className="text-xs font-semibold text-primary">{budgets.length} categorias</Text>
          </View>
          {budgets.map((budget) => {
            const progress = Math.min(budget.spentCents / budget.limit_cents, 1);
            const progressColor =
              progress >= 0.9 ? colors.negative : budget.tagColor || colors.accent;
            return (
              <View key={budget.id} className="mb-3 last:mb-0">
                <View className="mb-1.5 flex-row justify-between">
                  <Text className="text-sm font-semibold text-ink">{budget.tagName}</Text>
                  <Text className="text-xs text-muted">
                    {formatCents(budget.spentCents)} de {formatCents(budget.limit_cents)}
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${progress * 100}%`, backgroundColor: progressColor }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View className="mb-2 mt-6 flex-row items-end justify-between px-5">
        <View>
          <Text className="text-lg font-bold text-ink">Movimentações</Text>
          <Text className="text-xs text-muted">Deslize uma linha para editar ou excluir</Text>
        </View>
        <Text className="text-xs font-bold text-primary">{transactions.length} itens</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 104 }}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <View className="mx-5 mb-2 overflow-hidden rounded-2xl border border-border">
              <SwipeableRow
                onEdit={() => setEditingTransaction(item)}
                onDelete={() => confirmDelete(item.id)}
              >
                <TransactionListItem
                  transaction={item}
                  tagName={item.tag_id ? (tagNameById.get(item.tag_id) ?? null) : null}
                />
              </SwipeableRow>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal"
              title="Seu histórico começa aqui"
              description="Registre uma entrada ou saída para acompanhar seu fluxo financeiro."
              actionLabel="Adicionar movimentação"
              onAction={() => setShowForm(true)}
            />
          }
        />

        <FAB
          icon="plus"
          label="Movimentação"
          onPress={() => setShowForm(true)}
          style={{ position: 'absolute', right: 20, bottom: 18 }}
          accessibilityLabel="Adicionar movimentação"
        />

        <Portal>
          <Modal
            visible={showForm || editingTransaction !== null}
            onDismiss={closeForm}
            contentContainerStyle={{
              margin: 20,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: colors.surface,
            }}
          >
            <View className="px-4 pt-4">
              <Text className="text-xl font-bold text-ink">
                {editingTransaction ? 'Editar movimentação' : 'Nova movimentação'}
              </Text>
              <Text className="mt-1 text-sm text-muted">Informe o valor e organize com uma tag.</Text>
            </View>
            {editingTransaction ? (
              <TransactionForm
                key={editingTransaction.id}
                mode="edit"
                initialTransaction={editingTransaction}
                initialTagName={
                  editingTransaction.tag_id
                    ? (tagNameById.get(editingTransaction.tag_id) ?? null)
                    : null
                }
                onSubmit={async (input) => {
                  await editTransaction(editingTransaction, input);
                  closeForm();
                }}
                onCancel={closeForm}
              />
            ) : (
              <TransactionForm
                mode="create"
                onSubmit={async (input) => {
                  await addTransaction(input);
                  closeForm();
                }}
                onCancel={closeForm}
              />
            )}
          </Modal>
        </Portal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
