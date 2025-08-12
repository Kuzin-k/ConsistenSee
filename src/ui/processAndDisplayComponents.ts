import { displayGroups } from './displayGroups.js';
import { sortGroups } from './sortGroups.js';

/**
 * Обрабатывает и отображает компоненты, разделяя их на обычные и иконки
 * @param componentsData - Данные компонентов
 * @param allInstances - Глобальная переменная для хранения всех инстансов
 * @param resultsList - DOM элемент для отображения обычных компонентов
 * @param iconResultsList - DOM элемент для отображения иконок
 */
export function processAndDisplayComponents(
    componentsData: any,
    allInstances: any[],
    resultsList: HTMLElement,
    iconResultsList: HTMLElement
): void {
    allInstances = componentsData.instances;
    const groupedInstances: Record<string, any[]> = {};
    const groupedIcons: Record<string, any[]> = {};

    const showHiddenToggle = document.getElementById('showHiddenToggle') as HTMLInputElement;
    const showHidden = showHiddenToggle ? showHiddenToggle.checked : true;

    let nonIconCount = 0;
    let iconCount = 0;
    let outdatedCount = componentsData.counts && typeof componentsData.counts.outdated === 'number' 
        ? componentsData.counts.outdated 
        : (componentsData.outdated ? componentsData.outdated.length : 0);

    componentsData.instances.forEach((instance: any) => {
        if (!showHidden && instance.hidden) {
            return; // Пропускаем скрытые элементы, если toggle выключен
        }

        const groupKey = instance.mainComponentSetKey ? instance.mainComponentSetKey : instance.mainComponentKey;
        
        if (instance.isIcon === true) {
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

    // Sort items within each group alphabetically by their instance name
    for (const key in groupedInstances) {
        groupedInstances[key].sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });
    }

    for (const key in groupedIcons) {
        groupedIcons[key].sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });
    }

    // Обновляем заголовки вкладок
    const componentsTab = document.querySelector('[data-tab="instances"]');
    const iconsTab = document.querySelector('[data-tab="icons"]');
    const outdatedTab = document.querySelector('[data-tab="outdated"]');

    if (componentsTab) componentsTab.textContent = `All instances (${nonIconCount})`;
    if (iconsTab) iconsTab.textContent = `Icons (${iconCount})`;
    if (outdatedTab) outdatedTab.textContent = `Outdated (${outdatedCount})`;

    // Используем функцию сортировки из отдельного модуля
    displayGroups(sortGroups(groupedInstances), resultsList);
    displayGroups(sortGroups(groupedIcons), iconResultsList);
} 