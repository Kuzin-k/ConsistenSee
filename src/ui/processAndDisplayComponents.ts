/**
 * Модуль для обработки и отображения компонентов с разделением на категории
 * @module processAndDisplayComponents
 */

import { displayGroups } from './displayGroups';
import { sortGroups } from './sortGroups';

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
 * @param tabType - Тип вкладки: 'instances' | 'icons' | 'outdated'
 * 
 * Функционал:
 * - Разделяет компоненты на обычные и иконки
 * - Группирует компоненты по их ключам
 * - Учитывает настройку отображения скрытых компонентов
 * - Ведёт подсчёт количества разных типов компонентов
 * - Для вкладки 'outdated' показывает только компоненты с checkVersion = 'Outdated'
 */
/**
 * processAndDisplayComponents
 * ---------------------------
 *
 * Назначение:
 *  - Получает сырые данные о найденных инстансах/узлах (componentsData),
 *    группирует их по ключу главного компонента или набора компонентов,
 *    разделяет иконки и обычные инстансы, сортирует элементы внутри групп
 *    и передаёт результат в `displayGroups` для рендера.
 *
 * Контракт (inputs / outputs):
 *  - inputs:
 *      - componentsData: {
 *          instances: Array<any> - массив объектов-инстансов (см. ComponentInstance в displayGroups.ts),
 *          counts?: { outdated?: number },
 *          outdated?: any[]
 *        }
 *      - allInstances: any[] - (mutируется здесь) ссылка на глобальный массив всех инстансов
 *      - resultsList: HTMLElement - контейнер (обычно <ul>) для обычных компонентов
 *      - iconResultsList: HTMLElement - контейнер для иконок
 *      - tabType: string - тип вкладки ('instances' | 'icons' | 'outdated')
 *  - outputs: визуально обновляет DOM через `displayGroups` и обновляет табы с числами
 *
 * Поведение и важные моменты:
 *  - Функция НЕ возвращает значение, она выполняет побочные эффекты в DOM.
 *  - Перед рендером разделяет элементы на две коллекции: `groupedInstances` и `groupedIcons`.
 *  - Группировка ключей основана на `mainComponentSetKey` (если есть) или `mainComponentKey`.
 *  - Если пользователь отключил показ скрытых элементов (toggle `showHiddenToggle`),
 *    скрытые инстансы пропускаются при формировании групп.
 *  - Для вкладки 'outdated' фильтрует только компоненты с checkVersion = 'Outdated'.
 *
 * Ошибки/пограничные случаи:
 *  - Если `componentsData.instances` отсутствует или не массив — функция может выбросить ошибку;
 *    вызывающий код должен гарантировать корректную структуру входных данных.
 *  - Если DOM-элементы `resultsList` или `iconResultsList` не переданы — `displayGroups` может логировать ошибки;
 *    рекомендуется вызывать с валидными HTMLElement.
 *  - При отсутствии `componentsData.counts.outdated` счёт устаревших элементов берётся из `componentsData.outdated.length`.
 *
 * Оптимизация и UX:
 *  - Элементы внутри каждой группы сортируются по имени (локалезированное сравнение).
 *  - После подготовки групп вызываются `sortGroups` (модуль сортировки) и `displayGroups`.
 *
 */
export function processAndDisplayComponents(
    componentsData: any,
    allInstances: any[],
    resultsList: HTMLElement,
    iconResultsList?: HTMLElement,
    tabType: string = 'instances'
): void {
    // Определяем источник данных в зависимости от типа вкладки
    let sourceInstances: any[];
    if (tabType === 'outdated') {
        // Для вкладки outdated используем outdated массив или фильтруем instances по checkVersion
        if (componentsData.outdated && componentsData.outdated.length > 0) {
            sourceInstances = componentsData.outdated;
        } else {
            // Фильтруем instances по checkVersion = 'Outdated'
            sourceInstances = componentsData.instances.filter((instance: any) => 
                instance.checkVersion === 'Outdated'
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
    const showHiddenToggle = document.getElementById('showHiddenToggle') as HTMLInputElement;
    // Если переключателя нет в DOM, по умолчанию показываем скрытые
    const showHidden = showHiddenToggle ? showHiddenToggle.checked : true;

    // Счётчики для UI (тексты вкладок)
    let nonIconCount = 0;
    let iconCount = 0;
    let outdatedCount = componentsData.counts && typeof componentsData.counts.outdated === 'number'
        ? componentsData.counts.outdated
        : (componentsData.outdated ? componentsData.outdated.length : 0);

    // Проходим по всем инстансам и распределяем их в соответствующие группы
    // - Пропускаем скрытые элементы, если пользователь отключил их показ
    // - Определяем ключ группы: сперва mainComponentSetKey, затем mainComponentKey
    sourceInstances.forEach((instance: any) => {
        if (!showHidden && instance.hidden) {
            return; // Пропускаем скрытые элементы
        }

        // Для вкладки outdated дополнительно проверяем checkVersion
        if (tabType === 'outdated' && instance.checkVersion !== 'Outdated') {
            return;}

        const groupKey = instance.mainComponentSetKey ? instance.mainComponentSetKey : instance.mainComponentKey;

        if (tabType === 'outdated') {
            // Для outdated не разделяем на иконки и обычные, показываем все в одном списке
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
        if (!v || typeof v !== 'string') return null;
        // Убираем префикс 'v' и хвосты вроде '(minimal)' или '-beta'
        const m = v.trim().replace(/^v\s*/i, '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
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

        const aName = (a.name || '').toString();
        const bName = (b.name || '').toString();
        return aName.localeCompare(bName);
    };

    // Для outdated используем простую сортировку по имени
    const compareByName = (a: any, b: any): number => {
        const aName = a.name || '';
        const bName = b.name || '';
        return aName.localeCompare(bName);
    };

    // Сортируем элементы внутри каждой группы
    const sortFunction = tabType === 'outdated' ? compareByName : compareByVersionThenName;
    
    for (const key in groupedInstances) {groupedInstances[key].sort(sortFunction);}
    for (const key in groupedIcons) {groupedIcons[key].sort(sortFunction);}

    // Обновляем тексты вкладок с количеством
    const componentsTab = document.querySelector('[data-tab="instances"]');
    const iconsTab = document.querySelector('[data-tab="icons"]');
    const outdatedTab = document.querySelector('[data-tab="outdated"]');

    if (componentsTab) componentsTab.textContent = `All instances (${nonIconCount})`;
    if (iconsTab) iconsTab.textContent = `Icons (${iconCount})`;
    if (outdatedTab) outdatedTab.textContent = `Outdated (${outdatedCount})`;

    // Передаём сгруппированные и отсортированные данные в модуль рендера
    const isOutdatedTab = tabType === 'outdated';
    
    if (tabType === 'outdated') {
        // Для outdated показываем всё в одном списке (resultsList)
        displayGroups(sortGroups(groupedInstances), resultsList, isOutdatedTab);
        if (iconResultsList) {
            iconResultsList.innerHTML = ''; // Очищаем список иконок для outdated
        }
    } else {
        // Для обычных вкладок показываем и компоненты, и иконки
        displayGroups(sortGroups(groupedInstances), resultsList, isOutdatedTab);
        if (iconResultsList) {
            displayGroups(sortGroups(groupedIcons), iconResultsList, isOutdatedTab);
        }
    }
}

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.processAndDisplayComponents = processAndDisplayComponents;
}