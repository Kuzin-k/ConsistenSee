import { convertRgbToHex } from "./convertRgbToHex";
import { getParentComponentName } from '../component/getParentComponentName';
import { processVariableBindings } from './processVariableBindings';
import { checkIsNodeOrParentHidden } from '../utils/checkIsNodeOrParentHidden';
import { ColorData, ColorsResult, SceneNode, Paint, GeometryMixin } from '../../shared/types';

// Constants for special color values
const COLOR_MIXED = '#MIXED' as const;
const COLOR_ERROR = '#ERROR' as const;

// Интерфейс для узлов с boundVariables
interface NodeWithBoundVariables {
  boundVariables?: {
    fills?: unknown;
    strokes?: unknown;
    [key: string]: unknown;
  };
}

// Интерфейс для узлов с key
interface NodeWithKey {
  key?: string;
}

/**
 * Checks if a node has a parent with a specific name and type.
 * @param {SceneNode} targetNode The node to check.
 * @param {string} targetName The name of the parent to find.
 * @param {string} targetType The type of the parent to find.
 * @returns {boolean} True if such a parent is found, otherwise false.
 */
const hasParentWithNameAndType = (targetNode: SceneNode, targetName: string, targetType: string): boolean => {
  let current = targetNode.parent;
  while (current) {
    if (current.name && current.name.toLowerCase() === targetName.toLowerCase() && current.type === targetType) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

/**
 * Checks if a node should be excluded based on its color and parent.
 * @param {SceneNode} node The node to check.
 * @param {Partial<ColorData>} nodeData The node data.
 * @returns {boolean} True if the node should be excluded, otherwise false.
 */
const shouldExcludeNode = (node: SceneNode, nodeData: Partial<ColorData>): boolean => {
  const excludedColors: readonly string[] = ['#000000', '#ffffff', '#FFFFFF', '#ff33bb', COLOR_MIXED, COLOR_ERROR];
  const hasExcludedColor = (nodeData.fill && excludedColors.indexOf(nodeData.fill) !== -1) ||
                           (nodeData.stroke && excludedColors.indexOf(nodeData.stroke) !== -1);
  const isExcludedBySourceGroup = hasExcludedColor && hasParentWithNameAndType(node, 'source', 'GROUP');
  const isExcludedByGroupGroup = hasExcludedColor && hasParentWithNameAndType(node, 'group', 'GROUP');
  const isComponentSetBorder = nodeData.stroke === '#9747ff' && node.type === 'COMPONENT_SET';
  return isExcludedBySourceGroup || isExcludedByGroupGroup || isComponentSetBorder;
};

/**
 * Adds a result to the corresponding results object.
 * @param {Partial<ColorData>} nodeData The node data.
 * @param {'fill' | 'stroke'} type The type of result.
 * @param {ColorsResult} results The results object.
 */
const addResult = (nodeData: Partial<ColorData>, type: 'fill' | 'stroke', results: ColorsResult): void => {
  const colorValue = nodeData[type];
  if (colorValue && colorValue !== COLOR_MIXED && colorValue !== COLOR_ERROR) {
    const data: Partial<ColorData> = { ...nodeData };

    if (type === 'fill') {
      delete data.stroke;
      delete data.stroke_variable_name;
      delete data.stroke_collection_id;
      delete data.stroke_collection_name;
    } else { // type === 'stroke'
      delete data.fill;
      delete data.fill_variable_name;
      delete data.fill_collection_id;
      delete data.fill_collection_name;
    }

    if (Array.isArray(results.instances)) {
      results.instances.push(data as ColorData);
    } else {
      console.error(`results.instances is not an array:`, results.instances);
    }
  }
};

/**
 * Processes a specific paint type (fill or stroke) for a node.
 * @param {readonly Paint[]} paints The array of paints.
 * @param {string | symbol} styleId The style ID.
 * @param {'fill' | 'stroke'} prefix The prefix for properties in nodeData ('fill' or 'stroke').
 * @param {Partial<ColorData>} nodeData The node data object.
 * @param {SceneNode} node The node being processed.
 */
const processPaintType = async (
  paints: readonly Paint[],
  styleId: string | symbol,
  prefix: 'fill' | 'stroke',
  nodeData: Partial<ColorData>,
  node: SceneNode
): Promise<void> => {
  if (paints && paints.length > 0) {
    for (const paint of paints) {
      if (paint.type === 'SOLID' && paint.visible !== false) {
        try {
          if (paint.color && typeof paint.color === 'object') {
            const color = {
              r: typeof paint.color.r === 'number' ? paint.color.r : 0,
              g: typeof paint.color.g === 'number' ? paint.color.g : 0,
              b: typeof paint.color.b === 'number' ? paint.color.b : 0,
            };
            nodeData[prefix] = convertRgbToHex(color);
            break;
          }
        } catch (error) {
          console.error(`Error processing color for ${prefix} of node ${nodeData.name}:`, error);
          nodeData[prefix] = COLOR_MIXED;
        }
      }
    }
  }

  if (styleId && styleId !== figma.mixed) {
    try {
      const style = await figma.getStyleByIdAsync(styleId as string);
      if (style) {
        nodeData[`${prefix}_variable_name`] = style.name;
        const styleIdParts = style.id.split(',');
        if (styleIdParts.length > 0 && styleIdParts[0].startsWith('S:')) {
          nodeData[`${prefix}_collection_id`] = styleIdParts[0];
        } else {
          nodeData[`${prefix}_collection_id`] = style.id;
        }
        nodeData[`${prefix}_collection_name`] = style.description || '';
      } else {
        nodeData[`${prefix}_variable_name`] = String(styleId);
        console.warn(`Style with ID "${String(styleId)}" not found for ${prefix} of node ${nodeData.name}.`);
      }
    } catch (e) {
      console.error(`Error getting style by ID "${String(styleId)}" for ${prefix} of node ${nodeData.name}:`, e);
      nodeData[`${prefix}_variable_name`] = String(styleId); // Ensure it's always a string
    }
  }

  const propertyType = prefix === 'fill' ? 'fills' : 'strokes';
  const nodeWithBoundVariables = node as NodeWithBoundVariables;
  if (nodeWithBoundVariables.boundVariables && nodeWithBoundVariables.boundVariables[propertyType]) {
    await processVariableBindings(node, nodeData, propertyType, prefix);
  }
};

/**
 * Processes the colors (fills and strokes) for a single node.
 * @public
 * @param {SceneNode} node The node to process.
 * @param {ColorsResult} colorsResult The object to store fill color results.
 * @param {ColorsResult} colorsResultStroke The object to store stroke color results.
 * @returns {Promise<Partial<ColorData> | null>} The node data if it has valid colors, otherwise null.
 */
export const processNodeColors = async (
  node: SceneNode,
  colorsResult: ColorsResult,
  colorsResultStroke: ColorsResult
): Promise<Partial<ColorData> | null> => {
  const nodeWithKey = node as NodeWithKey;
  const nodeData: Partial<ColorData> = {
    name: node.name,
    nodeId: node.id,
    key: nodeWithKey.key,
    color: true,
    hidden: checkIsNodeOrParentHidden(node),
    type: node.type,
  };

  const parentComponentName = await getParentComponentName(node);
  if (parentComponentName) {
    nodeData.parentComponentName = parentComponentName;
  }

  await processPaintType((node as GeometryMixin).fills, (node as GeometryMixin).fillStyleId, 'fill', nodeData, node);
  await processPaintType((node as GeometryMixin).strokes, (node as GeometryMixin).strokeStyleId, 'stroke', nodeData, node);

  if (shouldExcludeNode(node, nodeData)) {
    return null;
  }

  addResult(nodeData, 'fill', colorsResult);
  addResult(nodeData, 'stroke', colorsResultStroke);

  if (
    (nodeData.fill && nodeData.fill !== COLOR_MIXED && nodeData.fill !== COLOR_ERROR) ||
    (nodeData.stroke && nodeData.stroke !== COLOR_MIXED && nodeData.stroke !== COLOR_ERROR)
  ) {
    return nodeData;
  }

  return null;
};