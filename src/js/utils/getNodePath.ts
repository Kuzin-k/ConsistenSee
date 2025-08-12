import { SceneNode } from '../../shared/types';

/**
 * Получает полный путь к узлу через всех его родителей.
 * Формирует строку из ID всех родительских узлов, разделенных запятыми.
 *
 * @param {SceneNode} node - Узел для получения пути.
 * @returns {string} Строка пути, состоящая из ID узлов.
 */
export const getNodePath = (node: SceneNode): string => {
  const path: string[] = [];
  let current: SceneNode | null = node;

  while (current && current.parent) {
    path.unshift(current.id);
    current = current.parent as SceneNode | null;
  }

  return path.join(',');
};