/**
 * Сравнивает две строки версий (например, "1.2.3").
 * @param v1 - Первая строка версии.
 * @param v2 - Вторая строка версии.
 * @returns
 *  - Отрицательное число, если v1 < v2
 *  - 0, если v1 === v2
 *  - Положительное число, если v1 > v2
 */
export const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
};