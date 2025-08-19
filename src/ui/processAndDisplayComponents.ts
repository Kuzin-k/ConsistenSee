/**
 * Модуль для обработки и отображения компонентов с разделением на категории
 * @module processAndDisplayComponents
 */

import { displayGroups } from "./displayGroups";
import { sortGroups } from "./sortGroups";

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
 * @param tabType - Тип вкладки: 'instances' | 'icons' | 'outdated' | 'lost'
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
  componentsData: any,
  allInstances: any[],
  resultsList: HTMLElement,
  iconResultsList?: HTMLElement,
  tabType: string = "instances"
): void {
  // Определяем источник данных в зависимости от типа вкладки
  let sourceInstances: any[];
  if (tabType === "outdated") {
    // Для вкладки outdated используем outdated массив или фильтруем instances по checkVersion
    if (componentsData.outdated && componentsData.outdated.length > 0) {
      sourceInstances = componentsData.outdated;
    } else {
      // Фильтруем instances по checkVersion = 'Outdated'
      sourceInstances = componentsData.instances.filter(
        (instance: any) => instance.checkVersion === "Outdated"
      );
    }
  } else if (tabType === "lost") {
    // Для вкладки lost используем lost массив или фильтруем instances по isLost
    if (componentsData.lost && componentsData.lost.length > 0) {
      sourceInstances = componentsData.lost;
    } else {
      sourceInstances = componentsData.instances.filter(
        (instance: any) => instance.isLost === true
      );
    }
  } else {
    sourceInstances = componentsData.instances;
  }

  // Обновляем глобальную ссылку на все инстансы (если вызывающий код полагается на неё)
  allInstances = sourceInstances;

  // Словари групп: ключ -> массив инстансов
  const groupedInstances: Record<string, any[]> = {};
  const groupedIcons: Record<string, any[]> = {};

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

  // Проходим по всем инстансам и распределяем их в соответствующие группы
  // - Пропускаем скрытые элементы, если пользователь отключил их показ
  // - Определяем ключ группы: сперва mainComponentSetKey, затем mainComponentKey
  sourceInstances.forEach((instance: any) => {
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

    const groupKey = instance.mainComponentSetKey
      ? instance.mainComponentSetKey
      : instance.mainComponentKey;

    if (tabType === "outdated" || tabType === "lost") {
      // Для специальных вкладок не разделяем на иконки и обычные, показываем все в одном списке
      if (!groupedInstances[groupKey]) {
        groupedInstances[groupKey] = [];
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

  const compareByVersionThenName = (a: any, b: any): number => {
    // Используем исключительно nodeVersion из экземпляра
    const aVer = parseVersionNumbers(a.nodeVersion);
    const bVer = parseVersionNumbers(b.nodeVersion);

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
  const compareByName = (a: any, b: any): number => {
    const aName = a.name || "";
    const bName = b.name || "";
    return aName.localeCompare(bName);
  };

  // Сортируем элементы внутри каждой группы
  const sortFunction =
    tabType === "outdated" || tabType === "lost"
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

  // Обновляем тексты вкладок с количеством
  const componentsTab = document.querySelector('[data-tab="instances"]');
  const iconsTab = document.querySelector('[data-tab="icons"]');
  const outdatedTab = document.querySelector('[data-tab="outdated"]');
  const lostTab = document.querySelector('[data-tab="lost"]');

  // Обновляем только соответствующие вкладки для текущего типа
  if (tabType === "instances") {
    if (componentsTab)
      componentsTab.textContent = `All instances (${nonIconCount})`;
    if (iconsTab) iconsTab.textContent = `Icons (${iconCount})`;
  } else if (tabType === "outdated") {
    if (outdatedTab) outdatedTab.textContent = `Outdated (${outdatedCount})`;
  } else if (tabType === "lost") {
    if (lostTab) lostTab.textContent = `Lost (${lostCount})`;
  }

  // Передаём сгруппированные и отсортированные данные в модуль рендера
  const tabTitle = tabType === "outdated" || tabType === "lost";

  if (tabType === "outdated" || tabType === "lost") {
    // Для специальных вкладок показываем всё в одном списке (resultsList)
    displayGroups(sortGroups(groupedInstances), resultsList, tabTitle);
    if (iconResultsList) {
      iconResultsList.innerHTML = ""; // Очищаем список иконок для специальных вкладок
    }
  } else {
    // Для обычных вкладок показываем и компоненты, и иконки
    displayGroups(sortGroups(groupedInstances), resultsList, false);
    if (iconResultsList) {
      displayGroups(sortGroups(groupedIcons), iconResultsList, false);
    }
  }
}

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== "undefined") {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.processAndDisplayComponents =
    processAndDisplayComponents;
}
