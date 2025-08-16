/**
 * @function createIcon
 * @description Создает и возвращает SVG-элемент иконки на основе типа узла Figma.
 * Использует SVG-спрайт, определенный в `ui.html`, для получения нужной иконки.
 * 
 * Функция работает по следующему принципу:
 * 1. Создает базовый SVG-элемент с правильным namespace
 * 2. Определяет соответствующий класс CSS и ID иконки на основе типа узла
 * 3. Создает элемент <use> для ссылки на иконку в SVG-спрайте
 * 4. Возвращает готовый к использованию SVG-элемент
 *
 * @param {string} type - Тип узла Figma (например, 'INSTANCE', 'FRAME', 'TEXT', 'RECTANGLE', 'VECTOR').
 * @returns {SVGElement} Готовый SVG-элемент с иконкой, готовый для вставки в DOM.
 * 
 * @example
 * // Создание иконки для компонента
 * const instanceIcon = createIcon('INSTANCE');
 * document.body.appendChild(instanceIcon);
 * 
 * @example
 * // Создание иконки для текстового элемента
 * const textIcon = createIcon('TEXT');
 * someContainer.appendChild(textIcon);
 */
export const createIcon = (type: string): SVGElement => {
  // Создаем базовый SVG-элемент с правильным namespace для корректной работы
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  
  // Инициализируем переменные для класса CSS и ID иконки
  // По умолчанию используем info-icon для неизвестных типов
  let iconClass = 'info-icon'; 
  let iconId = 'info-icon';    
  
  // Определяем соответствующую иконку на основе типа узла Figma
  switch (type) {
    case 'INSTANCE':
      // Иконка для компонентов и экземпляров компонентов
      iconClass = 'instance-icon';
      iconId = 'instance-icon';
      break;
    case 'TEXT':
      // Иконка для текстовых элементов
      iconClass = 'text-icon';
      iconId = 'text-icon';
      break;
    case 'FRAME':
      // Иконка для фреймов и групп
      iconClass = 'frame-icon';
      iconId = 'frame-icon';
      break;
    case 'RECTANGLE':
      // Иконка для прямоугольников и других базовых фигур
      iconClass = 'rectangle-icon';
      iconId = 'rectangle-icon';
      break;
    case 'VECTOR':
      // Для векторных элементов используем иконку фрейма
      // так как они визуально похожи по функциональности
      iconClass = 'frame-icon';
      iconId = 'frame-icon';
      break;
    // Для всех остальных типов используются значения по умолчанию (info-icon)
  }
  
  // Добавляем CSS-класс к SVG-элементу для стилизации
  svg.classList.add(iconClass);
  
  // Создаем элемент <use> для ссылки на иконку в SVG-спрайте
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  
  // Устанавливаем ссылку на конкретную иконку в спрайте через XLink
  // Атрибут href указывает на ID элемента в SVG-спрайте
  use.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${iconId}`);
  
  // Добавляем элемент <use> внутрь SVG-контейнера
  svg.appendChild(use);
  
  // Возвращаем готовый SVG-элемент с иконкой
  return svg;
};