import { displayColorsTab, GroupedData } from './displayColorsTab';

/**
 * Обрабатывает и отображает цвета (fill и stroke)
 * @param colorsData - Данные цветов заливки
 * @param colorsStrokeData - Данные цветов обводки
 */
export function processAndDisplayColors(
    colorsData: Record<string, unknown>,
    colorsStrokeData: Record<string, unknown>
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
        const groupedFillColors: Record<string, Record<string, unknown>[]> = {};
        let rawFillInstances = colorsData.instances as Record<string, unknown>[];

        if (!showHidden) {
            rawFillInstances = rawFillInstances.filter((instance: Record<string, unknown>) => !instance.hidden);
        }

        rawFillInstances.forEach((instance: Record<string, unknown>) => {
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
        const sortedGroupedFillColors: Record<string, Record<string, unknown>[]> = {};
        sortedFillGroupKeys.forEach(key => {
            sortedGroupedFillColors[key] = groupedFillColors[key];
        });
        if (fillFilteredCount > 0) {
            displayColorsTab(sortedGroupedFillColors as unknown as GroupedData, colorResultsList);
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
        const groupedStrokeColors: Record<string, Record<string, unknown>[]> = {};
        let rawStrokeInstances = colorsStrokeData.instances as Record<string, unknown>[];

        if (!showHidden) {
            rawStrokeInstances = rawStrokeInstances.filter((instance: Record<string, unknown>) => !instance.hidden);
        }

        rawStrokeInstances.forEach((instance: Record<string, unknown>) => {
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
        const sortedGroupedStrokeColors: Record<string, Record<string, unknown>[]> = {};
        sortedStrokeGroupKeys.forEach(key => {
            sortedGroupedStrokeColors[key] = groupedStrokeColors[key];
        });

        if (strokeFilteredCount > 0) {
            displayColorsTab(sortedGroupedStrokeColors as unknown as GroupedData, colorStrokeResultsList);
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
            colorsTab.classList.remove('colors');
      colorsTab.classList.add('disabled');
            colorsTab.textContent = `Colors (0)`;
            (colorsTab as HTMLElement).style.pointerEvents = 'none';
        } else {
            colorsTab.classList.remove('disabled');
      colorsTab.classList.add('colors');
            colorsTab.textContent = `Colors (${totalColorIssues})`;
            (colorsTab as HTMLElement).style.pointerEvents = 'auto';
        }
    }

    // Обновляем заголовок errorsTab после обновления colors
    if (typeof window !== 'undefined' && (window as any).UIModules?.updateErrorsTabHeader) {
        (window as any).UIModules.updateErrorsTabHeader();
    }
}

// В конце файла добавить:
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).UIModules = (window as unknown as Record<string, unknown>).UIModules || {};
  ((window as unknown as Record<string, unknown>).UIModules as Record<string, unknown>).processAndDisplayColors = processAndDisplayColors;
}