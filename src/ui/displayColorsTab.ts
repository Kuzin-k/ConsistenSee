// Типы для данных компонентов
/**
 * @interface ComponentInstance
 * @description Определяет структуру данных для одного экземпляра компонента или узла,
 * который будет отображаться в UI. Содержит всю необходимую информацию для рендеринга и интерактивности.
 */
interface ComponentInstance {
  /** Тип узла в Figma (например, 'INSTANCE', 'FRAME', 'TEXT'). */
  type: string;
  /** Имя самого узла (инстанса). */
  name: string;
  /** Уникальный ID узла в документе Figma. */
  nodeId: string;
  /** Имя родительского набора компонентов (Component Set), если применимо. */
  mainComponentSetName?: string;
  /** Имя главного компонента (main component). */
  mainComponentName?: string;
  /** Имя родительского компонента, если узел вложен в другой инстанс. */
  parentName?: string;
  /** Флаг, указывающий, скрыт ли узел или его родитель. */
  hidden: boolean;
  /** Флаг, указывающий, является ли компонент устаревшим по сравнению с библиотечной версией. */
  isOutdated?: boolean;
  /** Версия компонента из библиотеки (если доступна). */
  libraryComponentVersion?: string | null;
  /** Версия, извлеченная из описания локального компонента. */
  nodeVersion?: string | null;
  /** Полное описание компонента. */
  description?: string | null;
  /** Флаг, указывающий, что это узел с информацией о цвете. */
  color?: boolean;
  /** HEX-код цвета заливки. */
  fill?: string;
  /** Имя переменной цвета заливки. `false`, если переменная не найдена. */
  fill_variable_name?: string | false;
  /** Имя коллекции, к которой принадлежит переменная цвета заливки. */
  fill_collection_name?: string;
  /** HEX-код цвета обводки. */
  stroke?: string;
  /** Имя переменной цвета обводки. `false`, если переменная не найдена. */
  stroke_variable_name?: string | false;
  /** Имя коллекции, к которой принадлежит переменная цвета обводки. */
  stroke_collection_name?: string;
}

/**
 * @interface GroupedData
 * @description Представляет объект, в котором данные сгруппированы по ключу.
 */
interface GroupedData {
  /** Ключ - это идентификатор группы, значение - массив экземпляров в этой группе. */
  [key: string]: ComponentInstance[];
}

import { createIcon } from './createIcon';
import { showPopover } from './showPopover';
import { displayVersionTag } from './displayVersionTag';

// Основная функция отображения групп
/**
 * @description
 * Рендерит сгруппированные данные (компоненты, цвета и т.д.) в виде интерактивного списка в указанном DOM-элементе.
 * Функция динамически создает HTML-структуру для каждой группы и ее элементов, добавляя интерактивность,
 * такую как прокрутка к элементу в Figma, выделение группы и отображение детальной информации во всплывающем окне.
 *
 * @param {GroupedData} groupedData - Объект, где ключи — это идентификаторы групп (например, ключ главного компонента),
 * а значения — массивы объектов `ComponentInstance`, принадлежащих этой группе.
 * @param {HTMLElement} targetList - DOM-элемент (обычно `<ul>`), в который будут добавлены сгенерированные группы.
 *
 * @details
 * **Логика работы:**
 * 1.  **Очистка:** Перед рендерингом полностью очищает содержимое `targetList`.
 * 2.  **Заголовки для цветов:** Если `targetList` предназначен для отображения цветов (ID `colorResultsList` или `colorStrokeResultsList`),
 *     добавляет соответствующий заголовок ("Fill" или "Stroke").
 * 3.  **Итерация по группам:** Проходит по каждой группе в `groupedData`.
 * 4.  **Одиночные элементы:** Если группа содержит только один элемент (и это не список цветов), она отображается как
 *     одна негруппированная строка для более компактного вида.
 * 5.  **Группы элементов:** Если в группе несколько элементов, создается сворачиваемый блок:
 *     - **Заголовок группы (`group-header`):**
 *       - Отображает иконку типа (для компонентов) или цветовой образец (для цветов).
 *       - Показывает имя группы (например, имя главного компонента) и количество элементов в ней.
 *       - При наведении появляется иконка "Выделить все", которая отправляет команду `select-nodes` в бэкенд.
 *       - Отображает общую информацию о версиях в группе (например, "NEW", если есть обновления, или "...", если версии различаются).
 *       - Заголовок является кликабельным и раскрывает/сворачивает список элементов.
 *     - **Список элементов (`group-items`):**
 *       - Для каждого элемента в группе создается отдельная строка (`<li>`).
 *       - **Иконка:** Рядом с каждым элементом отображается иконка его типа. Клик по иконке отправляет команду `scroll-to-node` в бэкенд.
 *         При наведении на иконку появляется popover с полной информацией об элементе (`showPopover`).
 *       - **Имя:** Имя элемента является ссылкой, которая также вызывает `scroll-to-node`.
 *       - **Доп. информация:** Отображаются имя родительского компонента (если есть), метка "hidden" для скрытых элементов,
 *         а также индивидуальные метки версии и статуса обновления (`isOutdated`).
 *       - **Для цветов:** Дополнительно рендерится детальная информация о цвете (HEX-код, имя переменной, коллекция).
 * 6.  **Фильтрация:** Учитывает состояние переключателя "Show hidden" для отображения или скрытия невидимых элементов.
 */
