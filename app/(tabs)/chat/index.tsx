import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { FAB, Modal, Portal, Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../../../src/components/EmptyState';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SwipeableRow } from '../../../src/components/SwipeableRow';
import { useChatConversations } from '../../../src/hooks/useChat';
import { colors } from '../../../src/theme/colors';

export default function ChatIndexScreen() {
  const { conversations, load, create, remove } = useChatConversations();
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const conversation = await create(newTitle.trim());
    setNewTitle('');
    setIsCreating(false);
    router.push(`/chat/${conversation.id}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 104 }}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              eyebrow="Análise com contexto"
              title="Assistente"
              description="Converse sobre seus gastos, parcelas e metas sem expor seu histórico bruto."
              icon="message-processing-outline"
            />
            <View className="mx-5 mb-5 rounded-3xl bg-ink p-5">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <MaterialCommunityIcons name="creation-outline" size={23} color="#9EB4FF" />
              </View>
              <Text className="mt-4 text-xl font-bold text-white">
                Pergunte com seus números em mente
              </Text>
              <Text className="mt-1 text-sm leading-5 text-white/60">
                “Quanto gastei com mercado?” ou “Como estão minhas metas?” são bons começos.
              </Text>
              <Button
                mode="contained"
                icon="plus"
                onPress={() => setIsCreating(true)}
                style={{ marginTop: 16, alignSelf: 'flex-start' }}
                buttonColor="#FFFFFF"
                textColor={colors.ink}
              >
                Nova conversa
              </Button>
            </View>
            <View className="mb-2 flex-row items-end justify-between px-5">
              <View>
                <Text className="text-lg font-bold text-ink">Conversas</Text>
                <Text className="text-xs text-muted">Seu histórico fica somente neste aparelho</Text>
              </View>
              <Text className="text-xs font-bold text-primary">{conversations.length} salvas</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-5 mb-2 overflow-hidden rounded-2xl border border-border">
            <SwipeableRow onDelete={() => remove(item.id)}>
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item.id}`)}
                className="flex-row items-center bg-surface p-4"
                activeOpacity={0.75}
              >
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-tint">
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={21}
                    color={colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink">{item.title}</Text>
                  <Text className="mt-0.5 text-xs text-muted">
                    {new Date(item.updated_at * 1000).toLocaleString('pt-BR')}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
              </TouchableOpacity>
            </SwipeableRow>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="message-plus-outline"
            title="Ainda não há conversas"
            description="Abra uma conversa para explorar seus dados financeiros com ajuda do assistente."
            actionLabel="Começar agora"
            onAction={() => setIsCreating(true)}
          />
        }
      />

      <FAB
        icon="plus"
        onPress={() => setIsCreating(true)}
        style={{ position: 'absolute', right: 20, bottom: 18 }}
        accessibilityLabel="Nova conversa"
      />

      <Portal>
        <Modal
          visible={isCreating}
          onDismiss={() => setIsCreating(false)}
          contentContainerStyle={{
            margin: 20,
            borderRadius: 24,
            backgroundColor: colors.surface,
            padding: 20,
          }}
        >
          <Text className="text-xl font-bold text-ink">Nova conversa</Text>
          <Text className="mb-4 mt-1 text-sm text-muted">
            Use um título que ajude a reencontrar este assunto.
          </Text>
          <TextInput
            mode="outlined"
            label="Título da conversa"
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <View className="mt-4 flex-row justify-end gap-2">
            <Button onPress={() => setIsCreating(false)}>Cancelar</Button>
            <Button mode="contained" onPress={handleCreate} disabled={!newTitle.trim()}>
              Criar conversa
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}
