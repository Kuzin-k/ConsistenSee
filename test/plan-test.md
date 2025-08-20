Этап 1. Выбор стека и установка зависимостей

Стек:
Unit/Integration: Jest + ts-jest (TypeScript без сборки)
UI-тесты: Jest с jsdom + Testing Library
E2E: Playwright (smoke‑сценарии против собранного UI)
Установить dev-зависимости:
jest, ts-jest, @types/jest
jest-environment-jsdom, @testing-library/dom, @testing-library/jest-dom, @testing-library/user-event
@playwright/test
@figma/plugin-typings (для типов при моках Figma API)
Добавить npm‑скрипты:
test, test:watch, test:unit, test:int, test:ui, test:e2e, coverage
Этап 2. Базовая конфигурация Jest и структура тестов

Создать jest.config.ts:
transform через ts-jest для .ts/.tsx
testMatch на tests/\*_/_.test.ts
setupFilesAfterEnv: tests/setup.ts
moduleNameMapper под алиасы путей (если используются)
projects (опционально): разделить окружения node (бэкенд) и jsdom (UI)
Создать tests/setup.ts:
подключить @testing-library/jest-dom/extend-expect
инициализировать базовый мок глобального figma (минимальные методы: notify, currentPage, root, ui.postMessage/onmessage и т.д.)
Организовать директории:
tests/unit — модульные
tests/integration — интеграционные (сообщения UI↔code с моками)
tests/ui — jsdom‑тесты DOM‑логики UI
tests/e2e — сценарии Playwright
Подготовить моки:
tests/mocks/figma.ts — фабрики узлов и глобальный мок figma
tests/mocks/dom.ts — хелперы для подготовки DOM (если нужно)
Этап 3. Лёгкий рефакторинг для тестируемости

Вынести обработчик сообщений UI из index.ts в экспортируемую функцию (например, handleUiMessage), чтобы её можно было тестировать изолированно (внедрять зависимости figma/ui через параметры).
Убедиться, что ключевые функции из модулей экспортируются (утилиты, обработчики компонентов) — это упростит unit‑тесты.
Сохранить поведение без изменений (только вынос/экспорт).
Этап 4. Первые unit‑тесты (быстрый выигрыш)

Цели:
Модули из src/js/component (например, processNodeComponent.ts): проверка классификации узлов, работы с полями имени/описания/видимости, принадлежности к сетам и т.д.
Утилиты из src/js/utils и вспомогательные функции (если есть).
Подход:
Использовать фабрики мок‑узлов Figma (минимальные поля: id, name, type, parent, hidden и т.д.)
Проверять чистую логику: возвраты, побочные эффекты в кэш‑объектах, формирование результатов.
Этап 5. Интеграционные тесты (UI ↔ code)

Цели:
Сообщения от UI к бэкенду и обратные postMessage
Сценарий “check-all”: очистка кэшей, агрегирование статистик, отправка результатов
Подход:
Мокнуть figma.ui.postMessage как jest.fn()
Прогнать handleUiMessage({ type: 'check-all', ... }) и проверить, какие сообщения были отправлены обратно в UI и какие кэши/состояния изменились.
Этап 6. UI‑тесты (jsdom + Testing Library)

Файлы в ui.html и модули в src/ui/\*.ts (например, displayGroups.ts, displayResult.ts, showPopover.ts)
Подход:
Создавать минимальный DOM (контейнеры) перед импортом модулей
Проверять рендер, сортировку, видимость поповеров, реакции на клики (user-event)
Выделить договорённости по data-testid, если потребуется упростить селекторы
Этап 7. E2E‑тесты (Playwright) против собранного UI

Сборка: npm run build (получаем dist/ui.html)
Настроить playwright.config.ts:
webServer (например, статический сервер на порт, чтобы открыть dist/ui.html в браузере)
тесты: пройти базовые сценарии (открытие, видимость основных блоков, клик по кнопке “New search” и ожидание отображения заглушек/спиннера)
Важно: энд‑ту‑энд в полной среде Figma невозможен вне Фигмы; поэтому E2E ограничены проверкой UI и базовой логики без реального figma.\* API
Этап 8. Покрытие кода и пороги качества

Включить coverage в Jest (istanbul из коробки)
Порог (например): statements/branches/functions/lines — 70% на этапе 1, с ростом до 80%+
Отчёты: text-summary + lcov
Этап 9. Автоматизация в CI (GitHub Actions)

.github/workflows/test.yml:
Node LTS
npm ci
npm run build
npm run test и npm run test:e2e (с установкой браузеров: npx playwright install --with-deps)
артефакты покрытия как upload
Опционально: статус‑чек на PR, пороги покрытия как обязательные
Этап 10. Обновление документации

В readme.md добавить раздел “Тестирование”:
Как установить зависимости
Как запускать unit/int/ui/e2e
Что покрывает каждый слой
Ограничения E2E (без реальной среды Figma)
Принципы написания тестов и структура директорий
Критерии готовности (Definition of Done)

Настроены Jest и Playwright, команды запуска работают локально
Есть минимум 5–8 unit‑тестов для ключевых модулей компонента/утилит
Есть 2–3 интеграционных теста обмена сообщениями
Есть 2–3 UI‑теста на jsdom
Есть 1–2 smoke E2E теста Playwright против dist/ui.html
Покрытие 70%+ по statements
Запуск тестов проходит в GitHub Actions
