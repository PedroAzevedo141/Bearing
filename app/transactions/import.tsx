import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View, ScrollView } from 'react-native';
import { Button, TextInput, Text } from 'react-native-paper';
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export default function ImportOCRScreen() {
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setLoading(true);
      try {
        const textResult = await TextRecognition.recognize(result.assets[0].uri);
        setOcrText(textResult.text);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar imagem.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      alert('Permissão de câmera necessária!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setLoading(true);
      try {
        const textResult = await TextRecognition.recognize(result.assets[0].uri);
        setOcrText(textResult.text);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar imagem.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNext = () => {
    if (!ocrText.trim()) return;
    router.push({
      pathname: '/transactions/import-review',
      params: { text: ocrText },
    });
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Importar Extrato' }} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <Text className="text-base text-neutral-800 text-center mb-2">
          Tire uma foto ou selecione um extrato. O texto será extraído localmente.
        </Text>

        <View className="flex-row gap-2 justify-center">
          <Button mode="contained" onPress={handlePickImage} loading={loading} disabled={loading}>
            Galeria
          </Button>
          <Button mode="contained-tonal" onPress={handleTakePhoto} loading={loading} disabled={loading}>
            Câmera
          </Button>
        </View>

        {ocrText !== '' && (
          <View className="mt-4 gap-4 flex-1">
            <Text className="font-bold text-neutral-900">Revisão do texto (Confirmação 1)</Text>
            <Text className="text-sm text-neutral-600 mb-2">
              Edite e remova linhas indesejadas antes de enviar para análise da IA.
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={10}
              value={ocrText}
              onChangeText={setOcrText}
              style={{ minHeight: 200 }}
            />
            <Button mode="contained" onPress={handleNext} disabled={!ocrText.trim()}>
              Enviar para análise
            </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
