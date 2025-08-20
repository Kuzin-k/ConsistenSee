# Тестирование ConsistenSee

Этот документ описывает структуру тестирования плагина ConsistenSee.

## Структура директорий

```
test/
├── README.md              # Этот файл
├── plan-test.md           # Подробный план тестирования
├── setup.ts               # Настройка тестовой среды
├── jest.config.ts         # Конфигурация Jest
├── playwright.config.ts   # Конфигурация Playwright
├── mocks/                 # Моки для тестов
│   ├── figma.ts          # Мок Figma API
│   └── dom.ts            # Хелперы для DOM
├── unit/                  # Модульные тесты
├── integration/           # Интеграционные тесты
├── ui/                    # UI тесты (jsdom)
└── e2e/                   # End-to-end тесты (Playwright)
```

## Типы тестов

### Unit тесты
- Тестируют отдельные функции и модули
- Используют Jest + ts-jest
- Находятся в `test/unit/`

### Integration тесты
- Тестируют взаимодействие между UI и code частями плагина
- Проверяют обмен сообщениями через `figma.ui.postMessage`
- Находятся в `test/integration/`

### UI тесты
- Тестируют DOM-логику интерфейса
- Используют Jest + jsdom + Testing Library
- Находятся в `test/ui/`

### E2E тесты
- Smoke-тесты против собранного UI
- Используют Playwright
- Находятся в `test/e2e/`
- Ограничены проверкой UI без реального Figma API

## Команды для запуска

```bash
# Все тесты
npm test

# Только unit тесты
npm run test:unit

# Только integration тесты
npm run test:int

# Только UI тесты
npm run test:ui

# Только E2E тесты
npm run test:e2e

# Тесты с покрытием
npm run coverage

# Тесты в watch режиме
npm run test:watch
```

## Установка зависимостей

Для запуска тестов необходимо установить dev-зависимости:

```bash
npm install --save-dev jest ts-jest @types/jest
npm install --save-dev jest-environment-jsdom @testing-library/dom @testing-library/jest-dom @testing-library/user-event
npm install --save-dev @playwright/test
```

## Принципы написания тестов

1. **Изоляция**: Каждый тест должен быть независимым
2. **Читаемость**: Тесты должны быть понятными и хорошо документированными
3. **Покрытие**: Стремимся к покрытию 70%+ по statements
4. **Моки**: Используем моки для внешних зависимостей (Figma API)
5. **Фабрики**: Создаем фабрики для генерации тестовых данных

## Ограничения

- E2E тесты не могут использовать реальный Figma API
- Тесты выполняются в изолированной среде без доступа к Figma
- Некоторые функции требуют мокирования Figma API