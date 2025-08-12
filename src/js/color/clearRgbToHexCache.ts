/**
 * Кэш для преобразования цветов из RGB в HEX.
 * @internal
 */
export const rgbToHexCache = new Map<string, string>();

/**
 * Очищает кэш преобразования цветов RGB в HEX.
 */
export const clearRgbToHexCache = (): void => {
  rgbToHexCache.clear();
};