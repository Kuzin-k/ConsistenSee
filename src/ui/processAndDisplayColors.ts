import { displayColorsTab } from './displayColorsTab';

/**
 * Обрабатывает и отображает цвета (fill и stroke)
 * @param colorsData - Данные цветов заливки
 * @param colorsStrokeData - Данные цветов обводки
 */
export function processAndDisplayColors(
    colorsData: any,
    colorsStrokeData: any
): void {
    const showHiddenToggle = document.getElementById('showHiddenToggle') as HTMLInputElement;
    const showHidden = showHiddenToggle ? showHiddenToggle.checked : true;
    let fillFilteredCount = 0;
    let strokeFilteredCount = 0;

    const colorResultsList = document.getElementById('colorResultsList') as HTMLElement;
    const colorStrokeResultsList = document.getElementById('colorStrokeResultsList') as HTMLElement;

    const fillHeader = colorResultsList.previousElementSibling;
    const strokeHeader = colorStrokeResultsList.previousElementSibling;

    colorResultsList.innerHTML = '';
    colorStrokeResultsList.innerHTML = '';

    // Process Fill Colors
    if (colorsData && colorsData.instances) {
        const groupedFillColors: Record<string, any[]> = {};
        let rawFillInstances = colorsData.instances;

        if (!showHidden) {
            rawFillInstances = rawFillInstances.filter((instance: any) => !instance.hidden);
        }

        rawFillInstances.forEach((instance: any) => {
            const hasFill = instance.fill && instance.fill !== '#MIXED';
            if (!hasFill) return;

            const wrongFill = instance.fill_collection_name !== "Component tokens" &&
                              instance.fill_collection_name !== "Service tokens" &&
                              instance.fill_collection_name !== "product colors";
            if (!wrongFill) return;

            fillFilteredCount++;

            const cleanInstance = { ...instance }; // Create a shallow copy
            delete cleanInstance.stroke;
            delete cleanInstance.stroke_variable_name;
            delete cleanInstance.stroke_collection_name;
            delete cleanInstance.stroke_collection_id;
            
            // Формируем ключ группы, учитывая имя цвета/переменной и имя коллекции
            const colorIdentifier = cleanInstance.fill_variable_name ? cleanInstance.fill_variable_name : cleanInstance.fill;
            const collectionName = cleanInstance.fill_collection_name || 'no_collection'; // Используем 'no_collection' если имя коллекции отсутствует
            const groupKey = `${colorIdentifier}-${collectionName}-${cleanInstance.type}`;
            
            if (!groupedFillColors[groupKey]) { groupedFillColors[groupKey] = []; }
            groupedFillColors[groupKey].push(cleanInstance);
        });

        const sortedFillGroupKeys = Object.keys(groupedFillColors).sort((a, b) => a.localeCompare(b));
        const sortedGroupedFillColors: Record<string, any[]> = {};
        sortedFillGroupKeys.forEach(key => {
            sortedGroupedFillColors[key] = groupedFillColors[key];
        });
        if (fillFilteredCount > 0) {
            displayColorsTab(sortedGroupedFillColors, colorResultsList);
        } else {
            colorResultsList.innerHTML = '';
            if (fillHeader && fillHeader.classList.contains('section-header') && fillHeader.textContent === 'Fill') {
                fillHeader.remove();
            }
        }
    } else {
        colorResultsList.innerHTML = '';
         if (fillHeader && fillHeader.classList.contains('section-header') && fillHeader.textContent === 'Fill') {
            fillHeader.remove();
        }
    }

    // Process Stroke Colors
    if (colorsStrokeData && colorsStrokeData.instances) {
        const groupedStrokeColors: Record<string, any[]> = {};
        let rawStrokeInstances = colorsStrokeData.instances;

        if (!showHidden) {
            rawStrokeInstances = rawStrokeInstances.filter((instance: any) => !instance.hidden);
        }

        rawStrokeInstances.forEach((instance: any) => {
            const hasStroke = instance.stroke && instance.stroke !== '#MIXED';
            if (!hasStroke) return;

            const wrongStroke = instance.stroke_collection_name !== "Component tokens" &&
                                instance.stroke_collection_name !== "Service tokens" &&
                                instance.stroke_collection_name !== "product colors";
            if (!wrongStroke) return;

            strokeFilteredCount++;
            
            const cleanInstance = { ...instance }; // Create a shallow copy
            delete cleanInstance.fill;
            delete cleanInstance.fill_variable_name;
            delete cleanInstance.fill_collection_name;
            delete cleanInstance.fill_collection_id;

            // Формируем ключ группы, учитывая имя цвета/переменной и имя коллекции
            const colorIdentifier = cleanInstance.stroke_variable_name ? cleanInstance.stroke_variable_name : cleanInstance.stroke;
            const collectionName = cleanInstance.stroke_collection_name || 'no_collection'; // Используем 'no_collection' если имя коллекции отсутствует
            const groupKey = `${colorIdentifier}-${collectionName}-${cleanInstance.type}`;

            if (!groupedStrokeColors[groupKey]) { groupedStrokeColors[groupKey] = []; }
            groupedStrokeColors[groupKey].push(cleanInstance);
        });

        const sortedStrokeGroupKeys = Object.keys(groupedStrokeColors).sort((a, b) => a.localeCompare(b));
        const sortedGroupedStrokeColors: Record<string, any[]> = {};
        sortedStrokeGroupKeys.forEach(key => {
            sortedGroupedStrokeColors[key] = groupedStrokeColors[key];
        });

        if (strokeFilteredCount > 0) {
            displayColorsTab(sortedGroupedStrokeColors, colorStrokeResultsList);
        } else {
            colorStrokeResultsList.innerHTML = '';
            if (strokeHeader && strokeHeader.classList.contains('section-header') && strokeHeader.textContent === 'Stroke') {
                strokeHeader.remove();
            }
        }
    } else {
        colorStrokeResultsList.innerHTML = '';
        if (strokeHeader && strokeHeader.classList.contains('section-header') && strokeHeader.textContent === 'Stroke') {
            strokeHeader.remove();
        }
    }

    // Update Colors Tab Header
    const colorsTab = document.querySelector('[data-tab="colors"]');
    const totalColorIssues = fillFilteredCount + strokeFilteredCount;
    if (colorsTab) { // Ensure colorsTab exists
        if (totalColorIssues === 0) {
            colorsTab.classList.remove('tab');
            colorsTab.classList.add('tab_success');
            colorsTab.textContent = `Colors (OK)`;
        } else {
            colorsTab.classList.remove('tab_success');
            colorsTab.classList.add('tab');
            colorsTab.textContent = `Colors (${totalColorIssues})`;
        }
    }
}

// В конце файла добавить:
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.processAndDisplayColors = processAndDisplayColors;
}