/**
 * Barra de abas — as quatro áreas funcionais do app (rotação, parcelas,
 * dicas de IA e metas). Ícones de texto/emoji no MVP para não puxar
 * biblioteca de ícones.
 */
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

/** Ícone de aba baseado em emoji, esmaecido quando inativa. */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#F5F5F2' },
        headerShadowVisible: false,
        tabBarActiveTintColor: '#2E86AB',
      }}
    >
      <Tabs.Screen
        name="rotacao"
        options={{
          title: 'Rotação',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔄" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="parcelas"
        options={{
          title: 'Parcelas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💳" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dicas"
        options={{
          title: 'Dicas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: 'Metas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
