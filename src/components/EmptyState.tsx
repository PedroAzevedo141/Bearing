import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="mx-5 my-8 items-center rounded-3xl border border-border bg-surface px-6 py-8">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-tint">
        <MaterialCommunityIcons name={icon} size={28} color="#315CF5" />
      </View>
      <Text className="text-center text-lg font-bold text-ink">{title}</Text>
      <Text className="mt-1 text-center text-sm leading-5 text-muted">{description}</Text>
      {actionLabel && onAction ? (
        <Button mode="contained-tonal" onPress={onAction} style={{ marginTop: 16 }}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
