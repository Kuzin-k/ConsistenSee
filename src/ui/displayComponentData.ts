
/**
 * Модуль для отображения детальной информации о компонентах в пользовательском интерфейсе.
 * @module displayComponentData
 */

/**
 * Расширяем глобальный объект Window дополнительными методами для работы с UI
 * UIModules содержит набор утилит для манипуляции интерфейсом
 */
declare global {
  interface Window {
    UIModules: {
      /** Функция для отображения результатов операций с возможностью индикации ошибок */
      displayResult: (message: string, isError?: boolean) => void;
      /** Функция для отображения детальной информации о компонентах */
      displayComponentData: (data: unknown) => void;
    };
  }
}

/**
 * Отображает детальную информацию о компонентах в пользовательском интерфейсе
 * @param data - Структурированные данные о компонентах, включающие:
 *              - nodeId: уникальный идентификатор узла
 *              - name: название компонента
 *              - key: ключ компонента
 *              - версию и другие метаданные
 * @throws {Error} Если элемент вывода не найден в DOM
 */
export function displayComponentData(data: unknown): void {
  const outputElement = document.getElementById('componentDataOutput');
  if (!outputElement) {
    console.error('Элемент вывода не найден');
    return;
  }

  outputElement.innerHTML = '';

  if (!data || Object.keys(data).length === 0) {
    window.UIModules.displayResult('Данные компонента не найдены.', true);
    return;
  }

  const container = document.createElement('div');
  container.style.fontFamily = 'monospace';

  for (const nodeId in (data as Record<string, unknown>)) {
    const nodeData = (data as Record<string, unknown>)[nodeId] as Record<string, unknown>;

    const nodeTitle = document.createElement('h4');
    nodeTitle.textContent = `Компонент: ${nodeData.name || 'Без имени'}`;
    nodeTitle.style.marginBottom = '5px';
    container.appendChild(nodeTitle);

    const nodeInfo = document.createElement('div');
    nodeInfo.style.marginLeft = '10px';
    nodeInfo.style.marginBottom = '15px';

    const idLine = document.createElement('div');
    idLine.textContent = `ID: ${nodeId}`;
    nodeInfo.appendChild(idLine);

    const keyLine = document.createElement('div');
    keyLine.textContent = `Ключ: ${nodeData.key || 'Не установлен'}`;
    keyLine.style.color = nodeData.key ? '#2e7d32' : '#d32f2f';
    nodeInfo.appendChild(keyLine);

    const versionLine = document.createElement('div');
    versionLine.textContent = `Версия: ${nodeData.version || 'Не установлена'}`;
    versionLine.style.color = nodeData.version ? '#2e7d32' : '#d32f2f';
    nodeInfo.appendChild(versionLine);

    if (nodeData.pluginDataKey || nodeData.pluginDataVersion) {
      const pluginDataKeyLine = document.createElement('div');
      pluginDataKeyLine.textContent = `Ключ из PluginData: ${nodeData.pluginDataKey || 'Не установлен'}`;
      pluginDataKeyLine.style.color = nodeData.pluginDataKey ? '#2e7d32' : '#d32f2f';
      pluginDataKeyLine.style.marginLeft = '10px';
      nodeInfo.appendChild(pluginDataKeyLine);

      const pluginDataVersionLine = document.createElement('div');
      pluginDataVersionLine.textContent = `Версия из PluginData: ${nodeData.pluginDataVersion || 'Не установлена'}`;
      pluginDataVersionLine.style.color = nodeData.pluginDataVersion ? '#2e7d32' : '#d32f2f';
      pluginDataVersionLine.style.marginLeft = '10px';
      nodeInfo.appendChild(pluginDataVersionLine);
    }

    container.appendChild(nodeInfo);
  }

  outputElement.appendChild(container);
}

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).UIModules = (window as unknown as Record<string, unknown>).UIModules || {};
  ((window as unknown as Record<string, unknown>).UIModules as Record<string, unknown>).displayComponentData = displayComponentData;
  // Также добавляем к window для обратной совместимости
  (window as unknown as Record<string, unknown>).displayComponentData = displayComponentData;
}