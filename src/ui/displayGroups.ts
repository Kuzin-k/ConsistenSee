import { ComponentData } from "../shared/types";

/**
 * @interface GroupedData
 * @description Представляет объект, в котором данные сгруппированы по ключу.
 */
interface GroupedData {
  /** Ключ - это идентификатор группы, значение - массив экземпляров в этой группе. */
  [key: string]: ComponentData[];
}

import { createIcon } from "./createIcon";
import { showPopover } from "./showPopover";
import { displayVersionTag } from "./displayVersionTag";

// Основная функция отображения групп
/**
 * @description
 * Рендерит сгруппированные данные (компоненты, цвета и т.д.) в виде интерактивного списка в указанном DOM-элементе.
 * Функция динамически создает HTML-структуру для каждой группы и ее элементов, добавляя интерактивность,
 * такую как прокрутка к элементу в Figma, выделение группы и отображение детальной информации во всплывающем окне.
 *
 * @param {GroupedData} groupedData - Объект, где ключи — это идентификаторы групп (например, ключ главного компонента),
 * а значения — массивы объектов `ComponentData`, принадлежащих этой группе.
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
export const displayGroups = (
  groupedData: GroupedData,
  targetList: HTMLElement,
  tabType: string = ""
): void => {
  
  
  targetList.innerHTML = ""; // Очищаем список перед добавлением новых элементов


  // Сначала проверим, существует ли targetList и его id
  if (!targetList || !targetList.id) {
    console.error("Target list or its ID is undefined.");
    return;
  }



  for (const key in groupedData) {
    const group = groupedData[key];
    // Теперь group уже должен быть отфильтрован по hidden перед вызовом displayGroups

    if (group.length === 0) continue; // Пропускаем группу, если она пуста

    const firstInstance = group[0];
    // название - имя компонента из библиотеки

    const name = firstInstance.mainComponentSetName
      ? firstInstance.mainComponentSetName
      : firstInstance.mainComponentName
      ? firstInstance.mainComponentName
      : firstInstance.name;

    // Если в группе только один элемент, показываем его без группировки
    /*
    if (group.length === 1) {
      const instance = group[0];
      const groupItem = document.createElement('ul');
      groupItem.classList.add('group-header');

      const componentNameContainer = document.createElement('span');
      componentNameContainer.classList.add('component-name-container');

      // Добавляем иконку для элемента
      const itemIcon = createIcon(instance.type);
      componentNameContainer.insertBefore(itemIcon, componentNameContainer.firstChild);

      // Добавляем обработчик клика для иконки
      itemIcon.addEventListener('click', (e) => {
        e.stopPropagation();
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
      itemIcon.addEventListener('mouseenter', () => {showPopover(itemIcon, instance as any);});

      // Создаем ссылку на название инстанса
      const nameLink = document.createElement('a');
      nameLink.href = '#';
      nameLink.classList.add('component-link');
      nameLink.textContent = instance.mainComponentSetName ? instance.mainComponentSetName : (instance.mainComponentName || '');
      
      nameLink.addEventListener('click', (e) => {
        e.preventDefault();
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

      componentNameContainer.appendChild(nameLink);
      
      // Добавляем имя родительского компонента
      if (instance.parentName) {
        const parentName = document.createElement('span');
        parentName.classList.add('parent-component-name');
        parentName.textContent = 'in ' + instance.parentName;
        componentNameContainer.appendChild(parentName);
      }

      // Добавляем метку hidden, если элемент скрыт
      if (instance.hidden) {
          const hiddenLabel = document.createElement('span');
          hiddenLabel.classList.add('hidden-label');
          hiddenLabel.textContent = 'hidden';
          componentNameContainer.appendChild(hiddenLabel);
        }

      // тег версии для одиночного элемента на первом уровне
            // Debug: Log version data before passing to displayVersionTag
            if (instance.libraryComponentVersion) {
              console.log(`[UI] Component ${instance.name} has libraryComponentVersion: ${instance.libraryComponentVersion}`);
            }
            
            const versionGroup = displayVersionTag({
              instanceVersion: instance.nodeVersion ?? undefined,
              libraryVersion: instance.libraryComponentVersion ?? undefined,
              isOutdated: instance.isOutdated,
              checkVersion: instance.checkVersion ?? undefined,
              tabType: tabType
            });
            if (versionGroup && componentNameContainer) {
              try { componentNameContainer.appendChild(versionGroup); } catch (err) { console.error('Failed to append versionGroup to componentNameContainer', err); }
            }

            if (componentNameContainer) {
              groupItem.appendChild(componentNameContainer);
            } else {
              console.error('displayGroups: componentNameContainer is undefined for single item', instance);
            }
            targetList.appendChild(groupItem);
            continue; // Переходим к следующей группе
    }
    */
    // Для групп с более чем одним элементом оставляем существующую логику
    const groupHeader = document.createElement("ul");
    groupHeader.classList.add("group-header");

    const groupName = document.createElement("div");
    groupName.classList.add("group-name");

    // иконка для инстансов и прочих элементов
    const groupicon = document.createElement("div");
    groupicon.classList.add("instance-icon");
    const icon = createIcon(firstInstance.type);
    groupicon.appendChild(icon);
    groupHeader.appendChild(groupicon);

    //ТУТ заголовки групп
    // Формируем groupName через innerHTML для корректного применения форматирования
    let groupNameHtml = "";
    groupNameHtml += name;
    groupNameHtml += ` <span class="group-counter">${group.length}</span>`;
    if (groupName && typeof (groupName as unknown as { innerHTML?: string }).innerHTML !== "undefined") {
      groupName.innerHTML = groupNameHtml;
    } else {
      console.error(
        "displayGroups: failed to set groupName.innerHTML, groupName is",
        groupName
      );
    }

    // Остальная логика для создания контейнера select all и добавления его в заголовок группы

    // Создаем контейнер для select all, который будет виден только при наведении
    const selectAllContainer = document.createElement("span");
    selectAllContainer.classList.add("select-all-container");

    // Создаем ссылку select all
    const selectAllLink = document.createElement("a");
    selectAllLink.href = "#";
    selectAllLink.classList.add("select-all-link");
    selectAllLink.title = "Select all"; // Добавляем атрибут title для отображения tooltip

    // Создаем SVG иконку вместо текста
    const svgIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    svgIcon.setAttribute("width", "20");
    svgIcon.setAttribute("height", "20");
    svgIcon.innerHTML = '<use xlink:href="#select-all-icon"></use>';
    selectAllLink.appendChild(svgIcon);
    selectAllLink.style.visibility = "hidden"; // Изначально скрыта
    selectAllLink.style.marginLeft = "auto";

    // Добавляем обработчик клика для выбора всех элементов группы
    selectAllLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // Предотвращаем раскрытие/закрытие группы при клике на ссылку

      // Собираем nodeIds всех элементов группы
      const nodeIds = group.map((item) => item.nodeId);

      // Отправляем сообщение в плагин для выбора элементов
      parent.postMessage(
        {
          pluginMessage: {
            type: "select-nodes",
            nodeIds: nodeIds,
          },
        },
        "*"
      );
    });

    selectAllContainer.appendChild(selectAllLink);

    groupName.appendChild(selectAllContainer);
    groupHeader.appendChild(groupName);

    // Добавляем обработчики событий для показа/скрытия ссылки при наведении
    groupHeader.addEventListener("mouseenter", () => {
      selectAllLink.style.visibility = "visible";
    });

    groupHeader.addEventListener("mouseleave", () => {
      selectAllLink.style.visibility = "hidden";
    });

    // Бейдж версии заголовка группы
    const versionsInGroup = group.map((item) => item.nodeVersion || "      ");
    const libraryVersionsInGroup = group.map(
      (item) => item.libraryComponentVersion || "      "
    );
    const uniqueVersions = [...new Set(versionsInGroup)];
    const uniqueLibraryVersions = [...new Set(libraryVersionsInGroup)];

    // Проверяем, есть ли устаревшие элементы в группе
    const hasOutdatedItems = group.some((item) => item.isOutdated);

    const versionGroupHeader = displayVersionTag({
      uniqueVersions: uniqueVersions,
      libraryVersion: uniqueLibraryVersions[0],
      isGroupHeader: true,
      isOutdated: hasOutdatedItems,
      groupItems: group,
      tabType: tabType,
    });

    if (versionGroupHeader) {
      groupHeader.appendChild(versionGroupHeader);
    } else {
      // versionGroupHeader may be undefined/null if displayVersionTag returns nothing
      console.warn(
        "displayGroups: versionGroupHeader is empty for group",
        name
      );
    }

    targetList.appendChild(groupHeader);

    const groupItems = document.createElement("ul");
    groupItems.classList.add("group-items");

    group.forEach((instance) => {
      const groupItem = document.createElement("li");
      const componentNameContainer = document.createElement("div");
      componentNameContainer.classList.add("component-name-container");
      componentNameContainer.style.display = "flex";
      componentNameContainer.style.alignItems = "right";
      // Добавляем иконку для элемента на основе его типа
      const itemIcon = createIcon(instance.type);
      componentNameContainer.insertBefore(
        itemIcon,
        componentNameContainer.firstChild
      );

      // Добавляем обработчик клика для иконки
      itemIcon.addEventListener("click", (e) => {
        e.stopPropagation(); // Предотвращаем всплытие события
        parent.postMessage(
          {
            pluginMessage: {
              type: "scroll-to-node",
              nodeId: instance.nodeId,
            },
          },
          "*"
        );
      });

      // Добавляем popover при наведении на иконку
      itemIcon.addEventListener("mouseenter", () => {
        showPopover(itemIcon, instance);
      });

      // Создаем ссылку на название инстанса
      const nameLink = document.createElement("a");
      nameLink.href = "#"; // Убираем стандартное поведение ссылки
      nameLink.classList.add("component-link");
      nameLink.textContent = instance.name || "Без названия";

      // Добавляем обработчик клика для отправки nodeId в плагин
      nameLink.addEventListener("click", (e) => {
        e.preventDefault(); // Отменяем стандартное поведение ссылки
        parent.postMessage(
          {
            pluginMessage: {
              type: "scroll-to-node",
              nodeId: instance.nodeId, // Передаем nodeId инстанса
            },
          },
          "*"
        );
      });

      componentNameContainer.appendChild(nameLink);

      // Add parent component name if exists
      if (instance.parentName) {
        const parentName = document.createElement("span");
        parentName.classList.add("parent-component-name");
        parentName.textContent = "in " + instance.parentName;
        componentNameContainer.appendChild(parentName);
      }

      // Добавляем метку (hidden), если элемент скрыт
      if (instance.hidden) {
        const hiddenLabel = document.createElement("span");
        hiddenLabel.classList.add("hidden-label");
        hiddenLabel.textContent = "hidden";
        componentNameContainer.appendChild(hiddenLabel);
      }

      // Добавляем информацию о цвете, если это элемент с цветом
      groupItem.appendChild(componentNameContainer);

      
      
      const versionGroup = displayVersionTag({
        instanceVersion: instance.nodeVersion ?? undefined,
        libraryVersion: instance.libraryComponentVersion ?? undefined,
        isOutdated: instance.isOutdated,
        checkVersion: instance.checkVersion ?? undefined,
        tabType: tabType,
      });

      if (versionGroup) {
        componentNameContainer.appendChild(versionGroup);
      }
      groupItems.appendChild(groupItem);
    });
    targetList.appendChild(groupItems);
    // Добавляем обработчик клика для заголовка группы
    groupHeader.addEventListener("click", () => {
      groupItems.classList.toggle("expanded");
    });
  }
};

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).UIModules = (window as unknown as Record<string, unknown>).UIModules || {};
  ((window as unknown as Record<string, unknown>).UIModules as Record<string, unknown>).displayGroups = displayGroups;
}
