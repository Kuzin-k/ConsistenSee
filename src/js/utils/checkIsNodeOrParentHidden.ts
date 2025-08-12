import { SceneNode } from '../../shared/types';

/**
 * Проверяет, скрыт ли узел или любой из его родителей.
 * @param {SceneNode} node - Узел для проверки.
 * @returns {boolean} `true` если узел или любой из родителей скрыт, иначе `false`.
 */
export const checkIsNodeOrParentHidden = (node: SceneNode): boolean => {
  let currentNode: SceneNode | null = node;
  // Поднимаемся по иерархии родителей
  while (currentNode) {
    // Если текущий узел скрыт (visible === false), возвращаем true
    if (currentNode.visible === false) {return true;}
    currentNode = currentNode.parent as SceneNode | null; // Переходим к родительскому узлу
  }
  // Если ни один из узлов в цепочке не скрыт, возвращаем false
  return false;
};