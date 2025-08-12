
// Объявляем глобальный тип для UIModules
declare global {
  interface Window {
    UIModules: {
      displayResult: (message: string, isError?: boolean) => void;
      displayComponentData: (data: any) => void;
    };
  }
}

/**
 * Отображает данные компонентов в UI
 * @param data - Данные компонентов для отображения
 */
export function displayComponentData(data: any): void {
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

  for (const nodeId in data) {
    const nodeData = data[nodeId];

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
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.displayComponentData = displayComponentData;
  // Также добавляем к window для обратной совместимости
  (window as any).displayComponentData = displayComponentData;
}