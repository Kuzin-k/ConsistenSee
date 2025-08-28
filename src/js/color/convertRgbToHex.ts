import { rgbToHexCache } from './clearRgbToHexCache';
/**
 * Преобразует RGB цвет (компоненты 0-1) в HEX формат (#RRGGBB)
 * Обрабатывает особые случаи:
 * - figma.mixed значения (возвращает #000000)
 * - Некорректные значения (возвращает #000000)
 * - Масштабирование из диапазона 0-1 в 0-255
 * @param {Object} color - Объект с компонентами цвета
 * @param {number} color.r - Красный компонент (0-1)
 * @param {number} color.g - Зеленый компонент (0-1)
 * @param {number} color.b - Синий компонент (0-1)
 * @returns {string} Цвет в формате HEX (#RRGGBB)
 */
export const convertRgbToHex = ({ r, g, b }: { r: number; g: number; b: number }): string => {
  // Проверяем, что все значения определены, являются числами и не являются figma.mixed
  if (r === undefined || g === undefined || b === undefined ||
    typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' || // Проверка на тип number
    // @ts-expect-error: figma.mixed может быть символом, а не числом, поэтому прямое сравнение может быть нежелательным.
    r === figma.mixed || g === figma.mixed || b === figma.mixed
  ) {
    return '#MIXED'; // Возвращаем специальное значение для смешанных или некорректных данных
  }

  try {
    // Ограничиваем значения r, g, b диапазоном [0, 1]
    const rClamped = Math.max(0, Math.min(1, r));
    const gClamped = Math.max(0, Math.min(1, g));
    const bClamped = Math.max(0, Math.min(1, b));

    // Масштабируем и округляем значения
    const rInt = Math.round(rClamped * 255);
    const gInt = Math.round(gClamped * 255);
    const bInt = Math.round(bClamped * 255);

    // Формируем ключ для кэша на основе целочисленных значений
    const key: string = `${rInt}-${gInt}-${bInt}`;
    const cachedHex: string | undefined = rgbToHexCache.get(key);
    if (cachedHex) {
      return cachedHex;
    }

    // Вспомогательная функция для конвертации компонента (0-1) в 16-ричную строку (00-FF)
    // Принимает уже масштабированное и округленное значение (0-255)
    const toHexComponent = (n_int: number): string => {
      const hex = n_int.toString(16); // Конвертируем в 16-ричную строку
      return hex.length === 1 ? '0' + hex : hex; // Добавляем ведущий ноль, если нужно
    };

    // Формируем HEX строку
    const hex: string = `#${toHexComponent(rInt)}${toHexComponent(gInt)}${toHexComponent(bInt)}`;
    rgbToHexCache.set(key, hex);
    return hex;
  } catch (error) {
    // Обработка ошибок в процессе конвертации
    console.error('Ошибка при конвертации RGB в HEX:', { r, g, b, error });
    return '#ERROR'; // Возвращаем специальное значение в случае непредвиденной ошибки
  }
};
