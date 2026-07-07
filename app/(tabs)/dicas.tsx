/**
 * Aba 3 — Dicas de IA: mostra a dica gerada a partir do resumo agregado dos
 * últimos 30 dias. Cache local de 24h; "Gerar nova dica" força a rechamada.
 */
import React from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGeneralTip } from '../../src/hooks/useAiInsight';

export default function DicasScreen() {
  const { data, loading, error, regenerate } = useGeneralTip();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>💡 Dica do momento</Text>
        {loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : data ? (
          <>
            <Text style={styles.insight}>{data.insight}</Text>
            <Text style={styles.meta}>
              Gerada em {new Date(data.generated_at * 1000).toLocaleString('pt-BR')}
            </Text>
          </>
        ) : (
          <Text style={styles.insight}>Sem dica ainda — registre algumas transações.</Text>
        )}
      </View>

      <Button title="Gerar nova dica" onPress={regenerate} disabled={loading} />

      <Text style={styles.privacyNote}>
        Só o resumo agregado por categoria sai do aparelho — nunca suas transações. O resumo não é
        armazenado em nenhum servidor.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F2' },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: { fontSize: 17, fontWeight: '700', color: '#222222', marginBottom: 12 },
  spinner: { marginVertical: 16 },
  insight: { fontSize: 16, lineHeight: 24, color: '#333333' },
  error: { fontSize: 15, color: '#C0392B' },
  meta: { fontSize: 12, color: '#999999', marginTop: 12 },
  privacyNote: { fontSize: 12, color: '#888888', textAlign: 'center', paddingHorizontal: 16 },
});
