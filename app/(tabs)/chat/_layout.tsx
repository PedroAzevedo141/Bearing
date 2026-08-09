import { Stack } from 'expo-router';

import { useThemeColors } from '../../../src/theme/colors';

export default function ChatLayout() {
  const themeColors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: themeColors.surface },
        headerShadowVisible: false,
        headerTintColor: themeColors.ink,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Assistente Bearing' }} />
    </Stack>
  );
}
