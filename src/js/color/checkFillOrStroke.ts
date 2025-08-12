import { SceneNode, GeometryMixin } from '../../shared/types';

/**
 * Проверяет, есть ли у узла видимая сплошная заливка или обводка.
 * @public
 * @param {SceneNode} node - Узел для проверки.
 * @returns {boolean} `true`, если у узла есть заливка или обводка, иначе `false`.
 */
export const hasFillOrStroke = (node: SceneNode): boolean => {
  const fills = (node as GeometryMixin).fills;
  const strokes = (node as GeometryMixin).strokes;
  return (Array.isArray(fills) && fills.length > 0) || (Array.isArray(strokes) && strokes.length > 0);
};