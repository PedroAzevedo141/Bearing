/**
 * Layout raiz do app. Única responsabilidade: a trava biométrica.
 *
 * Como não existe servidor guardando os dados, a biometria na abertura é a
 * única camada de proteção possível (docs/adr/0001-local-first-architecture.md).
 * O conteúdo só monta depois de `authenticateAsync` retornar sucesso; se o
 * aparelho não tiver biometria/PIN configurado, o app abre destravado.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

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

  if (lockState !== 'unlocked') {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockTitle}>Bearing</Text>
        <Text style={styles.lockSubtitle}>Seus dados financeiros estão protegidos.</Text>
        {lockState === 'locked' ? (
          <Button title="Tentar de novo" onPress={authenticate} />
        ) : null}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F2',
    gap: 12,
    padding: 24,
  },
  lockTitle: { fontSize: 28, fontWeight: '700', color: '#222222' },
  lockSubtitle: { fontSize: 15, color: '#666666', textAlign: 'center' },
});
