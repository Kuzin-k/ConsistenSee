/**
 * Пример модульного теста
 * Демонстрирует базовую структуру тестов для плагина
 */

// import { mockFn } from '../setup';

describe('Пример тестов', () => {
  test('должен корректно работать базовый тест', () => {
    expect(1 + 1).toBe(2);
  });

  test('должен работать с моками Figma API', () => {
    // Проверяем, что figma объект доступен
    expect((globalThis as Record<string, unknown>).figma).toBeDefined();
    expect(((globalThis as Record<string, unknown>).figma as Record<string, unknown>).notify).toBeDefined();
    
    // Вызываем мок функцию
    const mockNotify = ((globalThis as Record<string, unknown>).figma as Record<string, unknown>).notify as (message: string) => void;
    mockNotify('Тестовое сообщение');
    
    // В реальных тестах здесь можно проверить, что функция была вызвана
    expect(mockNotify).toBeDefined();
  });

  test('должен работать с Promise', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});