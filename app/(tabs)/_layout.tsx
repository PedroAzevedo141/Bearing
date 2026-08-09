/** Barra de navegação principal do app. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { useThemeColors } from '../../src/theme/colors';

export default function TabsLayout() {
  const themeColors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopColor: themeColors.border,
          backgroundColor: themeColors.surface,
        },
      }}
    >
      <Tabs.Screen
        name="rotacao"
        options={{
          title: 'Resumo',
          tabBarAccessibilityLabel: 'Resumo financeiro',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="parcelas"
        options={{
          title: 'Parcelas',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="credit-card-clock-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Assistente',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="message-processing-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: 'Metas',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="target" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
