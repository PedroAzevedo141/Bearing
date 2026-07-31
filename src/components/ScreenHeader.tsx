import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  trailing?: React.ReactNode;
}

/**
 * Cabeçalho editorial compartilhado pelas áreas principais.
 * Mantém a primeira dobra informativa sem depender do header nativo.
 */
export function ScreenHeader({
  eyebrow,
  title,
  description,
  icon,
  trailing,
}: ScreenHeaderProps) {
  return (
    <View className="px-5 pb-4 pt-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          {eyebrow ? (
            <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
              {eyebrow}
            </Text>
          ) : null}
          <Text className="text-3xl font-bold tracking-tight text-ink">{title}</Text>
          {description ? (
            <Text className="mt-1 text-sm leading-5 text-muted">{description}</Text>
          ) : null}
        </View>
        {trailing ?? (
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-tint">
            <MaterialCommunityIcons name={icon} size={24} color="#315CF5" />
          </View>
        )}
      </View>
    </View>
  );
}
