/**
 * Aba 2 — Compras parceladas: cards com progresso das parcelas e formulário
 * de cadastro/edição. Cadastrar agenda lembretes locais de vencimento;
 * editar/excluir são via swipe em cada card (ver docs/adr/0006).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Button, List } from 'react-native-paper';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import { InstallmentForm } from '../../src/components/forms/InstallmentForm';
import { InstallmentCard } from '../../src/components/InstallmentCard';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { listTags } from '../../src/db/queries/tags';
import { useInstallments } from '../../src/hooks/useInstallments';
import type { InstallmentPurchase, Tag } from '../../src/types';
import { installmentAmountCents, isInstallmentCompleted } from '../../src/utils/money';

export default function ParcelasScreen() {
  const { purchases, addPurchase, editPurchase, removePurchase } = useInstallments();

  const activePurchases = useMemo(
    () => purchases.filter((p) => !isInstallmentCompleted(p)),
    [purchases]
  );
  const completedPurchases = useMemo(
    () => purchases.filter((p) => isInstallmentCompleted(p)),
    [purchases]
  );

  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<InstallmentPurchase | null>(null);

  useEffect(() => {
    listTags().then(setTags);
  }, [purchases]);
  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

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
          currentInstallment={item.current_installment}
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
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={activePurchases}
        keyExtractor={(item) => item.id}
        contentContainerClassName="py-2"
        renderItem={({ item }) => renderCard(item)}
        ListEmptyComponent={
          <Text className="mt-8 px-6 text-center text-muted">
            Nenhuma compra parcelada cadastrada.
          </Text>
        }
        ListFooterComponent={
          completedPurchases.length > 0 ? (
            <List.Accordion
              title={`Concluídas (${completedPurchases.length})`}
              left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
            >
              {completedPurchases.map(renderCard)}
            </List.Accordion>
          ) : null
        }
      />

      {editingPurchase ? (
        <InstallmentForm
          key={editingPurchase.id}
          mode="edit"
          initialPurchase={editingPurchase}
          initialTagName={
            editingPurchase.tag_id ? (tagNameById.get(editingPurchase.tag_id) ?? null) : null
          }
          onSubmit={async (input) => {
            await editPurchase(editingPurchase.id, input);
            setEditingPurchase(null);
          }}
          onCancel={() => setEditingPurchase(null)}
        />
      ) : showForm ? (
        <InstallmentForm mode="create" onSubmit={addPurchase} onCancel={() => setShowForm(false)} />
      ) : (
        <View className="border-t border-border bg-surface p-4">
          <Button mode="contained" onPress={() => setShowForm(true)}>
            Nova compra parcelada
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
