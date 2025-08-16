/**
 * Сравнивает версии и возвращает статус по правилам:
 *  - Если передан versionMinimal:
 *      - если versionInstance < versionMinimal => "Outdated"
 *      - если versionInstance >= versionMinimal и versionInstance < versionLatest => "NotLatest"
 *      - если versionInstance >= versionLatest => "Latest"
 *  - Если versionMinimal не передан:
 *      - если versionInstance < versionLatest => "Outdated"
 *      - иначе => "Latest" (включая равенство)
 *
 * Поддерживает версии формата "X.Y.Z" и более длинные, игнорирует суффиксы
 * (например, "1.2.3-beta" будет интерпретирована как "1.2.3").
 *
 * @param versionInstance - версия инстанса (строка или null/undefined)
 * @param versionLatest - версия latest (строка или null/undefined)
 * @param versionMinimal - (опционально) минимально допустимая версия
 * @returns 'Outdated' | 'NotLatest' | 'Latest'
 */
export const compareVersions = (
    versionInstance: string | null | undefined,
    versionLatest: string | null | undefined,
    versionMinimal?: string | null | undefined
): 'Outdated' | 'NotLatest' | 'Latest' => {
    // Вспомогательная функция: извлечь числовую часть версии "X.Y.Z" из строки
    const extractNumeric = (v?: string | null) => {
        if (!v) return [] as number[];
        const m = String(v).match(/^(\d+(?:\.\d+)*)/);
        if (!m) return [] as number[];
        return m[1].split('.').map(s => Number(s));
    };

    const cmpParts = (a: number[], b: number[]) => {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const p1 = a[i] || 0;
            const p2 = b[i] || 0;
            if (p1 < p2) return -1;
            if (p1 > p2) return 1;
        }
        return 0;
    };

    // Быстрая обработка отсутствующих значений
    if (!versionLatest && !versionInstance) return 'Latest';
    if (!versionLatest) return 'Latest'; // нет информации о latest — считаем актуальным
    if (!versionInstance) return 'Outdated';

    const instParts = extractNumeric(versionInstance);
    const latestParts = extractNumeric(versionLatest);
    const minimalParts = versionMinimal ? extractNumeric(versionMinimal) : null;

    // Если передан minimal, проверяем его приоритет
    if (minimalParts) {
        const cmpToMinimal = cmpParts(instParts, minimalParts);
        if (cmpToMinimal < 0) return 'Outdated';
        const cmpToLatest = cmpParts(instParts, latestParts);
        if (cmpToLatest < 0) return 'NotLatest';
        return 'Latest';
    }

    // Без minimal — простая проверка относительно latest
    const cmp = cmpParts(instParts, latestParts);
    if (cmp < 0) return 'Outdated';
    return 'Latest';
};