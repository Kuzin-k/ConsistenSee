/**
 * Этот файл содержит общие типы и интерфейсы, используемые как в backend (code.ts),
 * так и в frontend (ui.html) частях плагина.
 */

// --- Локальные определения типов Figma ---
export type Paint = any;
export type SceneNode = any;
export type ComponentNode = any;
export type ComponentSetNode = any;
export type GeometryMixin = any;

// --- Специфичные для плагина структуры данных ---

/** Данные для отображения на экране-заставке */
export type SplashScreenData = {
  imageUrl: string;
  titleText: string;
  buttonText: string;
};

/** Статус публикации компонента */
export interface PublishStatus {
  isPublished: boolean;
  version: string;
}

/** Статистика по типам узлов */
export interface NodeStatistics {
  nodeTypeCounts: Record<string, number>;
  totalNodes: number;
  nodeName: string;
}

/** Узел для дерева компонентов в отладочной информации */
export interface ComponentTreeNode {
  id: string;
  name: string;
  type: string;
  children: ComponentTreeNode[];
}

/** Детальная информация о найденном компоненте/инстансе */
export interface ComponentData {
  type: "COMPONENT" | "INSTANCE" | "COMPONENT_SET";
  name: string;
  nodeId: string;
  key: string | null;
  description?: string;
  nodeVersion?: string | null;
  hidden: boolean;
  remote: boolean;
  parentName: string | null;
  parentId: string | null;
  mainComponentName: string | null;
  mainComponentKey: string | null;
  mainComponentId: string | null;
  mainComponentSetKey: string | null;
  mainComponentSetName: string | null;
  mainComponentSetId: string | null;
  isIcon: boolean;
  size: string | number;
  isNested: boolean;
  isLost: boolean;
  isDeprecated: boolean;
  skipUpdate: boolean;
  pluginDataKey?: string;
  // Поля статуса обновления
  isOutdated: boolean;
  isNotLatest: boolean;
  checkVersion: string | null;
  libraryComponentName?: string | null;
  libraryComponentSetName?: string | null;
  libraryComponentId?: string | null;
  libraryComponentVersion?: string | null;
  libraryComponentVersionMinimal?: string | null;
  updateStatus?: "checking" | "checked" | "skipped" | null;
}

/** Результат анализа компонентов */
export interface ComponentsResult {
  instances: ComponentData[];
  outdated?: ComponentData[];
  lost?: ComponentData[];
  deprecated?: ComponentData[];
  counts: {
    components: number;
    icons: number;
    outdated?: number;
    lost?: number;
    deprecated?: number;
  };
  executionTime?: number;
}

/** Детальная информация о найденном цвете */
export interface ColorData {
  name: string;
  nodeId: string;
  key?: string | null;
  color: true;
  hidden: boolean;
  type: string;
  parentComponentName?: string | null;
  fill?: string;
  fill_variable_name?: string | false;
  fill_collection_name?: string;
  fill_collection_id?: string;
  stroke?: string;
  stroke_variable_name?: string | false;
  stroke_collection_name?: string;
  stroke_collection_id?: string;
}

/** Результат анализа цветов */
export interface ColorsResult {
  instances: ColorData[];
  uniqueColors: Set<string>;
  totalUsage: number;
}

// --- Типы для обмена сообщениями между Backend и UI ---

/** Сообщения, отправляемые из UI в Backend */
export type UIMessage =
  | { type: "resize"; width: number; height: number }
  | { type: "check-all" }
  | { type: "check-updates"; components: ComponentsResult }
  | { type: "scroll-to-node"; nodeId: string }
  | { type: "select-nodes"; nodeIds: string[] }
  | { type: "get-component-data" }
  | { type: "set-component-data"; key: string; version: string }
  | { type: "clear-component-data" };

/** Сообщения, отправляемые из Backend в UI */
export type PluginMessage =
  | { type: "user-info"; user: { name: string; id: string } }
  | { type: "splash-data"; data: SplashScreenData }
  | {
      type: "progress-update";
      phase: string;
      processed: number;
      total: number;
      message: string;
    }
  | {
      type: "display-total";
      data: { overallStats: NodeStatistics; totalCount: number };
    }
  | {
      type: "all-results";
      components: ComponentsResult;
      colors: ColorsResult;
      colorsStroke: ColorsResult;
      componentTree: ComponentTreeNode[];
      totalStats: NodeStatistics;
    }
  | { type: "error"; message: string }
  | {
      type: "component-data-result";
      data?: Record<string, any>;
      message?: string;
      isError?: boolean;
    }
  | { type: "component-data-set"; message: string; isError?: boolean }
  | { type: "component-data-cleared"; message: string; isError?: boolean };
