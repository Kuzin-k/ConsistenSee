/**
 * Модуль управления всплывающими подсказками (поповерами)
 * @module showPopover */

import { ComponentData } from '../shared/types';

/**
 * Подробная документация для функции showPopover
 * 
 * Назначение:
 *  - Показать всплывающее окно (popover) с детальной информацией об одном
 *    компоненте/инстансе при наведении курсора на иконку в UI плагина.
 * 
 * Контракт (inputs / outputs / side-effects):
 *  - Вход: DOM-элемент-иконка (trigger) и объект данных компонента (ComponentData).
 *  - Выход: ничего не возвращает (void).
 *  - Побочные эффекты:
 *     * Создает DOM-элемент popover и добавляет его в document.body.
 *     * Позиционирует popover относительно элемента-иконки и внутри видимой области iframe.
 *     * Отправляет сообщения в родительское окно (parent.postMessage) чтобы изменить
 *       размер окна плагина (resize-plugin-window) и вернуть его к исходному размеру
 *       при закрытии (reset-plugin-window-size).
 *     * Добавляет слушатель события mouseleave на переданный icon, чтобы удалить popover.
 * 
 * Поведение и алгоритм (пошагово):
 *  1) Создает контейнер popover с классом 'popover' и базовыми стилями (position: fixed, maxWidth и zIndex).
 *  2) Формирует HTML-контент popover'а, проходясь по полям объекта instance
 *     и превращая каждую пару ключ-значение в строку вида "<strong>key:</strong> value".
 *     Сложные значения (объекты) сериализуются через JSON.stringify.
 *  3) Временно отображает popover (скрыто), чтобы получить его реальный размер через getBoundingClientRect().
 *     Затем скрывает временный показ и продолжает позиционирование.
 *  4) Вычисляет координаты left/top: по умолчанию popover открывается под иконкой (rect.bottom + offset).
 *  5) При необходимости корректирует позицию по горизонтали и вертикали, чтобы popover
 *     не выходил за видимую область iframe (с отступом 10px).
 *  6) Устанавливает вычисленные координаты и показывает popover (display = 'block').
 *  7) Отправляет сообщение в родительское окно с командой 'resize-plugin-window' и
 *     рекомендуемыми размерами (width/height), чтобы хост плагина мог подстроить
 *     размер фрейма и полностью вместить popover.
 *  8) Устанавливает обработчик 'mouseleave' на переданном icon, который удаляет popover
 *     и шлёт команду 'reset-plugin-window-size' в родительский код.
 * 
 * Пограничные случаи и замечания:
 *  - Если в instance есть циклические ссылки, JSON.stringify может выбросить ошибку;
 *    в данном коде мы не обрабатываем циклические структуры — предполагается, что
 *    объект instance плоский или безопасно сериализуем.
 *  - Если поповер очень большой и не помещается ни сверху, ни снизу, позиция будет
 *    скорректирована до минимальных отступов (10px) и окно плагина попытается
 *    увеличиться по сообщению resize-plugin-window.
 *  - Функция не ставит дебаунс на mouseleave; если иконка быстро выходит/заходит,
 *    возможны быстрые создания/удаления popover'ов. Это можно оптимизировать при необходимости.
 *  - Событие mouseleave добавляется на переданный icon при каждом вызове функции;
 *    если icon живёт долго и функция вызывается многократно для одного и того же
 *    элемента, можно вместо addEventListener использовать once или управлять слушателями
 *    чтобы избежать накопления обработчиков. В текущей реализации это упрощение.
 * 
 * Входные данные (кратко):
 *  - icon: HTMLElement — элемент, относительно которого позиционируется popover.
 *  - instance: ComponentData — структура с полями компонента (name, nodeId, versions, flags и т.д.).
 */
export const showPopover = (icon: Element, instance: ComponentData): void => {
  // Создаем контейнер поповера
  const popover = document.createElement('div');
  popover.classList.add('popover');
  

  // Формируем контент: простой рендер ключ-значение
  // Для объектов используем JSON.stringify для читаемого представления
  const content = Object.entries(instance).map(([key, value]) => {
    const boldKey = `<strong>${key}:</strong>`;
    if (typeof value === 'object' && value !== null) {
      try {
        return `${boldKey} ${JSON.stringify(value)}`;
      } catch (e) {
        // На случай циклических структур — заменяем на заметку
        return `${boldKey} [object]`;
      }
    }
    return `${boldKey} ${value}`;
  }).join('<br>');

  popover.innerHTML = content;
  document.body.appendChild(popover);

  // Получаем bounding rect иконки (триггера)
  const rect = icon.getBoundingClientRect();

  // Временно показываем popover (скрыто для пользователя), чтобы измерить реальные размеры
  popover.style.visibility = 'hidden';
  popover.style.display = 'block';
  const popoverRect = popover.getBoundingClientRect();
  // Скрываем опять — окончательное отображение после позиционирования
  popover.style.display = 'none';
  popover.style.visibility = 'visible';

  // Базовые координаты: показываем под иконкой с небольшим отступом
  let top = rect.bottom + 5;
  let left = rect.left;

  // Корректируем положение по горизонтали: не выходить за правый край iframe
  if (left + popoverRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popoverRect.width - 10;
  }
  if (left < 10) {
    left = 10; // минимальный отступ слева
  }

  // Корректируем положение по вертикали: если не помещается снизу — показываем сверху
  if (top + popoverRect.height > window.innerHeight - 10) {
    top = rect.top - popoverRect.height - 5;
  }
  if (top < 10) {
    top = 10; // минимальный отступ сверху
  }

  // Применяем координаты и показываем popover
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.display = 'block';

  // Отправляем сообщение в родительский код плагина чтобы подкорректировать размер окна
  parent.postMessage({
    pluginMessage: {
      type: 'resize-plugin-window',
      // Подбираем ширину/высоту с небольшим запасом (padding)
      width: Math.max(document.body.scrollWidth, popoverRect.width + left + 20),
      height: Math.max(document.body.scrollHeight, popoverRect.height + top + 20)
    }
  }, '*');

  // Обработчик удаления popover при уходе курсора с иконки
  const onLeave = () => {
    popover.remove();
    // Сообщаем родителю восстановить исходный размер окна (опционально)
    parent.postMessage({
      pluginMessage: {
        type: 'reset-plugin-window-size'
      }
    }, '*');
    // Удаляем обработчик чтобы не накапливать их
    try { icon.removeEventListener('mouseleave', onLeave); } catch (e) { /* silent */ }
  };

  icon.addEventListener('mouseleave', onLeave);
};