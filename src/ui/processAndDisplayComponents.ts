/**
 * Модуль для обработки и отображения компонентов с разделением на категории
 * @module processAndDisplayComponents
 */

import { displayGroups } from "./displayGroups";
import { sortGroups } from "./sortGroups";
import { filterDetachedFrames } from "../js/component/processDetachedFrame";
import { ComponentsResult, ComponentData } from "../shared/types";

/**
 * Обрабатывает данные компонентов и отображает их в интерфейсе с разделением на обычные компоненты и иконки
 *
 * @param componentsData - Структура данных, содержащая:
 *                        - instances: массив экземпляров компонентов
 *                        - counts: статистика по компонентам
 *                        - outdated: информация об устаревших компонентах
 * @param allInstances - Глобальный массив для хранения всех обработанных экземпляров
 * @param resultsList - DOM элемент для вывода обычных компонентов
 * @param iconResultsList - DOM элемент для вывода иконок
 * @param tabType - Тип вкладки: 'instances' | 'icons' | 'outdated' | 'lost' | 'deprecated'
 *
 * Функционал:
 * - Разделяет компоненты на обычные и иконки
 * - Группирует компоненты по их ключам
 * - Учитывает скрытые компоненты
 * - Обновляет счетчики вкладок ('instances', 'icons', 'outdated', 'lost')
 * - Для вкладки 'outdated' показывает только компоненты с checkVersion = 'Outdated'
 * - Для вкладки 'lost' показывает только компоненты с isLost = true
 */
