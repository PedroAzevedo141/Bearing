/** Compras parceladas, projeção mensal e acompanhamento de progresso. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { FAB, List, Modal, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import { EmptyState } from '../../src/components/EmptyState';
import { InstallmentForm } from '../../src/components/forms/InstallmentForm';
import { InstallmentCard } from '../../src/components/InstallmentCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { listTags } from '../../src/db/queries/tags';
import { useInstallments } from '../../src/hooks/useInstallments';
import { useThemeColors } from '../../src/theme/colors';
import type { InstallmentPurchase, Tag } from '../../src/types';
import {
  currentInstallmentFor,
  formatCents,
  installmentAmountCents,
  isInstallmentCompleted,
} from '../../src/utils/money';

export default function ParcelasScreen() {
  const themeColors = useThemeColors();
  const { purchases, addPurchase, editPurchase, removePurchase } = useInstallments();
  const activePurchases = useMemo(
    () => purchases.filter((purchase) => !isInstallmentCompleted(purchase)),
    [purchases]
  );
  const completedPurchases = useMemo(
    () => purchases.filter((purchase) => isInstallmentCompleted(purchase)),
    [purchases]
  );
  const monthlyTotal = useMemo(
    () =>
      activePurchases.reduce(
        (sum, purchase) =>
          sum + installmentAmountCents(purchase.total_amount_cents, purchase.installment_count),
        0
      ),
    [activePurchases]
  );
  const remainingTotal = useMemo(
    () =>
      activePurchases.reduce((sum, purchase) => {
        const paid = Math.min(currentInstallmentFor(purchase) - 1, purchase.installment_count);
        return (
          sum +
          (purchase.installment_count - paid) *
            installmentAmountCents(purchase.total_amount_cents, purchase.installment_count)
        );
      }, 0),
    [activePurchases]
  );

  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<InstallmentPurchase | null>(null);

  useEffect(() => {
    listTags().then(setTags);
  }, [purchases]);

  const tagNameById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

  function closeForm() {
    setShowForm(false);
    setEditingPurchase(null);
  }

  function confirmDelete(id: string) {
    confirmDestructive({
      title: 'Excluir compra?',
      message: 'Os lembretes de parcela serão reagendados.',
      onConfirm: () => removePurchase(id),
    });
  }

  function renderCard(item: InstallmentPurchase) {
    return (
      <SwipeableRow
        key={item.id}
        onEdit={() => setEditingPurchase(item)}
        onDelete={() => confirmDelete(item.id)}
      >
        <InstallmentCard
          name={item.name}
          tagName={item.tag_id ? (tagNameById.get(item.tag_id) ?? null) : null}
          currentInstallment={currentInstallmentFor(item)}
          installmentCount={item.installment_count}
          installmentAmountCents={installmentAmountCents(
            item.total_amount_cents,
            item.installment_count
          )}
        />
      </SwipeableRow>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={activePurchases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 104 }}
          renderItem={({ item }) => renderCard(item)}
          ListHeaderComponent={
            <View>
              <ScreenHeader
                eyebrow="Planejamento"
                title="Parcelas"
                description="Veja quanto está comprometido e o que falta quitar."
                icon="credit-card-clock-outline"
              />
              <View className="mx-5 mb-5 flex-row gap-3">
                <View className="flex-1 rounded-3xl bg-spotlight p-4">
                  <MaterialCommunityIcons name="calendar-month-outline" size={21} color={themeColors.onSpotlight} />
                  <Text className="mt-4 text-xs text-white/60">Por mês</Text>
                  <Text className="mt-1 text-lg font-bold text-white">{formatCents(monthlyTotal)}</Text>
                </View>
                <View className="flex-1 rounded-3xl border border-border bg-surface p-4">
                  <MaterialCommunityIcons name="timer-sand" size={21} color={themeColors.accent} />
                  <Text className="mt-4 text-xs text-muted">A quitar</Text>
                  <Text className="mt-1 text-lg font-bold text-ink">{formatCents(remainingTotal)}</Text>
                </View>
              </View>
              <View className="mb-2 flex-row items-end justify-between px-5">
                <View>
                  <Text className="text-lg font-bold text-ink">Compras ativas</Text>
                  <Text className="text-xs text-muted">Acompanhe o avanço de cada compra</Text>
                </View>
                <Text className="text-xs font-bold text-primary">{activePurchases.length} ativas</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="credit-card-plus-outline"
              title="Nenhuma parcela em aberto"
              description="Cadastre uma compra para enxergar o impacto mensal e quanto ainda falta pagar."
              actionLabel="Cadastrar compra"
              onAction={() => setShowForm(true)}
            />
          }
          ListFooterComponent={
            completedPurchases.length > 0 ? (
              <View className="mx-5 mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
                <List.Accordion
                  title={`Concluídas (${completedPurchases.length})`}
                  description="Compras que já chegaram ao fim"
                  left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
                >
                  {completedPurchases.map(renderCard)}
                </List.Accordion>
              </View>
            ) : null
          }
        />

        <FAB
          icon="plus"
          label="Nova compra"
          onPress={() => setShowForm(true)}
          style={{ position: 'absolute', right: 20, bottom: 18 }}
        />

        <Portal>
          <Modal
            visible={showForm || editingPurchase !== null}
            onDismiss={closeForm}
            contentContainerStyle={{
              margin: 20,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: themeColors.surface,
            }}
          >
            <View className="px-4 pt-4">
              <Text className="text-xl font-bold text-ink">
                {editingPurchase ? 'Editar compra' : 'Nova compra parcelada'}
              </Text>
              <Text className="mt-1 text-sm text-muted">
                O Bearing calcula o valor mensal e acompanha o progresso.
              </Text>
            </View>
            {editingPurchase ? (
              <InstallmentForm
                key={editingPurchase.id}
                mode="edit"
                initialPurchase={editingPurchase}
                initialTagName={
                  editingPurchase.tag_id
                    ? (tagNameById.get(editingPurchase.tag_id) ?? null)
                    : null
                }
                onSubmit={async (input) => {
                  await editPurchase(editingPurchase.id, input);
                  closeForm();
                }}
                onCancel={closeForm}
              />
            ) : (
              <InstallmentForm
                mode="create"
                onSubmit={async (input) => {
                  await addPurchase(input);
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
