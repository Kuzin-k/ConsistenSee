/**
 * Модуль управления всплывающими подсказками (поповерами)
 * @module showPopover
 */

import { ComponentData } from '../shared/types';

/**
 * Создает и отображает всплывающее окно с детальной информацией о компоненте
 * 
 * @function showPopover
 * @description 
 * Функция создает интерактивный popover, который:
 * - Отображается при наведении на иконку компонента
 * - Содержит полную информацию о компоненте в структурированном виде
 * - Автоматически позиционируется на экране
 * - Адаптирует размер окна плагина для корректного отображения
 * - Поддерживает форматирование сложных объектов
 * 
 * @param {Element} icon - DOM элемент иконки-триггера для поповера
 * @param {ComponentInstance} instance - Объект с данными компонента, включающий:
 *    - name: название компонента
 *    - id: уникальный идентификатор
 *    - версию
 *    - связи с другими компонентами
 *    - и другие метаданные
 * 
 * @throws {Error} Если невозможно создать или отобразить popover
 */
export const showPopover = (icon: Element, instance: ComponentData): void => {
  const popover = document.createElement('div');
  popover.classList.add('popover');
  popover.style.maxWidth = '500px';
  popover.style.position = 'fixed';
  popover.style.zIndex = '10000';
  
  const content = Object.entries(instance).map(([key, value]) => {
    const boldKey = `<strong>${key}:</strong>`;
    if (typeof value === 'object' && value !== null) {
      return `${boldKey} ${JSON.stringify(value)}`;
    }
    return `${boldKey} ${value}`;
  }).join('<br>');
  
  popover.innerHTML = content;
  document.body.appendChild(popover);

  const rect = icon.getBoundingClientRect();
  // Temporarily display popover to get its dimensions
  popover.style.visibility = 'hidden';
  popover.style.display = 'block';
  const popoverRect = popover.getBoundingClientRect();
  popover.style.display = 'none';
  popover.style.visibility = 'visible';

  let top = rect.bottom + 5;
  let left = rect.left;

  // Adjust popover position to stay within the iframe boundaries
  // This is a preliminary adjustment within the iframe, the main adjustment will be done by resizing the plugin window
  if (left + popoverRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popoverRect.width - 10;
  }
  if (left < 10) {
    left = 10;
  }

  if (top + popoverRect.height > window.innerHeight - 10) {
    top = rect.top - popoverRect.height - 5;
  }
  if (top < 10) {
    top = 10;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.display = 'block';

  // Send message to code.js to resize the plugin window
  parent.postMessage({
    pluginMessage: {
      type: 'resize-plugin-window',
      width: Math.max(document.body.scrollWidth, popoverRect.width + left + 20), // Ensure enough width for popover + padding
      height: Math.max(document.body.scrollHeight, popoverRect.height + top + 20) // Ensure enough height for popover + padding
    }
  }, '*');

  icon.addEventListener('mouseleave', () => {
    popover.remove();
    // Send message to code.js to reset plugin window size (optional, but good practice)
    parent.postMessage({
      pluginMessage: {
        type: 'reset-plugin-window-size'
      }
    }, '*');
  });
};