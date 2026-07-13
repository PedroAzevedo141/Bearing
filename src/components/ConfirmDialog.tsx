/**
 * Wrapper reutilizável sobre o `Alert.alert` nativo pra confirmações
 * destrutivas (botão vermelho automático no iOS via `style: 'destructive'`).
 *
 * É uma função, não um componente JSX renderizado — `Alert.alert` é
 * imperativo por natureza (não existe uma árvore React pra montar), então
 * não há proveito em envolvê-lo num componente. Vive em `src/components/`
 * pelo mesmo motivo de descoberta que os componentes de UI: é a peça
 * reutilizável de confirmação de exclusão do app.
 */
import { Alert } from 'react-native';

interface ConfirmDestructiveOptions {
  /** Título do alerta. */
  title: string;
  /** Corpo explicando a consequência da ação. */
  message: string;
  /** Rótulo do botão de confirmação. Default: "Excluir". */
  confirmLabel?: string;
  /** Chamado só se o usuário confirmar. */
  onConfirm: () => void;
}

/**
 * Mostra um `Alert.alert` com "Cancelar" + um botão destrutivo.
 *
 * @param options - Título, mensagem e callback de confirmação.
 *
 * @example
 * confirmDestructive({
 *   title: 'Excluir transação?',
 *   message: 'Essa ação não pode ser desfeita.',
 *   onConfirm: () => removeTransaction(id),
 * });
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel = 'Excluir',
  onConfirm,
}: ConfirmDestructiveOptions): void {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
