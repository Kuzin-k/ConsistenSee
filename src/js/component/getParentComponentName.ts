import { SceneNode } from '../../shared/types';
import { retryGetMainComponent } from '../utils/retryWithBackoff';

/**
 * Асинхронно находит имя родительского компонента для указанного узла.
 * Поднимается по иерархии родителей, пока не найдет родителя типа INSTANCE,
 * затем получает имя его главного компонента или набора компонентов.
 * @param node Узел, для которого ищется родительский компонент.
 * @returns Promise, который разрешается именем родительского компонента или null, если он не найден.
 */
export const getParentComponentName = async (node: SceneNode): Promise<string | null> => {
  let parentNode = node.parent;
  while (parentNode) {
    if (parentNode.type === 'INSTANCE') {
      try {
        const parentMainComponent = await retryGetMainComponent(parentNode as any, parentNode.name);
        if (parentMainComponent) {
          if (parentMainComponent.parent && parentMainComponent.parent.type === 'COMPONENT_SET') {
            return parentMainComponent.parent.name;
          }
          return parentMainComponent.name;
        }
      } catch (error) {
        console.error(`Ошибка при получении mainComponent для родителя ${parentNode.name} после повторных попыток:`, error);
      }
      return null;
    }
    parentNode = parentNode.parent;
  }
  return null;
};