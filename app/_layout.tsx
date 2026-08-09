// Side-effect obrigatório do react-native-gesture-handler — precisa ser o
// primeiro import do arquivo de entrada (ver docs do pacote).
import 'react-native-gesture-handler';
import '../global.css';

/**
 * Layout raiz do app. Trava biométrica na abertura + os providers globais
 * (gesture handler pro swipe-to-delete/editar, tema do Paper).
 *
 * Como não existe servidor guardando os dados, a biometria na abertura é a
 * única camada de proteção possível (docs/adr/0001-local-first-architecture.md).
 * O conteúdo só monta depois de `authenticateAsync` retornar sucesso; se o
 * aparelho não tiver biometria/PIN configurado, o app abre destravado.
 *
 * Relacionado: docs/adr/0005-design-system-nativewind-paper.md,
 * docs/adr/0006-padrao-crud-editar-excluir.md
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Button, PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { useThemeColors } from '../src/theme/colors';
import { usePaperTheme } from '../src/theme/paperTheme';

type LockState = 'checking' | 'locked' | 'unlocked';

export default function RootLayout() {
  const [lockState, setLockState] = useState<LockState>('checking');
  const paperTheme = usePaperTheme();
  const themeColors = useThemeColors();

  const authenticate = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      // Sem biometria/PIN cadastrado não há o que exigir — não punir o usuário.
      setLockState('unlocked');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloqueie o Bearing',
      cancelLabel: 'Cancelar',
    });
    setLockState(result.success ? 'unlocked' : 'locked');
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.action === 'recurring_prompt' && data?.recurring_id) {
        setTimeout(() => {
          router.push(`/assinaturas/confirm/${data.recurring_id}`);
        }, 500); // pequeno delay para garantir que a navegação esteja pronta após desbloqueio
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider
        theme={paperTheme}
        settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
      >
        {lockState !== 'unlocked' ? (
          <View className="flex-1 items-center justify-center bg-spotlight p-8">
            <View className="mb-5 h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
              <MaterialCommunityIcons name="shield-lock-outline" size={38} color={themeColors.onSpotlight} />
            </View>
            <Text className="text-4xl font-bold tracking-tight text-white">Bearing</Text>
            <Text className="mt-2 max-w-xs text-center text-base leading-6 text-white/60">
              Suas finanças protegidas e organizadas no seu aparelho.
            </Text>
            {lockState === 'locked' ? (
              <Button
                mode="contained"
                icon="fingerprint"
                buttonColor="#FFFFFF"
                textColor={themeColors.spotlight}
                onPress={authenticate}
                style={{ marginTop: 24 }}
              >
                Desbloquear
              </Button>
            ) : (
              <ActivityIndicator color="#FFFFFF" style={{ marginTop: 24 }} />
            )}
          </View>
        ) : (
          <>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </>
        )}
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
