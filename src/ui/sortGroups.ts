/**
 * Сортирует группы компонентов по имени
 * @param groups - Объект с группами компонентов
 * @returns Отсортированный объект с группами
 */
export function sortGroups(groups: Record<string, any[]>): Record<string, any[]> {
    return Object.fromEntries(
        Object.entries(groups).sort(([, groupAItems], [, groupBItems]) => {
            const firstItemA = groupAItems[0];
            const firstItemB = groupBItems[0];
            
            // Извлекаем имя компонента, убираем эмодзи и специальные символы
            const aName = (firstItemA.mainComponentSetName || firstItemA.mainComponentName || firstItemA.name || '')
                .replace(/([\u0023-\u0039]\uFE0F?\u20E3|\u00A9|\u00AE|[\u2000-\u3300]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])/gu, '')
                .trim()
                .replace(/^[^a-zA-Z0-9\/]+/, '');
                
            const bName = (firstItemB.mainComponentSetName || firstItemB.mainComponentName || firstItemB.name || '')
                .replace(/([\u0023-\u0039]\uFE0F?\u20E3|\u00A9|\u00AE|[\u2000-\u3300]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])/gu, '')
                .trim()
                .replace(/^[^a-zA-Z0-9\/]+/, '');
            
            // Проверяем, начинается ли имя с точки или подчеркивания (специальные группы)
            const aSpecial = /^[._]/.test(aName);
            const bSpecial = /^[._]/.test(bName);
            
            // Специальные группы идут в конец
            if (aSpecial && !bSpecial) return 1;
            if (!aSpecial && bSpecial) return -1;
            
            // Обычная сортировка с учетом чисел и акцентов
            return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'accent' });
        })
    );
} 