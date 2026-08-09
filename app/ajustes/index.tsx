/**
 * Ajustes do app.
 *
 * Hoje só aparência e o acesso ao backup. Existe como tela própria (e não como
 * mais um atalho na Rotação) porque preferência é assunto separado de dinheiro
 * — e porque é aqui que as próximas opções vão morar sem espremer a aba
 * principal.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { useThemeColors } from '../../src/theme/colors';
import { useThemePreference, type ThemePreference } from '../../src/theme/themePreference';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Escuro', icon: 'weather-night' },
  { value: 'system', label: 'Automático', icon: 'cellphone-cog' },
];

export default function AjustesScreen() {
  const themeColors = useThemeColors();
  const { preference, loading, setPreference } = useThemePreference();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Ajustes',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.ink,
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View className="rounded-3xl border border-border bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-tint">
              <MaterialCommunityIcons
                name="theme-light-dark"
                size={21}
                color={themeColors.primary}
              />
            </View>
            <Text className="flex-1 text-base font-bold text-ink">Aparência</Text>
          </View>
          <Text className="mb-4 mt-3 text-sm text-muted">
            Em “Automático”, o app acompanha o tema do aparelho — inclusive quando ele muda sozinho
            ao anoitecer.
          </Text>
          <SegmentedButtons
            value={preference}
            onValueChange={(value) => setPreference(value as ThemePreference)}
            buttons={THEME_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
              icon: option.icon,
              // Enquanto a preferência gravada não foi lida, trocar sobrescreveria
              // a escolha do usuário por um valor que ainda não é o dele.
              disabled: loading,
            }))}
          />
        </View>

        <TouchableOpacity
          className="flex-row items-center gap-3 rounded-3xl border border-border bg-surface p-4"
          onPress={() => router.push('/backup')}
          accessibilityRole="button"
          accessibilityLabel="Backup: exportar e restaurar dados"
        >
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-tint">
            <MaterialCommunityIcons
              name="database-export-outline"
              size={21}
              color={themeColors.primary}
            />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-ink">Backup</Text>
            <Text className="text-sm text-muted">Exportar, restaurar e gerar planilha</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.muted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
