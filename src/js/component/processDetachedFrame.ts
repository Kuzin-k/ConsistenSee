/**
 * Модуль для проверки detached фреймов
 * @module processDetachedFrame
 */

import { ComponentsResult, ComponentData, SceneNode } from "../../shared/types";

// Определяем тип FrameNode для использования в функциях
type FrameNode = SceneNode & {
  type: "FRAME";
  width: number;
  height: number;
  detachedInfo?: {
    componentKey: string;
    componentId: string;
  };
};
import { checkIsNodeOrParentHidden } from "../utils/checkIsNodeOrParentHidden";
import { getParentComponentName } from "./getParentComponentName";

/**
 * Проверяет, является ли фрейм detached согласно Figma API
 * Detached фрейм - это фрейм, который был отсоединен от своего главного компонента
 *
 * @param frameNode - Узел фрейма для проверки
 * @returns true если фрейм detached, false в противном случае
 */
export function isDetachedFrame(frameNode: FrameNode): boolean {
  // Проверяем, что это фрейм
  if (!frameNode || frameNode.type !== "FRAME") {
    return false;
  }

  // Согласно Figma API, detached фрейм имеет свойство detachedInfo
  // https://www.figma.com/plugin-docs/api/FrameNode/#detachedinfo
  if (frameNode.detachedInfo) {
    return true;
  }

  // Дополнительная проверка: если фрейм был экземпляром компонента,
  // но потерял связь с главным компонентом
  // Проверяем через type assertion для InstanceNode
  const instanceNode = frameNode as unknown as Record<string, unknown>;
  if (instanceNode.mainComponent === null && instanceNode.mainComponentId) {
    return true;
  }

  return false;
}

/**
 * Обрабатывает узел и добавляет detached фреймы в результат компонентов
 *
 * @param node - Узел для проверки
 * @param componentsResult - Результат анализа компонентов для добавления detached фреймов
 * @returns Promise<void>
 */
export async function processDetachedFrame(
  node: FrameNode,
  componentsResult: ComponentsResult
): Promise<void> {
  // Проверяем, является ли узел detached фреймом
  if (!isDetachedFrame(node)) {
    return;
  }



  try {
    // Создаем данные для detached фрейма
    const componentData: ComponentData = {
      type: "INSTANCE", // Detached фреймы обрабатываем как инстансы
      name: node.name || "Unnamed Frame",
      nodeId: node.id,
      key: (node as unknown as Record<string, unknown>).key as string || null,
      description: (node as unknown as Record<string, unknown>).description as string || undefined,
      nodeVersion: null,
      hidden: checkIsNodeOrParentHidden(node),
      remote: false,
      parentName: await getParentComponentName(node),
      parentId: ((node as unknown as Record<string, unknown>).parent as Record<string, unknown>)?.id as string || null,
      mainComponentName: null,
      mainComponentKey: null,
      mainComponentId: null,
      mainComponentSetKey: null,
      mainComponentSetName: null,
      mainComponentSetId: null,
      isIcon: false,
      size: `${Math.round(node.width || 0)}×${Math.round(node.height || 0)}`,
      isNested: false,
      isLost: false,
      isDeprecated: false,
      isDetached: true, // Помечаем как detached
      skipUpdate: true, // Detached фреймы не нуждаются в обновлении
      isOutdated: false,
      isNotLatest: false,
      checkVersion: null,
      updateStatus: "skipped",
    };



    // Добавляем в массив instances
    componentsResult.instances.push(componentData);

    // Обновляем счетчик detached элементов
    if (!componentsResult.counts.detached) {
      componentsResult.counts.detached = 0;
    }
    componentsResult.counts.detached++;

  } catch (error) {
    console.error("[DEBUG] ❌ Ошибка при обработке detached фрейма:", error);
  }
}

/**
 * Фильтрует массив элементов, оставляя только detached фреймы
 *
 * @param instances - Массив экземпляров для фильтрации
 * @returns Массив detached фреймов
 */
export function filterDetachedFrames(instances: ComponentData[]): ComponentData[] {
  return instances.filter((instance) => {
    return instance.isDetached === true;
  });
}

/**
 * Добавляет признак isDetached к элементам массива
 *
 * @param instances - Массив экземпляров для обработки
 * @returns Массив с добавленным признаком isDetached
 */
export function markDetachedFrames(instances: ComponentData[]): ComponentData[] {
  return instances.map((instance) => ({
    ...instance,
    isDetached: instance.isDetached || false,
  }));
}
