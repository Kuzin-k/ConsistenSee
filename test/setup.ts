/**
 * Настройка тестовой среды
 * Базовые моки для Figma API без зависимостей от Jest
 */

// Простая функция-мок
const mockFn = () => {
  const fn = (...args: any[]) => undefined;
  fn.mockClear = () => {};
  fn.mockReturnValue = (value: any) => fn;
  return fn;
};

// Базовый мок глобального объекта figma
(globalThis as any).figma = {
  // UI методы
  ui: {
    postMessage: mockFn(),
    onmessage: mockFn(),
    resize: mockFn(),
    close: mockFn()
  },
  
  // Основные методы
  notify: mockFn(),
  closePlugin: mockFn(),
  
  // Страница и узлы
  currentPage: {
    selection: [],
    findAll: mockFn(),
    findOne: mockFn()
  },
  
  // Корневой узел
  root: {
    findAll: mockFn(),
    findOne: mockFn()
  },
  
  // Библиотеки
  teamLibrary: {
    getAvailableLibraryComponentsAsync: () => Promise.resolve([]),
    importComponentByKeyAsync: () => Promise.resolve(null)
  },
  
  // Хранилище
  clientStorage: {
    getAsync: () => Promise.resolve(undefined),
    setAsync: () => Promise.resolve(),
    deleteAsync: () => Promise.resolve()
  }
};

// Мок для console методов в тестах
(globalThis as any).console = {
  ...console,
  // Отключаем логи в тестах, если не нужны
  log: mockFn(),
  warn: mockFn(),
  error: mockFn()
};

export { mockFn };