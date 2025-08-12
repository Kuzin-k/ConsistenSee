// Вспомогательная функция для создания асинхронной задержки
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
