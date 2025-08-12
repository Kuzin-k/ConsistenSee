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

    const parent = component.parent;
    if (parent && parent.type === 'COMPONENT_SET' && parent.key) {
      const componentNameInSet = component.name || 'unnamed_variant';
      return `set_${parent.key}_variant_${componentNameInSet}`;
    }

    return component.key;
  } catch (error) {
    console.error('Error in getComponentCacheKey:', error);
    return `error_processing_component_${component.id || 'no_id'}`;
  }
};