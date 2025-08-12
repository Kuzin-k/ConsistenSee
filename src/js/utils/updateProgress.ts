import { delay } from './delay';

/**
 * Отправляет информацию о прогрессе выполнения в UI.
 *
 * @param phase - Текущий этап (например, 'processing').
 * @param processed - Количество обработанных элементов.
 * @param total - Общее количество элементов.
 * @param message - Дополнительное сообщение.
 */
export const updateProgress = async (
  phase: string,
  processed: number,
  total: number,
  message: string,
  currentComponentName?: string // Добавляем новый необязательный параметр
): Promise<void> => {
  figma.ui.postMessage({
    type: 'progress-update',
    phase,
    processed,
    total,
    message,
    currentComponentName, // Передаем название компонента в UI
  });
  // Небольшая задержка, чтобы UI успел обработать сообщение и обновить интерфейс
  await delay(1);
};