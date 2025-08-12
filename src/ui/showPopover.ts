import { ComponentInstance } from '../shared/types';

/**
 * @function showPopover
 * @description Отображает всплывающее окно (popover) с подробной информацией об экземпляре.
 * Popover появляется при наведении курсора на иконку элемента в списке.
 * Функция также отправляет сообщение в бэкенд для изменения размера окна плагина,
 * чтобы popover полностью поместился.
 *
 * @param {Element} icon - DOM-элемент иконки, к которому привязывается popover.
 * @param {ComponentInstance} instance - Объект с данными экземпляра для отображения.
 */
export const showPopover = (icon: Element, instance: ComponentInstance): void => {
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