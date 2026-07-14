import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { ActivityIndicator, Button, TextInput } from 'react-native-paper';
import { useChat } from '../../../src/hooks/useChat';
import type { ChatMessage } from '../../../src/types';

export default function ChatSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { messages, loading, loadMessages, sendMessage } = useChat(id);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        className={`px-4 py-2 my-1 rounded-xl max-w-[80%] ${
          isUser ? 'self-end bg-primary/20' : 'self-start bg-surface'
        }`}
      >
        <Text className="text-base text-neutral-900">{item.content}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Chat' }} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerClassName="p-4"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View className="p-4 bg-surface border-t border-border flex-row items-center gap-2">
        <TextInput
          mode="outlined"
          label="Sua mensagem"
          value={inputText}
          onChangeText={setInputText}
          style={{ flex: 1 }}
          onSubmitEditing={handleSend}
        />
        {loading ? (
          <ActivityIndicator className="mx-4" />
        ) : (
          <Button mode="contained" onPress={handleSend}>
            Enviar
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
