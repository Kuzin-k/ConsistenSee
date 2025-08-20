/**
 * Утилита для повторных попыток выполнения асинхронных операций с экспоненциальной задержкой
 * Специально разработана для обработки ошибок соединения с Figma API
 */

export interface RetryOptions {
  maxRetries?: number; // Максимальное количество попыток (по умолчанию 3)
  initialDelay?: number; // Начальная задержка в миллисекундах (по умолчанию 1000)
  maxDelay?: number; // Максимальная задержка в миллисекундах (по умолчанию 10000)
  backoffMultiplier?: number; // Множитель для экспоненциального увеличения задержки (по умолчанию 2)
  onRetry?: (attempt: number, error: Error) => void; // Колбэк, вызываемый при каждой попытке
}

/**
 * Проверяет, является ли ошибка ошибкой соединения с Figma
 */
const isConnectionError = (error: Error): boolean => {
  // Безопасно получаем сообщение ошибки
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('unable to establish connection') ||
    message.includes('connection timeout') ||
    message.includes('network error') ||
    message.includes('connection failed') ||
    message.includes('timeout')
  );
};

/**
 * Выполняет асинхронную операцию с повторными попытками и экспоненциальной задержкой
 * @param operation - Асинхронная функция для выполнения
 * @param options - Опции для повторных попыток
 * @returns Promise с результатом операции
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry
  } = options;

  let lastError: Error;
  let connectionIssueReported = false;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Безопасно приводим к типу Error
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Если это не ошибка соединения, не повторяем попытку
      if (!isConnectionError(lastError)) {
        throw lastError;
      }
      
      // Отправляем сообщение о проблемах с соединением только один раз
      if (!connectionIssueReported) {
        figma.ui.postMessage({
          type: 'connection-waiting' as const,
          message: 'Проблемы с соединением. Ожидание восстановления...'
        });
        connectionIssueReported = true;
      }
      
      // Если это последняя попытка, выбрасываем ошибку
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Вызываем колбэк, если он предоставлен
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }
      
      // Вычисляем задержку с экспоненциальным увеличением
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      
      console.log(`[retryWithBackoff] Попытка ${attempt + 1}/${maxRetries + 1} неудачна. Повтор через ${delay}мс. Ошибка:`, lastError.message);
      
      // Ждем перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Этот код никогда не должен выполниться, но TypeScript требует return
  throw lastError!;
};

/**
 * Специализированная функция для повторных попыток getMainComponentAsync
 * @param node - Узел инстанса для получения главного компонента
 * @param nodeName - Имя узла для логирования
 * @returns Promise с главным компонентом
 */
export const retryGetMainComponent = async (
  node: InstanceNode,
  nodeName: string
): Promise<ComponentNode | null> => {
  return retryWithBackoff(
    () => node.getMainComponentAsync(),
    {
      maxRetries: 3,
      initialDelay: 2000, // Увеличиваем начальную задержку для Figma API
      maxDelay: 15000,
      onRetry: (attempt, error) => {
        console.log(`[retryGetMainComponent] Повторная попытка ${attempt} для компонента "${nodeName}": ${error.message}`);
        
        // Отправляем уведомление в UI о повторной попытке
        figma.ui.postMessage({
          type: 'retry-notification' as const,
          message: `Повторная попытка ${attempt}/3 для компонента "${nodeName}"`
        });
      }
    }
  );
};

/**
 * Проверяет статус соединения с Figma, пытаясь выполнить простую операцию
 * @returns Promise<boolean> - true, если соединение работает
 */
export const checkFigmaConnection = async (): Promise<boolean> => {
  try {
    // Пытаемся получить информацию о текущей странице - это простая операция
    const currentPage = figma.currentPage;
    if (currentPage && currentPage.name) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('[checkFigmaConnection] Ошибка проверки соединения:', error);
    return false;
  }
};

/**
 * Ждет восстановления соединения с Figma
 * @param maxWaitTime - Максимальное время ожидания в миллисекундах (по умолчанию 30 секунд)
 * @returns Promise<boolean> - true, если соединение восстановлено
 */
export const waitForConnection = async (maxWaitTime: number = 30000): Promise<boolean> => {
  const startTime = Date.now();
  const checkInterval = 2000; // Проверяем каждые 2 секунды
  
  while (Date.now() - startTime < maxWaitTime) {
    if (await checkFigmaConnection()) {
      return true;
    }
    
    console.log('[waitForConnection] Ожидание восстановления соединения...');
    figma.ui.postMessage({
      type: 'connection-waiting' as const,
      message: 'Ожидание восстановления соединения с Figma...'
    });
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  return false;
};