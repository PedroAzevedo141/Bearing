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
import { Button, PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { paperTheme } from '../src/theme/paperTheme';

type LockState = 'checking' | 'locked' | 'unlocked';

export default function RootLayout() {
  const [lockState, setLockState] = useState<LockState>('checking');

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
          <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
            <Text className="text-3xl font-bold text-neutral-900">Bearing</Text>
            <Text className="text-center text-base text-muted">
              Seus dados financeiros estão protegidos.
            </Text>
            {lockState === 'locked' ? (
              <Button mode="contained" onPress={authenticate}>
                Tentar de novo
              </Button>
            ) : null}
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
