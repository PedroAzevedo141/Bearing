/**
 * Backup e exportação dos dados locais.
 *
 * Única saída de dados do app: o Bearing guarda tudo no aparelho (ADR-0001),
 * então sem esta tela perder o celular significa perder o histórico inteiro.
 * Nada sai daqui sozinho — o arquivo vai para o share sheet e o destino é
 * escolhido pelo usuário.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar } from 'react-native-paper';

import { confirmDestructive } from '../../src/components/ConfirmDialog';
import {
  BackupError,
  backupAvailable,
  exportBackup,
  exportTransactionsCsv,
  pickBackupToRestore,
} from '../../src/services/backupService';
import { useThemeColors } from '../../src/theme/colors';

type Busy = 'export' | 'csv' | 'restore' | null;

interface ActionCardProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  tone?: 'default' | 'destructive';
}

function ActionCard({
  icon,
  title,
  description,
  actionLabel,
  onPress,
  loading,
  disabled,
  tone = 'default',
}: ActionCardProps) {
  const themeColors = useThemeColors();
  return (
    <View className="rounded-3xl border border-border bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-tint">
          <MaterialCommunityIcons
            name={icon}
            size={21}
            color={tone === 'destructive' ? themeColors.negative : themeColors.primary}
          />
        </View>
        <Text className="flex-1 text-base font-bold text-ink">{title}</Text>
      </View>
      <Text className="mt-3 text-sm text-muted">{description}</Text>
      <Button
        mode={tone === 'destructive' ? 'outlined' : 'contained'}
        onPress={onPress}
        loading={loading}
        disabled={disabled}
        textColor={tone === 'destructive' ? themeColors.negative : undefined}
        style={{ marginTop: 16 }}
      >
        {actionLabel}
      </Button>
    </View>
  );
}

export default function BackupScreen() {
  const themeColors = useThemeColors();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Concentra o tratamento de erro: BackupError já vem com texto para a UI. */
  async function run(kind: Exclude<Busy, null>, action: () => Promise<string | null>) {
    setBusy(kind);
    try {
      const result = await action();
      if (result) {
        setMessage(result);
      }
    } catch (error) {
      setMessage(
        error instanceof BackupError
          ? error.message
          : 'Não consegui concluir. Tente de novo em alguns instantes.'
      );
    } finally {
      setBusy(null);
    }
  }

  function handleExport() {
    return run('export', async () => {
      const fileName = await exportBackup();
      return `Backup gerado: ${fileName}`;
    });
  }

  function handleCsv() {
    return run('csv', async () => {
      const fileName = await exportTransactionsCsv();
      return `Planilha gerada: ${fileName}`;
    });
  }

  function handleRestore() {
    return run('restore', async () => {
      const preview = await pickBackupToRestore();
      if (!preview) {
        return null;
      }
      const exportedAt = new Date(preview.exportedAt * 1000).toLocaleDateString('pt-BR');
      // A confirmação vive aqui, e não dentro do serviço, porque substituir os
      // dados é irreversível: quem decide é o usuário, vendo o que vai entrar.
      confirmDestructive({
        title: 'Substituir todos os dados?',
        message: `O backup de ${exportedAt} tem ${preview.transactionCount} movimentações. Tudo que está no app agora será apagado. Não dá para desfazer.`,
        confirmLabel: 'Restaurar',
        onConfirm: () => {
          preview
            .apply()
            .then(() => setMessage('Backup restaurado. Reabra o app para ver os dados.'))
            .catch(() => setMessage('Falha ao restaurar. Seus dados atuais foram preservados.'));
        },
      });
      return null;
    });
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Backup',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.ink,
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Text className="text-sm text-muted">
          Seus dados ficam só neste aparelho. Se ele for perdido, formatado ou trocado, um backup é
          a única forma de recuperar o histórico.
        </Text>

        {!backupAvailable ? (
          <View className="rounded-2xl border border-border bg-tint p-4">
            <Text className="text-sm text-ink">
              Este app de desenvolvimento é anterior à feature de backup. Rode{' '}
              <Text className="font-bold">npx expo run:android</Text> para reconstruí-lo.
            </Text>
          </View>
        ) : null}

        <ActionCard
          icon="database-export-outline"
          title="Exportar backup"
          description="Gera um arquivo .json com movimentações, parcelas, metas, orçamento, assinaturas e conversas. É este arquivo que restaura tudo depois."
          actionLabel="Exportar e compartilhar"
          onPress={handleExport}
          loading={busy === 'export'}
          disabled={!backupAvailable || busy !== null}
        />

        <ActionCard
          icon="file-delimited-outline"
          title="Exportar movimentações (CSV)"
          description="Planilha só das entradas e saídas, para abrir no Excel ou Google Sheets. Não serve para restaurar — use o backup .json para isso."
          actionLabel="Gerar planilha"
          onPress={handleCsv}
          loading={busy === 'csv'}
          disabled={!backupAvailable || busy !== null}
        />

        <ActionCard
          icon="database-import-outline"
          title="Restaurar backup"
          description="Substitui tudo que está no app pelo conteúdo do arquivo. Use ao trocar de aparelho ou depois de reinstalar."
          actionLabel="Escolher arquivo"
          onPress={handleRestore}
          loading={busy === 'restore'}
          disabled={!backupAvailable || busy !== null}
          tone="destructive"
        />

        {busy !== null ? (
          <View className="flex-row items-center justify-center gap-2 py-2">
            <ActivityIndicator size="small" color={themeColors.primary} />
            <Text className="text-sm text-muted">Processando…</Text>
          </View>
        ) : null}
      </ScrollView>

      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={5000}>
        {message ?? ''}
      </Snackbar>
    </View>
  );
}
