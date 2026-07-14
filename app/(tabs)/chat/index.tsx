import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { useChatConversations } from '../../../src/hooks/useChat';
import { SwipeableRow } from '../../../src/components/SwipeableRow';

export default function ChatIndexScreen() {
  const { conversations, load, create, remove } = useChatConversations();
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const conv = await create(newTitle);
    setNewTitle('');
    setIsCreating(false);
    router.push(`/chat/${conv.id}`);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Conversas' }} />
      
      {isCreating ? (
        <View className="p-4 bg-surface border-b border-border flex-row items-center gap-2">
          <TextInput
            mode="outlined"
            label="Título da conversa"
            value={newTitle}
            onChangeText={setNewTitle}
            style={{ flex: 1 }}
            autoFocus
          />
          <Button mode="contained" onPress={handleCreate}>
            Criar
          </Button>
          <Button onPress={() => setIsCreating(false)}>
            Cancelar
          </Button>
        </View>
      ) : (
        <View className="p-4 bg-surface border-b border-border">
          <Button mode="contained" onPress={() => setIsCreating(true)}>
            Nova conversa
          </Button>
        </View>
      )}

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerClassName="py-2"
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => remove(item.id)}>
            <TouchableOpacity
              onPress={() => router.push(`/chat/${item.id}`)}
              className="px-6 py-4 bg-surface"
            >
              <Text className="text-base font-bold text-neutral-900">{item.title}</Text>
              <Text className="text-sm text-neutral-500">
                {new Date(item.updated_at * 1000).toLocaleString()}
              </Text>
            </TouchableOpacity>
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text className="mt-8 px-6 text-center text-muted">
            Nenhuma conversa ainda.
          </Text>
        }
      />
    </View>
  );
}
