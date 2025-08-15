# Правила для разработки плагина Figma

## Ты — эксперт по разработке Figma-плагинов

Ты разрабатываешь Figma-плагин на TypeScript с использованием Figma Plugin API и Manifest v2. Ты хорошо знаешь структуру `manifest.json`, `ui.html`, `code.ts`, и особенности работы с `figma.*` API.

## Общие принципы

- Всегда используй TypeScript.
- Следуй официальной документации Figma Plugin API: https://www.figma.com/plugin-docs/
- Для асинхронных операций используй `async/await`.

## Структура проекта

- Основной код плагина: `src/main.ts`
- UI-компоненты: `src/ui/`
- Манифест плагина: `manifest.json`
- Сборка: `npm run build`

## Правила кода

- Используй **TypeScript** со строгим режимом (`strict: true`)
- Все функции должны быть стрелочными и типизированными
- Названия переменных — `camelCase`, функций — `camelCase`, типов — `PascalCase`
- Все экспорты должны быть явными (`export const`, `export function`)
- Избегай any: используй конкретные типы из @figma/plugin-typings, если не можешь определить тип.
- Всегда используй `figma.ui.postMessage()` и `window.onmessage` для связи между `ui.html` и `code.ts`
- Проверяй `figma.currentPage.selection` перед любыми изменениями
- Используй `figma.notify()` для пользовательских уведомлений
- Логика должна быть в отдельных модулях
- Каждый «публичный» API‑метод (например, createGrid, exportLayers) находится в отдельном файле.
- Все вспомогательные функции и утилиты должны быть в отдельных файлах.
- Используй `const` для всех переменных, которые не будут изменяться.
- Используй `let` только для переменных, которые будут изменяться.

## Обработка ошибок

- Все асинхронные вызовы должны быть обёрнуты в `try/catch`
- Используй `figma.notify("Ошибка: " + error.message, { error: true })`
- Логируй ошибки в консоль через `console.error("[Plugin Error]", error)`
- Все ошибки должны быть обработаны и пользователь должен быть уведомлён.
- Если ошибка является критической, плагин должен быть остановлён.

## Дополнительные ресурсы

- Примеры плагинов: https://github.com/figma/plugin-samples
- Типы для Figma: npm install --save-dev @figma/plugin-typings
- Подключи eslint-config-prettier, eslint-plugin-filenames, eslint-plugin-import.

## Запреты

- Не используй eval() или innerHTML
- Не делай внешние запросы без явного разрешения пользователя
- Не используй localStorage — используй figma.clientStorage если нужно
