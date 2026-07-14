import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View, Text } from 'react-native';
import { Button, Checkbox, TextInput, ActivityIndicator } from 'react-native-paper';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { parseStatementText, saveParsedItems } from '../../src/services/statementService';
import type { ParsedStatementItem } from '../../src/types';
import { getDb } from '../../src/db'; // Para buscar a conta default, se necessário, ou mockaremos
import { formatCents, parseCents } from '../../src/utils/money';
import { SwipeableRow } from '../../src/components/SwipeableRow';

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
      const db = await getDb();
      // Obter primeira account
      const firstAccount = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts LIMIT 1');
      let accountId = firstAccount?.id;
      
      if (!accountId) {
        // Fallback: se não tiver account, não deveria acontecer pois é criado implicitamente,
        // mas só para garantir.
        throw new Error('Nenhuma conta encontrada');
      }

      await saveParsedItems(items, accountId);
      router.replace('/rotacao'); // Volta para a Rotação após importar
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar itens');
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
        <View className="p-4 bg-surface border-b border-border gap-2">
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
              value={(item.amount_cents / 100).toFixed(2).replace('.', ',')}
              onChangeText={(v) => {
                const cents = parseCents(v);
                if (cents !== null) updateItem(index, { amount_cents: cents });
              }}
              style={{ flex: 1 }}
            />
            <Button
              mode={item.type === 'expense' ? 'contained' : 'outlined'}
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
        <Text className="text-center text-neutral-600">A IA está analisando seu extrato (pode levar alguns segundos)...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4 gap-4">
        <Text className="text-negative text-center font-bold text-lg">Erro na IA</Text>
        <Text className="text-neutral-600 text-center">{error}</Text>
        <Button mode="contained" onPress={() => router.back()}>Voltar e tentar novamente</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Revisar (Confirmação 2)' }} />
      <FlatList
        data={items}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderItem}
        ListHeaderComponent={
          <Text className="p-4 text-center text-neutral-600">
            A IA classificou os itens. Verifique e corrija os valores antes de salvar. Deslize para excluir um item falso.
          </Text>
        }
        ListFooterComponent={
          items.length > 0 ? (
            <View className="p-4 mb-8">
              <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
                Confirmar e Gravar ({items.length} itens)
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
