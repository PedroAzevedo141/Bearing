/**
 * Aba 3 — Dicas de IA: mostra a dica gerada a partir do resumo agregado dos
 * últimos 30 dias. Cache local de 24h; "Gerar nova dica" força a rechamada.
 */
import React from 'react';
import { ScrollView, Text } from 'react-native';
import { ActivityIndicator, Button, Card } from 'react-native-paper';

import { useGeneralTip } from '../../src/hooks/useAiInsight';
import { colors } from '../../src/theme/colors';

export default function DicasScreen() {
  const { data, loading, error, regenerate } = useGeneralTip();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4">
      <Card>
        <Card.Content>
          <Text className="mb-3 text-[17px] font-bold text-neutral-900">💡 Dica do momento</Text>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 16 }} />
          ) : error ? (
            <Text style={{ color: colors.negative }} className="text-[15px]">
              {error}
            </Text>
          ) : data ? (
            <>
              <Text className="text-base leading-6 text-neutral-800">{data.insight}</Text>
              <Text className="mt-3 text-xs text-neutral-500">
                Gerada em {new Date(data.generated_at * 1000).toLocaleString('pt-BR')}
              </Text>
            </>
          ) : (
            <Text className="text-base leading-6 text-neutral-800">
              Sem dica ainda — registre algumas transações.
            </Text>
          )}
        </Card.Content>
      </Card>

      <Button mode="contained" onPress={regenerate} disabled={loading}>
        Gerar nova dica
      </Button>

      <Text className="px-4 text-center text-xs text-muted">
        Só o resumo agregado por categoria sai do aparelho — nunca suas transações. O resumo não é
        armazenado em nenhum servidor.
      </Text>
    </ScrollView>
  );
}
