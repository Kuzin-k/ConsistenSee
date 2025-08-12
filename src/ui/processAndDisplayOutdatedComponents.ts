import { displayGroups } from './displayGroups';
import { sortGroups } from './sortGroups.js';

/**
 * Обрабатывает и отображает устаревшие компоненты
 * @param componentsData - Данные компонентов с устаревшими элементами
 * @param outdatedResultsList - DOM элемент для отображения устаревших компонентов
 */
export function processAndDisplayOutdatedComponents(
    componentsData: any,
    outdatedResultsList: HTMLElement
): void {
    // Эта функция будет очень похожа на processAndDisplayComponents,
    // но будет работать с componentsData.outdated и отображать их в outdatedResultsList
    const outdatedInstancesArray = componentsData.outdated || [];
    const groupedOutdatedInstances: Record<string, any[]> = {};

    const showHiddenToggle = document.getElementById('showHiddenToggle') as HTMLInputElement;
    const showHidden = showHiddenToggle ? showHiddenToggle.checked : true;
    let outdatedCount = 0;

    // Filter instances based on the showHidden toggle state
    const filteredOutdatedInstances = showHidden 
        ? outdatedInstancesArray 
        : outdatedInstancesArray.filter((instance: any) => !instance.hidden);

    filteredOutdatedInstances.forEach((instance: any) => {
        if (!showHidden && instance.hidden) {
            return; 
        }
        // Для устаревших не будем делить на иконки и не иконки, просто группируем все
        const groupKey = instance.mainComponentSetKey ? instance.mainComponentSetKey : instance.mainComponentKey;
        if (!groupedOutdatedInstances[groupKey]) {
            groupedOutdatedInstances[groupKey] = [];
        }
        groupedOutdatedInstances[groupKey].push(instance);
        // outdatedCount will be set later based on filteredOutdatedInstances.length
    });

    // Считаем количество после фильтрации
    outdatedCount = filteredOutdatedInstances.length;

    for (const key in groupedOutdatedInstances) {
        groupedOutdatedInstances[key].sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });
    }

    const outdatedTab = document.querySelector('[data-tab="outdated"]');
    if (outdatedTab) outdatedTab.textContent = `Outdated (${outdatedCount})`;

    // Используем функцию сортировки групп из отдельного модуля
    displayGroups(sortGroups(groupedOutdatedInstances), outdatedResultsList);
}

// В конце файла добавить:
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.processAndDisplayOutdatedComponents = processAndDisplayOutdatedComponents;
}