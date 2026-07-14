import React, { useState } from 'react';
import { FlatList, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button, TextInput } from 'react-native-paper';
import { useRecurring } from '../../src/hooks/useRecurring';
import { getOrCreateTag } from '../../src/db/queries/tags';
import { parseCents } from '../../src/utils/money';
import { SwipeableRow } from '../../src/components/SwipeableRow';

export default function RecurringManageScreen() {
  const { recurrings, addRecurring, removeRecurring } = useRecurring();
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [tagName, setTagName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    const cents = parseCents(amount);
    const dayNum = parseInt(day, 10);
    
    if (!name.trim() || !cents || cents <= 0 || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      alert('Preencha os campos corretamente. Dia do mês deve ser entre 1 e 31.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let tagId = null;
      if (tagName.trim()) {
        const tag = await getOrCreateTag(tagName.trim());
        tagId = tag.id;
      }
      
      await addRecurring(name.trim(), cents, dayNum, tagId);
      
      setName('');
      setAmount('');
      setDay('');
      setTagName('');
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar assinatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Gerenciar Assinaturas' }} />
      
      <View className="p-4 bg-surface border-b border-border gap-2">
        <Text className="text-sm text-neutral-600 mb-2">
          Cadastre despesas recorrentes (ex: Netflix, Academia). O app avisará você todo mês no dia estipulado para confirmar o pagamento.
        </Text>
        
        <TextInput
          mode="outlined"
          label="Nome (ex: Netflix)"
          value={name}
          onChangeText={setName}
        />
        <View className="flex-row gap-2">
          <TextInput
            mode="outlined"
            label="Valor"
            left={<TextInput.Affix text="R$" />}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
          />
          <TextInput
            mode="outlined"
            label="Dia do Mês"
            value={day}
            onChangeText={setDay}
            keyboardType="number-pad"
            style={{ width: 100 }}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Tag (opcional)"
          value={tagName}
          onChangeText={setTagName}
          autoCapitalize="none"
        />
        
        <Button mode="contained" onPress={handleSave} loading={isSubmitting} disabled={isSubmitting}>
          Salvar Assinatura
        </Button>
      </View>

      <FlatList
        data={recurrings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => removeRecurring(item.id)}>
            <View className="px-6 py-4 bg-surface flex-row justify-between items-center">
              <View>
                <Text className="text-base font-bold text-neutral-900">{item.name}</Text>
                <Text className="text-sm text-neutral-600">
                  Todo dia {item.day_of_month} {item.tagName ? `• ${item.tagName}` : ''}
                </Text>
              </View>
              <Text className="text-base font-bold text-negative">
                R$ {(item.amount_cents / 100).toFixed(2).replace('.', ',')}
              </Text>
            </View>
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text className="mt-8 px-6 text-center text-muted">
            Nenhuma assinatura cadastrada.
          </Text>
        }
      />
    </KeyboardAvoidingView>
  );
}
