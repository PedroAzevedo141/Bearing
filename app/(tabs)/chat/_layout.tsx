import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5F5F2' },
        headerShadowVisible: false,
      }}
    />
  );
}