export function processAndDisplayComponents(
  componentsData: ComponentsResult,
  allInstances: ComponentData[],
  resultsList: HTMLElement,
  iconResultsList?: HTMLElement,
  tabType: string = "instances"
): void {
  // Определяем источник данных в зависимости от типа вкладки
  let sourceInstances: ComponentData[];
  if (tabType === "outdated") {
    // Для вкладки outdated используем outdated массив или фильтруем instances по checkVersion
    if (componentsData.outdated && componentsData.outdated.length > 0) {
      sourceInstances = componentsData.outdated;
    } else {
      // Фильтруем instances по checkVersion = 'Outdated'
      sourceInstances = componentsData.instances.filter(
        (instance: ComponentData) => instance.checkVersion === "Outdated"
      );
    }
  } else if (tabType === "lost") {
    // Для вкладки lost используем lost массив или фильтруем instances по isLost
    if (componentsData.lost && componentsData.lost.length > 0) {
      sourceInstances = componentsData.lost;
    } else {
      sourceInstances = componentsData.instances.filter(
        (instance: ComponentData) => instance.isLost === true
      );
    }
  } else if (tabType === "deprecated") {
    // Для вкладки deprecated используем deprecated массив или фильтруем instances по isDeprecated
    if (componentsData.deprecated && componentsData.deprecated.length > 0) {
      sourceInstances = componentsData.deprecated;
    } else {
      sourceInstances = componentsData.instances.filter(
        (instance: ComponentData) => instance.isDeprecated === true
      );
    }
  } else if (tabType === "detached") {
    sourceInstances = componentsData.instances.filter((instance: ComponentData) => {
      const isDetached = instance.isDetached === true;
      return isDetached;
    });
  } else {
    sourceInstances = componentsData.instances;
  }

  // Обновляем глобальную ссылку на все инстансы (если вызывающий код полагается на неё)
  allInstances = sourceInstances;

  // Словари групп: ключ -> массив инстансов
  const groupedInstances: Record<string, ComponentData[]> = {};
  const groupedIcons: Record<string, ComponentData[]> = {};

  // Читаем переключатель отображения скрытых элементов из DOM
  const showHiddenToggle = document.getElementById(
    "showHiddenToggle"
  ) as HTMLInputElement;
  // Если переключателя нет в DOM, по умолчанию показываем скрытые
  const showHidden = showHiddenToggle ? showHiddenToggle.checked : true;

  // Счётчики для UI (тексты вкладок)
  let nonIconCount = 0;
  let iconCount = 0;
  let outdatedCount =
    componentsData.counts && typeof componentsData.counts.outdated === "number"
      ? componentsData.counts.outdated
      : componentsData.outdated
      ? componentsData.outdated.length
      : 0;
  let lostCount =
    componentsData.counts && typeof componentsData.counts.lost === "number"
      ? componentsData.counts.lost
      : componentsData.lost
      ? componentsData.lost.length
      : 0;
  let deprecatedCount =
    componentsData.counts &&
    typeof componentsData.counts.deprecated === "number"
      ? componentsData.counts.deprecated
      : componentsData.deprecated
      ? componentsData.deprecated.length
      : 0;

  // Добавляем подсчет detached элементов
  const detachedCount =
    componentsData.counts && typeof componentsData.counts.detached === "number"
      ? componentsData.counts.detached
      : filterDetachedFrames(componentsData.instances).length;



  // Проходим по всем инстансам и распределяем их в соответствующие группы
  // Проходим по всем инстансам и распределяем их в соответствующие группы
  sourceInstances.forEach((instance: ComponentData) => {
    if (!showHidden && instance.hidden) {
      return; // Пропускаем скрытые элементы
    }

    // Для вкладок с фильтрами проверяем соответствие условию
    if (tabType === "outdated" && instance.checkVersion !== "Outdated") {
      return;
    }
    if (tabType === "lost" && instance.isLost !== true) {
      return;
    }
    if (tabType === "deprecated" && instance.isDeprecated !== true) {
      return;
    }
    if (tabType === "detached" && !instance.isDetached) {
      return;
    }
    // Исключаем detached элементы из вкладки instances (ALL)
    if (tabType === "instances" && instance.isDetached) {
      return;
    }

    const groupKey =
      tabType === "detached"
        ? instance.name || "Unknown" // Для detached группируем по имени элемента
        : instance.mainComponentSetKey
        ? instance.mainComponentSetKey
        : instance.mainComponentKey || "Unknown";

    if (
      tabType === "outdated" ||
      tabType === "lost" ||
      tabType === "deprecated" ||
      tabType === "detached"
    ) {
      // Для специальных вкладок не разделяем на иконки и обычные, показываем все в одном списке
      if (!groupedInstances[groupKey]) {
        groupedInstances[groupKey] = [];
      }

      // Проверяем на дублирование перед добавлением
      const existingInstance = groupedInstances[groupKey].find(
        (existing: ComponentData) => existing.nodeId === instance.nodeId
      );
      if (existingInstance) {
        return; // Пропускаем дубликат
      }

      groupedInstances[groupKey].push(instance);
      nonIconCount++;
    } else if (instance.isIcon === true) {
      // Иконки группируем отдельно
      if (!groupedIcons[groupKey]) {
        groupedIcons[groupKey] = [];
      }
      groupedIcons[groupKey].push(instance);
      iconCount++;
    } else {
      if (!groupedInstances[groupKey]) {
        groupedInstances[groupKey] = [];
      }

      // Проверяем на дублирование перед добавлением для обычных компонентов
      const existingInstance = groupedInstances[groupKey].find(
        (existing: ComponentData) => existing.nodeId === instance.nodeId
      );
      if (existingInstance) {
        return; // Пропускаем дубликат
      }

      groupedInstances[groupKey].push(instance);
      nonIconCount++;
    }
  });

  // Компаратор: сначала по версии компонента (возрастание), затем по имени
  // Версия парсится как последовательность числовых частей: major.minor.patch
  // Пустая/нераспознаваемая версия считается «бесконечной» и сортируется после корректных версий.
  const parseVersionNumbers = (v?: string): number[] | null => {
    if (!v || typeof v !== "string") return null;
    // Убираем префикс 'v' и хвосты вроде '(minimal)' или '-beta'
    const m = v
      .trim()
      .replace(/^v\s*/i, "")
      .match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return null;
    return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
  };

  const compareByVersionThenName = (a: ComponentData, b: ComponentData): number => {
    // Используем исключительно nodeVersion из экземпляра
    const aVer = parseVersionNumbers(a.nodeVersion || "");
    const bVer = parseVersionNumbers(b.nodeVersion || "");

    if (aVer && bVer) {
      for (let i = 0; i < 3; i++) {
        if ((aVer[i] || 0) < (bVer[i] || 0)) return -1;
        if ((aVer[i] || 0) > (bVer[i] || 0)) return 1;
      }
      // версии равны — далее сравниваем по имени
    } else if (aVer && !bVer) {
      return -1; // a имеет версию, b нет => a раньше
    } else if (!aVer && bVer) {
      return 1; // b имеет версию, a нет => b раньше
    }

    const aName = (a.name || "").toString();
    const bName = (b.name || "").toString();
    return aName.localeCompare(bName);
  };

  // Для специальных вкладок используем простую сортировку по имени
  const compareByName = (a: ComponentData, b: ComponentData): number => {
    const aName = a.name || "";
    const bName = b.name || "";
    return aName.localeCompare(bName);
  };

  // Сортируем элементы внутри каждой группы
  const sortFunction =
    tabType === "outdated" ||
    tabType === "lost" ||
    tabType === "deprecated" ||
    tabType === "detached"
      ? compareByName
      : compareByVersionThenName;

  for (const key in groupedInstances) {
    groupedInstances[key].sort(sortFunction);
  }
  for (const key in groupedIcons) {
    groupedIcons[key].sort(sortFunction);
  }

  // Переопределяем счётчики для специальных вкладок исходя из реально отображаемых элементов
  if (tabType === "outdated") {
    outdatedCount = nonIconCount;
  }
  if (tabType === "lost") {
    lostCount = nonIconCount;
  }
  if (tabType === "deprecated") {
    deprecatedCount = nonIconCount;
  }

  // Обновляем тексты вкладок с количеством
  const allSubTab = document.querySelector(
    '.tab_borderless[data-tab="instances"]'
  );
  const iconsTab = document.querySelector('[data-tab="icons"]');
  const outdatedTab = document.querySelector('[data-tab="outdated"]');
  const lostTab = document.querySelector('[data-tab="lost"]');
  const deprecatedTab = document.querySelector('[data-tab="deprecated"]');

  // Обновляем только соответствующие вкладки для текущего типа
  if (tabType === "instances") {
    // Не обновляем текст верхней вкладки Instances, оставляем как есть
    // Верхняя вкладка Instances всегда остается активной и не блокируется
    // Также блокируем дочернюю вкладку "All"
    if (allSubTab) {
      allSubTab.textContent = `All (${nonIconCount + iconCount})`;
      // Блокируем вкладку если 0 элементов
      if (nonIconCount + iconCount === 0) {
        allSubTab.classList.remove("tab_borderless");
        allSubTab.classList.add("tab_borderless_disabled");
        (allSubTab as HTMLElement).style.pointerEvents = "none";
      } else {
        allSubTab.classList.remove("tab_borderless_disabled");
        allSubTab.classList.add("tab_borderless");
        (allSubTab as HTMLElement).style.pointerEvents = "auto";
      }
    }
    if (iconsTab) {
      iconsTab.textContent = `Icons (${iconCount})`;
      // Блокируем вкладку если 0 элементов
      if (iconCount === 0) {
        iconsTab.classList.remove("tab_borderless");
        iconsTab.classList.add("tab_borderless_disabled");
        (iconsTab as HTMLElement).style.pointerEvents = "none";
      } else {
        iconsTab.classList.remove("tab_borderless_disabled");
        iconsTab.classList.add("tab_borderless");
        (iconsTab as HTMLElement).style.pointerEvents = "auto";
      }
    }
  } else if (tabType === "outdated") {
    if (outdatedTab) {
      outdatedTab.textContent = `Outdated (${outdatedCount})`;
      // Блокируем вкладку если 0 элементов
      if (outdatedCount === 0) {
        outdatedTab.classList.remove("tab_borderless");
        outdatedTab.classList.add("tab_borderless_disabled");
        (outdatedTab as HTMLElement).style.pointerEvents = "none";
      } else {
        outdatedTab.classList.remove("tab_borderless_disabled");
        outdatedTab.classList.add("tab_borderless");
        (outdatedTab as HTMLElement).style.pointerEvents = "auto";
      }
    }
  } else if (tabType === "lost") {
    if (lostTab) {
      lostTab.textContent = `Lost (${lostCount})`;
      // Блокируем вкладку если 0 элементов
      if (lostCount === 0) {
        lostTab.classList.remove("tab_borderless");
        lostTab.classList.add("tab_borderless_disabled");
        (lostTab as HTMLElement).style.pointerEvents = "none";
      } else {
        lostTab.classList.remove("tab_borderless_disabled");
        lostTab.classList.add("tab_borderless");
        (lostTab as HTMLElement).style.pointerEvents = "auto";
      }
    }
  } else if (tabType === "deprecated") {
    if (deprecatedTab) {
      deprecatedTab.textContent = `Deprecated (${deprecatedCount})`;
      // Блокируем вкладку если 0 элементов
      if (deprecatedCount === 0) {
        deprecatedTab.classList.remove("tab_borderless");
        deprecatedTab.classList.add("tab_borderless_disabled");
        (deprecatedTab as HTMLElement).style.pointerEvents = "none";
      } else {
        deprecatedTab.classList.remove("tab_borderless_disabled");
        deprecatedTab.classList.add("tab_borderless");
        (deprecatedTab as HTMLElement).style.pointerEvents = "auto";
      }
    }
  } else if (tabType === "detached") {
    const detachedTab = document.querySelector('[data-tab="detached"]');
    if (detachedTab) {
      detachedTab.textContent = `Detached (${detachedCount})`;
      // Блокируем вкладку если 0 элементов
      if (detachedCount === 0) {
        detachedTab.classList.remove("tab_borderless");
        detachedTab.classList.add("tab_borderless_disabled");
        (detachedTab as HTMLElement).style.pointerEvents = "none";
      } else {
        detachedTab.classList.remove("tab_borderless_disabled");
        detachedTab.classList.add("tab_borderless");
        (detachedTab as HTMLElement).style.pointerEvents = "auto";
      }
    }
  }

  // Передаём сгруппированные и отсортированные данные в модуль рендера

  if (
    tabType === "outdated" ||
    tabType === "lost" ||
    tabType === "deprecated" ||
    tabType === "detached"
  ) {
    // Для специальных вкладок показываем всё в одном списке (resultsList)
    displayGroups(sortGroups(groupedInstances), resultsList, tabType);
    if (iconResultsList) {
      iconResultsList.innerHTML = ""; // Очищаем список иконок для специальных вкладок
    }
  } else {
    // Для обычных вкладок показываем и компоненты, и иконки
    displayGroups(sortGroups(groupedInstances), resultsList, tabType);
    if (iconResultsList) {
      displayGroups(sortGroups(groupedIcons), iconResultsList, tabType);
    }
  }
}

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).UIModules = (window as unknown as Record<string, unknown>).UIModules || {};
  ((window as unknown as Record<string, unknown>).UIModules as Record<string, unknown>).processAndDisplayComponents =
    processAndDisplayComponents;
}