export const displayColorsTab = (groupedData: GroupedData, targetList: HTMLElement, isOutdatedTab: boolean = false): void => {
  const showHidden = document.getElementById('showHiddenToggle') ? 
    (document.getElementById('showHiddenToggle') as HTMLInputElement).checked : true;
  
  targetList.innerHTML = ''; // Очищаем список перед добавлением новых элементов
  
  // Добавляем заголовок перед списком элементов
  let headerText = '';
  // Сначала проверим, существует ли targetList и его id
  if (!targetList || !targetList.id) {
    console.error('Target list or its ID is undefined.');
    return;
  }
  if (targetList.id === 'colorResultsList') headerText = 'Fill';
  if (targetList.id === 'colorStrokeResultsList') headerText = 'Stroke';
  if (headerText) {
    // Удаляем предыдущий заголовок, если он есть
    const prevHeader = targetList.previousElementSibling;
    if (prevHeader && prevHeader.classList.contains('section-header')) {
      prevHeader.remove();
    }
    const header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = headerText;
    targetList.parentNode?.insertBefore(header, targetList);
  }
  
  // Логика для подсчета имен
  const nameCount: { [key: string]: number } = {};

  for (const key in groupedData) {
    const group = groupedData[key];
    // Теперь group уже должен быть отфильтрован по hidden перед вызовом displayGroups

    if (group.length === 0) continue; // Пропускаем группу, если она пуста

    const firstInstance = group[0];
    // название - имя компонента из библиотеки

    const name = firstInstance.mainComponentSetName ? firstInstance.mainComponentSetName 
      : firstInstance.mainComponentName ? firstInstance.mainComponentName 
      : firstInstance.name;

    // Для групп с более чем одним элементом оставляем существующую логику
    const groupHeader = document.createElement('ul');
    groupHeader.classList.add('group-header');

    const groupName = document.createElement('div');
    groupName.classList.add('group-name');

    // Создаем цветной квадратик для fill
    if (targetList.id === 'colorResultsList') {
        const fillSwatch = document.createElement('div');
        fillSwatch.classList.add('group-color-icon');
        fillSwatch.style.backgroundColor = firstInstance.fill || '';
        if (firstInstance.fill_collection_name === "2" || firstInstance.fill_collection_name === "Color Styles") {
          fillSwatch.style.borderRadius = '999px'; // круг
        }
        groupHeader.appendChild(fillSwatch);
      }
      else if (targetList.id === 'colorStrokeResultsList') {
        // Создаем цветной квадратик для stroke
        const strokeSwatch = document.createElement('div');
        strokeSwatch.classList.add('group-color-icon');
        strokeSwatch.style.backgroundColor = firstInstance.stroke || '';
        // Проверяем, является ли библиотека name=2, и если да, делаем круг вместо квадрата
          if (firstInstance.stroke_collection_name === "2" || firstInstance.stroke_collection_name === "Color Styles") {
            strokeSwatch.style.borderRadius = '999px'; // круг
          }
          groupHeader.appendChild(strokeSwatch);
      }

    
    //ТУТ заголовки групп
     // Формируем groupName через innerHTML для корректного применения форматирования
      let groupNameHtml = '';
      if (targetList.id === 'colorResultsList') 
      {
        groupNameHtml += (firstInstance.fill_variable_name ? firstInstance.fill_variable_name : firstInstance.fill);
        groupNameHtml += firstInstance.fill_collection_name ? `<span style="font-weight:300">&nbsp;from ${firstInstance.fill_collection_name}&nbsp;</span>` : '';
      } else if (targetList.id === 'colorStrokeResultsList') 
      {
        groupNameHtml += (firstInstance.stroke_variable_name ? firstInstance.stroke_variable_name : firstInstance.stroke);
        groupNameHtml += firstInstance.stroke_collection_name? `<span style="font-weight:300">&nbsp;from ${firstInstance.stroke_collection_name}&nbsp;</span>` : '';
      } 
      groupNameHtml += ` <span class="group-counter">${group.length}</span>`;
      
      groupName.innerHTML = groupNameHtml;
      

    

    // Остальная логика для создания контейнера select all и добавления его в заголовок группы
    
      // Создаем контейнер для select all, который будет виден только при наведении
      const selectAllContainer = document.createElement('span');
      selectAllContainer.classList.add('select-all-container');
      
      // Создаем ссылку select all
      const selectAllLink = document.createElement('a');
      selectAllLink.href = '#';
      selectAllLink.classList.add('select-all-link');
      selectAllLink.title = 'Select all'; // Добавляем атрибут title для отображения tooltip
      // Создаем SVG иконку вместо текста
      const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgIcon.setAttribute('width', '20');
      svgIcon.setAttribute('height', '20');
      svgIcon.innerHTML = '<use xlink:href="#select-all-icon"></use>';
      selectAllLink.appendChild(svgIcon);
      selectAllLink.style.visibility = 'hidden'; // Изначально скрыта
      selectAllLink.style.marginLeft = 'auto';
      
      // Добавляем обработчик клика для выбора всех элементов группы
      selectAllLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Предотвращаем раскрытие/закрытие группы при клике на ссылку
        
        // Собираем nodeIds всех элементов группы
        const nodeIds = group.map(item => item.nodeId);
        
        // Отправляем сообщение в плагин для выбора элементов
        parent.postMessage({
          pluginMessage: {
            type: 'select-nodes',
            nodeIds: nodeIds
          }
        }, '*');
      });
      
      selectAllContainer.appendChild(selectAllLink);
      
      groupName.appendChild(selectAllContainer);
      groupHeader.appendChild(groupName);
      
      // Добавляем обработчики событий для показа/скрытия ссылки при наведении
      groupHeader.addEventListener('mouseenter', () => {
        selectAllLink.style.visibility = 'visible';
      });
      
      groupHeader.addEventListener('mouseleave', () => {
        selectAllLink.style.visibility = 'hidden';
      });
    

    targetList.appendChild(groupHeader);

    const groupItems = document.createElement('ul');
    groupItems.classList.add('group-items');

    group.forEach((instance) => {
      const groupItem = document.createElement('li');
      const componentNameContainer = document.createElement('div');
      componentNameContainer.classList.add('component-name-container');
      componentNameContainer.style.display = 'flex';
      componentNameContainer.style.alignItems = 'right';
      // Добавляем иконку для элемента на основе его типа
      const itemIcon = createIcon(instance.type);
      componentNameContainer.insertBefore(itemIcon, componentNameContainer.firstChild);

      // Добавляем обработчик клика для иконки
      itemIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // Предотвращаем всплытие события
        parent.postMessage(
          {
            pluginMessage: {
              type: 'scroll-to-node',
              nodeId: instance.nodeId,
            },
          },
          '*'
        );
      });

      // Добавляем popover при наведении на иконку
      itemIcon.addEventListener('mouseenter', () => {
        showPopover(itemIcon, instance as any);
      });

      // Создаем ссылку на название инстанса
      const nameLink = document.createElement('a');
      nameLink.href = '#'; // Убираем стандартное поведение ссылки
      nameLink.classList.add('component-link');
      nameLink.textContent = instance.name || 'Без названия';
      
     

      // Добавляем обработчик клика для отправки nodeId в плагин
      nameLink.addEventListener('click', (e) => {
        e.preventDefault(); // Отменяем стандартное поведение ссылки
        parent.postMessage(
          {
            pluginMessage: {
              type: 'scroll-to-node',
              nodeId: instance.nodeId, // Передаем nodeId инстанса
            },
          },
          '*'
        );
      });

      

      componentNameContainer.appendChild(nameLink);

      // Add parent component name if exists
      if (instance.parentName) {
        const parentName = document.createElement('span');
        parentName.classList.add('parent-component-name');
        parentName.textContent = 'in ' + instance.parentName;
        componentNameContainer.appendChild(parentName);
      }

      // Добавляем метку (hidden), если элемент скрыт
      if (instance.hidden) {
        const hiddenLabel = document.createElement('span');
        hiddenLabel.classList.add('hidden-label');
        hiddenLabel.textContent = 'hidden';
        componentNameContainer.appendChild(hiddenLabel);
      }

      // Добавляем информацию о цвете, если это элемент с цветом
      if (instance.color) {
        // Проверяем, есть ли переменные без имен
        const hasMissingVariables = 
          (instance.fill && (instance.fill_variable_name === false || instance.fill_variable_name === '')) ||
          (instance.stroke && (instance.stroke_variable_name === false || instance.stroke_variable_name === ''));
        
        // Перемещаем название элемента наверх перед отображением цветов
        groupItem.appendChild(componentNameContainer);
        
        // Отображаем информацию о fill
        if (instance.fill) {
          const fillContainer = document.createElement('div');
          fillContainer.style.display = 'flex';
          fillContainer.style.alignItems = 'center';
          fillContainer.style.marginTop = '0px';
          fillContainer.style.marginLeft = '0px';
          fillContainer.style.marginBottom = '4px';
          
          // Создаем цветной квадратик для fill
          const fillSwatch = document.createElement('div');
          fillSwatch.style.width = '16px';
          fillSwatch.style.height = '16px';
          fillSwatch.style.backgroundColor = instance.fill;
          
          // Проверяем, является ли библиотека name=2, и если да, делаем круг вместо квадрата
          if (instance.fill_collection_name === "2" || instance.fill_collection_name === "Color Styles") {
            fillSwatch.style.borderRadius = '999px'; // круг
          } else {
            fillSwatch.style.borderRadius = '4px'; // квадрат со скругленными углами
          }
          
          fillSwatch.style.marginRight = '4px';
          fillSwatch.style.marginLeft = '00px';
          fillSwatch.style.border = '1px solid #ddd';
          
          // Создаем контейнер для информации о цвете
          const fillInfo = document.createElement('div');
          fillInfo.style.display = 'flex';
          fillInfo.style.flexDirection = 'row';
          fillInfo.style.gap = '4px';
          fillInfo.style.justifyContent = 'space-between';
          fillInfo.style.width = '100%';

          groupItem.appendChild(componentNameContainer);
          
          // Добавляем информацию о переменной, если она есть
          const varInfo = document.createElement('span');
          // Добавляем надпись Fill
          const fillType = document.createElement('span');
          fillType.textContent = 'Fill';
          fillType.style.color = 'var(--text-light-color)';
          fillType.style.fontWeight = '300';
          fillType.style.marginLeft = 'auto';
          fillType.style.fontSize = 'var(--font-small)';

          // Создаем элемент для информации о коллекции
          const collectionName = document.createElement('span');

          if (instance.fill_variable_name) {
            // Отображаем переменную
            varInfo.textContent = instance.fill_variable_name;
            varInfo.style.color = 'var(--text-light-color)';
            varInfo.style.fontWeight = '400';
            
            // Добавляем коллекцию в скобках, если она есть
            if (instance.fill_collection_name) {
              collectionName.textContent = ` from ${instance.fill_collection_name}`;
              collectionName.style.color = 'var(--text-light-color)';
              collectionName.style.fontWeight = '300';
              
            }
          } else {
            // Отображаем hex-код цвета
            varInfo.textContent = instance.fill;
            varInfo.style.color = 'var(--text-light-color)';
            varInfo.style.fontWeight = '400';
          }

          // Добавляем элементы в контейнер информации
          
          fillInfo.appendChild(varInfo);
          fillInfo.appendChild(collectionName);
          fillInfo.appendChild(fillType);
          
          groupItem.appendChild(fillContainer);
        }
        
        // Отображаем информацию о stroke
        if (instance.stroke) {
          const collectionName = document.createElement('span');
          const strokeContainer = document.createElement('div');
          strokeContainer.style.display = 'flex';
          strokeContainer.style.alignItems = 'center';
          strokeContainer.style.marginTop = '0px';
          strokeContainer.style.marginLeft = '0px';
          strokeContainer.style.marginBottom = '4px';
         
          
          // Создаем цветной квадратик для stroke
          const strokeSwatch = document.createElement('div');
          strokeSwatch.style.width = '16px';
          strokeSwatch.style.height = '16px';
          strokeSwatch.style.backgroundColor = instance.stroke;
          
          // Проверяем, является ли библиотека name=2, и если да, делаем круг вместо квадрата
          if (instance.stroke_collection_name === "2" || instance.stroke_collection_name === "Color Styles") {
            strokeSwatch.style.borderRadius = '999px'; // круг
          } else {
            strokeSwatch.style.borderRadius = '3px'; // квадрат со скругленными углами
          }
          
          strokeSwatch.style.marginRight = '8px';
          strokeSwatch.style.border = '1px solid #ddd';
          
          // Создаем контейнер для информации о цвете
          const strokeInfo = document.createElement('div');
          strokeInfo.style.display = 'flex';
          strokeInfo.style.flexDirection = 'row';
          strokeInfo.style.gap = '4px';
          strokeInfo.style.justifyContent = 'space-between';
          strokeInfo.style.width = '100%';
          
          // Добавляем информацию о переменной, если она есть
          const varInfo = document.createElement('span');
          if (instance.stroke_variable_name) {
            // Отображаем переменную
            varInfo.textContent = instance.stroke_variable_name;
            varInfo.style.color = 'var(--text-light-color)';
            varInfo.style.fontWeight = '400';
            
            
            // Добавляем коллекцию в скобках, если она есть
            if (instance.stroke_collection_name) {
              collectionName.textContent = ` from ${instance.stroke_collection_name}`;
              collectionName.style.color = 'var(--text-light-color)';
              collectionName.style.fontWeight = '300';
            }
          } else {
            // Отображаем hex-код цвета
            varInfo.textContent = instance.stroke;
            varInfo.style.color = 'var(--text-light-color)';
            varInfo.style.fontWeight = '400';
          }
          
          
          
          // Добавляем надпись Stroke и вес обводки
          const strokeType = document.createElement('span');
          strokeType.textContent = 'Stroke';
          strokeType.style.color = 'var(--text-light-color)';
          strokeType.style.fontWeight = '300';
          strokeType.style.marginLeft = 'auto';
          strokeType.style.fontSize = 'var(--font-small)';
          
          
          strokeInfo.appendChild(varInfo);
          strokeInfo.appendChild(collectionName);
          strokeInfo.appendChild(strokeType);

          groupItem.appendChild(strokeContainer);
        }
      } 
      groupItems.appendChild(groupItem);
    });
    
    targetList.appendChild(groupItems);
    
    // Добавляем обработчик клика для заголовка группы
    groupHeader.addEventListener('click', () => {
      groupItems.classList.toggle('expanded');
    });
  }
};

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.displayColorsTab = displayColorsTab;
}