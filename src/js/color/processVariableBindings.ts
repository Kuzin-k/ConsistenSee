import { SceneNode, ColorData } from '../../shared/types';

// Constants for special values
const COLLECTION_NOT_FOUND = 'Collection not found' as const;
const ERROR_GETTING_COLLECTION = 'Error getting collection' as const;

/**
 * Processes color variable bindings for a node's property (fills or strokes).
 * It retrieves the variable and its collection information and updates the nodeData object.
 *
 * @export
 * @param {SceneNode} node The node to process.
 * @param {Partial<ColorData>} nodeData The node data object to update.
 * @param {('fills' | 'strokes')} propertyType The property type to check for bindings.
 * @param {string} prefix The prefix for the property name in nodeData ('fill' or 'stroke').
 * @returns {Promise<void>}
 */
export const processVariableBindings = async (node: SceneNode, nodeData: Partial<ColorData>, propertyType: 'fills' | 'strokes', prefix: string): Promise<void> => {
    const boundVariables = (node as any).boundVariables;
    if (boundVariables && boundVariables[propertyType]) {
        const binding = boundVariables[propertyType][0];
        if (binding && binding.id) {
            try {
                const variable = await figma.variables.getVariableByIdAsync(binding.id);
                if (variable) {
                    (nodeData as any)[`${prefix}_variable_name`] = variable.name;
                    try {
                        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
                        (nodeData as any)[`${prefix}_collection_name`] = collection ? collection.name : COLLECTION_NOT_FOUND;
                        (nodeData as any)[`${prefix}_collection_id`] = collection ? collection.id : null;
                    } catch (collectionError) {
                        console.error(`Error getting collection for variable ${variable.id}:`, collectionError);
                        (nodeData as any)[`${prefix}_collection_name`] = ERROR_GETTING_COLLECTION;
                    }
                }
            } catch (error) {
                console.error(`Error getting variable by ID ${binding.id}:`, error);
                (nodeData as any)[`${prefix}_variable_name`] = false;
            }
        }
    }
};