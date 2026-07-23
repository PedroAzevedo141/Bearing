import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View, Text } from 'react-native';
import { Button, Checkbox, TextInput, ActivityIndicator } from 'react-native-paper';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { parseStatementText, saveParsedItems } from '../../src/services/statementService';
import { getOrCreateDefaultAccount } from '../../src/db/queries/accounts';
import type { ParsedStatementItem } from '../../src/types';
import { centsToAmountInput, parseCents } from '../../src/utils/money';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { colors } from '../../src/theme/colors';

export default function ImportReviewScreen() {
  const { text } = useLocalSearchParams<{ text: string }>();
  const [items, setItems] = useState<ParsedStatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function doParse() {
      if (!text) {
        setError('Nenhum texto recebido.');
        setLoading(false);
        return;
      }
      try {
        const parsed = await parseStatementText(text);
        setItems(parsed);
      } catch (err: any) {
        setError(err.message || 'Falha ao processar extrato na IA');
      } finally {
        setLoading(false);
      }
    }
    doParse();
  }, [text]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const account = await getOrCreateDefaultAccount();
      await saveParsedItems(items, account.id);
      router.replace('/rotacao'); // Volta para a Rotação após importar
    } catch {
      Alert.alert('Não consegui salvar', 'Algo deu errado ao gravar os itens. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index: number, updates: Partial<ParsedStatementItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const renderItem = ({ item, index }: { item: ParsedStatementItem; index: number }) => {
    return (
      <SwipeableRow onDelete={() => removeItem(index)}>
        <View className="mx-5 mb-3 gap-2 rounded-3xl border border-border bg-surface p-4">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-primary">
              Lançamento {index + 1}
            </Text>
            <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color={colors.muted} />
          </View>
          <TextInput
            mode="outlined"
            label="Descrição"
            value={item.description}
            onChangeText={(v) => updateItem(index, { description: v })}
          />
          <View className="flex-row gap-2">
            <TextInput
              mode="outlined"
              label="Valor"
              left={<TextInput.Affix text="R$" />}
              keyboardType="decimal-pad"
              value={centsToAmountInput(item.amount_cents)}
              onChangeText={(v) => {
                const cents = parseCents(v);
                if (cents !== null) updateItem(index, { amount_cents: cents });
              }}
              style={{ flex: 1 }}
            />
            <Button
              mode={item.type === 'expense' ? 'contained' : 'outlined'}
              buttonColor={item.type === 'expense' ? colors.negative : undefined}
              onPress={() => updateItem(index, { type: item.type === 'expense' ? 'income' : 'expense' })}
            >
              {item.type === 'expense' ? 'Saída' : 'Entrada'}
            </Button>
          </View>
          <View className="flex-row items-center gap-2">
            <Checkbox
              status={item.is_installment ? 'checked' : 'unchecked'}
              onPress={() => updateItem(index, { is_installment: !item.is_installment })}
            />
            <Text className="text-neutral-900">É parcela?</Text>
            
            {item.is_installment && (
              <View className="flex-row gap-1 flex-1">
                <TextInput
                  mode="outlined"
                  label="Atual"
                  keyboardType="number-pad"
                  value={String(item.installment_current || '')}
                  onChangeText={(v) => updateItem(index, { installment_current: parseInt(v) || null })}
                  style={{ flex: 1 }}
                />
                <TextInput
                  mode="outlined"
                  label="Total"
                  keyboardType="number-pad"
                  value={String(item.installment_total || '')}
                  onChangeText={(v) => updateItem(index, { installment_total: parseInt(v) || null })}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        </View>
      </SwipeableRow>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4 gap-4">
        <ActivityIndicator size="large" />
        <Text className="text-lg font-bold text-ink">Organizando os lançamentos</Text>
        <Text className="max-w-xs text-center text-sm leading-5 text-muted">
          A IA está separando valores, datas e parcelas. Isso pode levar alguns segundos.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4 gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.negative} />
        </View>
        <Text className="text-center text-lg font-bold text-negative">Não foi possível analisar</Text>
        <Text className="text-center text-muted">{error}</Text>
        <Button mode="contained" onPress={() => router.back()}>Voltar e tentar novamente</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Revisar lançamentos',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="px-5 pb-4 pt-3">
            <Text className="text-xs font-bold uppercase tracking-widest text-primary">
              Confirmação final
            </Text>
            <Text className="mt-1 text-2xl font-bold text-ink">{items.length} lançamentos encontrados</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              Confira valores e parcelas. Deslize um cartão para excluir o que não pertence ao extrato.
            </Text>
          </View>
        }
        ListFooterComponent={
          items.length > 0 ? (
            <View className="mx-5 mb-8 mt-2">
              <Button
                mode="contained"
                icon="check"
                contentStyle={{ height: 50 }}
                onPress={handleSave}
                loading={saving}
                disabled={saving}
              >
                Confirmar e gravar {items.length} itens
              </Button>
            </View>
          ) : (
            <View className="p-4 items-center">
              <Text className="text-neutral-600 mb-4">Nenhum item identificado.</Text>
              <Button mode="outlined" onPress={() => router.back()}>Voltar</Button>
            </View>
          )
        }
      />
    </KeyboardAvoidingView>
  );
}
