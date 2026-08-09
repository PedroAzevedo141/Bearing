import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { ActivityIndicator, IconButton, Snackbar, TextInput } from 'react-native-paper';
import { useChat } from '../../../src/hooks/useChat';
import { useThemeColors } from '../../../src/theme/colors';
import type { ChatMessage } from '../../../src/types';

export default function ChatSessionScreen() {
  const themeColors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { messages, loading, error, loadMessages, sendMessage } = useChat(id);
  const [inputText, setInputText] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (error) {
      setErrorVisible(true);
    }
  }, [error]);

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
        className={`my-1 max-w-[84%] rounded-2xl px-4 py-3 ${
          isUser ? 'self-end rounded-br-md bg-primary' : 'self-start rounded-bl-md border border-border bg-surface'
        }`}
      >
        <Text className={`text-base leading-6 ${isUser ? 'text-white' : 'text-ink'}`}>
          {item.content}
        </Text>
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
        contentContainerClassName="p-4 grow"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-16">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-tint">
              <Text className="text-2xl">✦</Text>
            </View>
            <Text className="text-center text-lg font-bold text-ink">O que você quer entender?</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-muted">
              Pergunte sobre gastos, parcelas ou progresso das suas metas.
            </Text>
          </View>
        }
      />

      <View className="flex-row items-center gap-2 border-t border-border bg-surface px-4 py-3">
        <TextInput
          mode="outlined"
          placeholder="Pergunte sobre suas finanças"
          value={inputText}
          onChangeText={setInputText}
          style={{ flex: 1 }}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        {loading ? (
          <ActivityIndicator style={{ marginHorizontal: 16 }} />
        ) : (
          <IconButton
            icon="arrow-up"
            mode="contained"
            containerColor={themeColors.primary}
            iconColor="#FFFFFF"
            size={22}
            onPress={handleSend}
            disabled={!inputText.trim()}
            accessibilityLabel="Enviar mensagem"
          />
        )}
      </View>

      <Snackbar visible={errorVisible} onDismiss={() => setErrorVisible(false)} duration={4000}>
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}
