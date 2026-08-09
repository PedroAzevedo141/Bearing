/**
 * Captura de extrato e Confirmação 1.
 * Foto usa OCR local; PDF é enviado somente após consentimento explícito.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, TextInput } from 'react-native-paper';

import { fetchExtractStatementPdf } from '../../src/services/aiService';
import { useThemeColors } from '../../src/theme/colors';

const ocrAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const TextRecognition: typeof import('@react-native-ml-kit/text-recognition').default | null =
  ocrAvailable ? require('@react-native-ml-kit/text-recognition').default : null;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * Development builds antigos podem não conter estes módulos nativos. O
 * carregamento protegido evita que uma dependência ausente derrube toda a rota
 * e permite orientar o usuário a reconstruir o app.
 */
let DocumentPicker: typeof import('expo-document-picker') | null = null;
let ExpoFileSystem: typeof import('expo-file-system') | null = null;
try {
  DocumentPicker = require('expo-document-picker');
  ExpoFileSystem = require('expo-file-system');
} catch {
  // O botão de PDF mostra a orientação de rebuild; texto e OCR seguem disponíveis.
}

type LoadingSource = 'pdf' | 'image' | null;

export default function ImportOCRScreen() {
  const themeColors = useThemeColors();
  const [ocrText, setOcrText] = useState('');
  const [loadingSource, setLoadingSource] = useState<LoadingSource>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);

  async function runOcr(uri: string) {
    if (!TextRecognition) return;
    setLoadingSource('image');
    try {
      const result = await TextRecognition.recognize(uri);
      setOcrText((previous) => (previous ? `${previous}\n${result.text}` : result.text));
    } catch {
      Alert.alert('Não consegui ler a imagem', 'Tente uma foto com mais luz e o texto mais nítido.');
    } finally {
      setLoadingSource(null);
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await runOcr(result.assets[0].uri);
    }
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para fotografar o extrato.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      await runOcr(result.assets[0].uri);
    }
  }

  async function extractPdf(asset: DocumentPickerAsset) {
    setLoadingSource('pdf');
    setPdfName(asset.name);
    try {
      if (!ExpoFileSystem) {
        throw new Error('Módulo de arquivos indisponível');
      }
      const file = new ExpoFileSystem.File(asset.uri);
      const pdfBase64 = await file.base64();
      const response = await fetchExtractStatementPdf(pdfBase64);
      if (!response.extracted_text.trim()) {
        throw new Error('PDF sem texto');
      }
      setOcrText(response.extracted_text);
    } catch (e) {
      setPdfName(null);
      // Mensagem por tipo de falha — não culpar o PDF do usuário por um erro
      // de servidor (foi o que confundiu o diagnóstico deste fluxo).
      const status = (e as { status?: number })?.status;
      const message =
        e instanceof Error && e.message === 'PDF sem texto'
          ? 'Não encontrei texto neste PDF. Use um extrato com texto selecionável (não escaneado).'
          : typeof status === 'number' && status >= 500
            ? 'O serviço de IA está indisponível no momento. Tente de novo mais tarde.'
            : 'Não consegui extrair o PDF. Verifique a conexão e use um PDF sem senha.';
      Alert.alert('Não consegui extrair o PDF', message);
    } finally {
      setLoadingSource(null);
    }
  }

  async function handlePickPdf() {
    if (!DocumentPicker || !ExpoFileSystem) {
      Alert.alert(
        'Recompile o aplicativo',
        'Este aplicativo foi instalado antes do suporte a PDF. Use o Expo Go atualizado ou execute npx expo run:android para gerar um novo development build.'
      );
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const file = new ExpoFileSystem.File(asset.uri);
    const fileSize = asset.size ?? file.size;
    if (fileSize > MAX_PDF_BYTES) {
      Alert.alert('PDF muito grande', 'Escolha um arquivo de até 20 MB.');
      return;
    }

    Alert.alert(
      'Enviar PDF para extração?',
      'O documento será enviado temporariamente ao serviço de IA. Ele não é salvo pelo Bearing. Você revisará o texto antes de importar qualquer item.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => void extractPdf(asset) },
      ]
    );
  }

  function handleNext() {
    if (!ocrText.trim()) return;
    router.push({ pathname: '/transactions/import-review', params: { text: ocrText } });
  }

  const loading = loadingSource !== null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Importar extrato',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.ink,
        }}
      />
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-4">
        <View>
          <Text className="text-xs font-bold uppercase tracking-widest text-primary">
            Entrada assistida
          </Text>
          <Text className="mt-1 text-3xl font-bold tracking-tight text-ink">Traga seu extrato</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            Escolha o formato mais fácil. Nada é gravado sem sua revisão final.
          </Text>
        </View>

        <View className="rounded-3xl bg-spotlight p-5">
          <View className="flex-row items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <MaterialCommunityIcons name="file-pdf-box" size={25} color={themeColors.onSpotlight} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">Selecionar PDF</Text>
              <Text className="mt-1 text-sm leading-5 text-white/60">
                Melhor para faturas e extratos digitais. Limite de 20 MB, sem senha.
              </Text>
            </View>
          </View>
          <Button
            mode="contained"
            icon="upload"
            onPress={handlePickPdf}
            disabled={loading}
            buttonColor="#FFFFFF"
            textColor={themeColors.ink}
            style={{ marginTop: 16 }}
          >
            Escolher arquivo
          </Button>
          {loadingSource === 'pdf' ? (
            <View className="mt-4 flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text className="text-sm text-white/70">Extraindo lançamentos de {pdfName}…</Text>
            </View>
          ) : null}
        </View>

        {ocrAvailable ? (
          <View className="rounded-3xl border border-border bg-surface p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-tint">
                <MaterialCommunityIcons name="camera-outline" size={22} color={themeColors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-ink">Foto ou captura de tela</Text>
                <Text className="text-xs text-muted">O texto é lido localmente no aparelho.</Text>
              </View>
            </View>
            <View className="mt-4 flex-row gap-2">
              <Button
                mode="contained-tonal"
                icon="image-outline"
                onPress={handlePickImage}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Galeria
              </Button>
              <Button
                mode="outlined"
                icon="camera-outline"
                onPress={handleTakePhoto}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Câmera
              </Button>
            </View>
          </View>
        ) : (
          <View className="flex-row gap-3 rounded-2xl border border-border bg-surface p-4">
            <MaterialCommunityIcons name="shield-lock-outline" size={21} color={themeColors.accent} />
            <Text className="flex-1 text-sm leading-5 text-muted">
              No Expo Go, use PDF ou cole o texto. A leitura local de fotos fica disponível no app
              instalado.
            </Text>
          </View>
        )}

        <View className="rounded-3xl border border-border bg-surface p-4">
          <Text className="text-base font-bold text-ink">Revise o texto</Text>
          <Text className="mb-3 mt-1 text-sm leading-5 text-muted">
            Esta é a primeira confirmação. Apague saldos, dados da conta e linhas indesejadas.
          </Text>
          <TextInput
            mode="outlined"
            multiline
            value={ocrText}
            onChangeText={setOcrText}
            placeholder="Cole o texto do banco ou selecione um arquivo acima…"
            style={{ minHeight: 220, backgroundColor: themeColors.surface }}
            disabled={loading}
          />
          <View className="mt-3 flex-row items-center gap-2">
            <MaterialCommunityIcons name="shield-check-outline" size={18} color={themeColors.accent} />
            <Text className="flex-1 text-xs leading-4 text-muted">
              Só o texto revisado segue para classificação na próxima etapa.
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          icon="arrow-right"
          contentStyle={{ flexDirection: 'row-reverse', height: 50 }}
          onPress={handleNext}
          disabled={!ocrText.trim() || loading}
        >
          Analisar texto revisado
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
