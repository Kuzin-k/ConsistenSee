/**
 * @function createIcon
 * @description Создает и возвращает SVG-элемент иконки на основе типа узла Figma.
 * Использует SVG-спрайт, определенный в `ui.html`, для получения нужной иконки.
 *
 * @param {string} type - Тип узла Figma (например, 'INSTANCE', 'FRAME', 'TEXT').
 * @returns {SVGElement} Готовый SVG-элемент с иконкой.
 */
export const createIcon = (type: string): SVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  
  // Определяем класс иконки на основе типа
  let iconClass = 'info-icon'; // По умолчанию используем info-icon
  let iconId = 'info-icon';    // По умолчанию используем info иконку
  
  switch (type) {
    case 'INSTANCE':
      iconClass = 'instance-icon';
      iconId = 'instance-icon';
      break;
    case 'TEXT':
      iconClass = 'text-icon';
      iconId = 'text-icon';
      break;
    case 'FRAME':
      iconClass = 'frame-icon';
      iconId = 'frame-icon';
      break;
    case 'RECTANGLE':
      iconClass = 'rectangle-icon';
      iconId = 'rectangle-icon';
      break;
    case 'VECTOR':
      iconClass = 'frame-icon'; // Используем frame иконку для vector
      iconId = 'frame-icon';
      break;
  }
  
  svg.classList.add(iconClass);
  
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${iconId}`);
  svg.appendChild(use);
  
  return svg;
};