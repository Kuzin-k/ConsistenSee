import { ComponentNode } from '../../shared/types';

/**
 * Получает уникальный ключ кэширования для компонента.
 *
 * @param component Компонент для получения ключа.
 * @returns Уникальный строковый ключ для кэширования.
 */
export const getComponentCacheKey = (component: ComponentNode): string => {
  if (!component) {
    return 'unknown_component_no_id';
  }

  try {
    if (!component.key) {
      return `local_component_${component.id || 'no_id'}`;
    }

    // Для всех компонентов (включая компоненты в наборах) используем только component.key
    // Это обеспечивает одинаковые ключи кэша для идентичных компонентов
    // независимо от их имен вариантов
    return component.key;
  } catch (error) {
    console.error('Error in getComponentCacheKey:', error);
    return `error_processing_component_${component.id || 'no_id'}`;
  }
};