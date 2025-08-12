import { SceneNode, NodeStatistics } from '../../shared/types';

/**
 * Обрабатывает статистику узлов по типам, рекурсивно обходя всех потомков.
 *
 * @export
 * @param {(SceneNode | SceneNode[])} nodes - Узел или массив узлов для анализа.
 * @param {string} [nodeName='Unnamed Selection'] - Имя для группы узлов (опционально).
 * @returns {NodeStatistics} Объект со статистикой по типам узлов.
 */
export const processNodeStatistics = (nodes: SceneNode | SceneNode[], nodeName: string = 'Unnamed Selection'): NodeStatistics => {
  const typeStats: Record<string, number> = {};
  let totalCount = 0;
  const processedNodes = new Set<string>(); // Keep track of processed nodes to avoid duplicates

  // Функция для рекурсивного подсчета узлов
  const countNodeTypes = (currentNode: SceneNode) => {
    if (!currentNode || processedNodes.has(currentNode.id)) {
      return;
    }

    processedNodes.add(currentNode.id); // Mark node as processed

    // Подсчитываем текущий узел
    typeStats[currentNode.type] = (typeStats[currentNode.type] || 0) + 1;
    totalCount++;

    // Process children for all node types that have them
    if ('children' in currentNode) {
      (currentNode.children as SceneNode[]).forEach((child) => countNodeTypes(child));
    }
  };

  // Обрабатываем один узел или массив узлов
  if (Array.isArray(nodes)) {
    nodes.forEach((node) => countNodeTypes(node));
  } else {
    countNodeTypes(nodes);
  }

  return {
    nodeTypeCounts: typeStats,
    totalNodes: totalCount,
    nodeName: nodeName,
  };
};