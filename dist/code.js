"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/js/utils/delay.ts
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/js/utils/updateProgress.ts
var updateProgress = async (phase, processed, total, message, currentComponentName) => {
  figma.ui.postMessage({
    type: "progress-update",
    phase,
    processed,
    total,
    message,
    currentComponentName
    // Передаем название компонента в UI
  });
  await delay(1);
};

// src/js/utils/retryWithBackoff.ts
var isConnectionError = (error) => {
  var _a2;
  const message = ((_a2 = error == null ? void 0 : error.message) == null ? void 0 : _a2.toLowerCase()) || "";
  return message.includes("unable to establish connection") || message.includes("connection timeout") || message.includes("network error") || message.includes("connection failed") || message.includes("timeout");
};
var retryWithBackoff = async (operation, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1e3,
    maxDelay = 1e4,
    backoffMultiplier = 2,
    onRetry
  } = options;
  let lastError;
  let connectionIssueReported = false;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isConnectionError(lastError)) {
        throw lastError;
      }
      if (!connectionIssueReported) {
        figma.ui.postMessage({
          type: "connection-waiting",
          message: "Waiting for connection..."
        });
        connectionIssueReported = true;
      }
      if (attempt === maxRetries) {
        throw lastError;
      }
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }
      const delay2 = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      console.log(`[retryWithBackoff] \u041F\u043E\u043F\u044B\u0442\u043A\u0430 ${attempt + 1}/${maxRetries + 1} \u043D\u0435\u0443\u0434\u0430\u0447\u043D\u0430. \u041F\u043E\u0432\u0442\u043E\u0440 \u0447\u0435\u0440\u0435\u0437 ${delay2}\u043C\u0441. \u041E\u0448\u0438\u0431\u043A\u0430:`, lastError.message);
      await new Promise((resolve) => setTimeout(resolve, delay2));
    }
  }
  throw lastError;
};
var retryGetMainComponent = async (node, nodeName) => {
  return retryWithBackoff(
    () => node.getMainComponentAsync(),
    {
      maxRetries: 3,
      initialDelay: 2e3,
      // Увеличиваем начальную задержку для Figma API
      maxDelay: 15e3,
      onRetry: (attempt, error) => {
        console.log(`[retryGetMainComponent] \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043F\u043E\u043F\u044B\u0442\u043A\u0430 ${attempt} \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 "${nodeName}": ${error.message}`);
        figma.ui.postMessage({
          type: "retry-notification",
          message: `\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043F\u043E\u043F\u044B\u0442\u043A\u0430 ${attempt}/3 \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 "${nodeName}"`
        });
      }
    }
  );
};
var checkFigmaConnection = async () => {
  try {
    const currentPage = figma.currentPage;
    if (currentPage && currentPage.name) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("[checkFigmaConnection] \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F:", error);
    return false;
  }
};
var waitForConnection = async (maxWaitTime = 3e4) => {
  const startTime = Date.now();
  const checkInterval = 2e3;
  while (Date.now() - startTime < maxWaitTime) {
    if (await checkFigmaConnection()) {
      return true;
    }
    console.log("[waitForConnection] \u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F...");
    figma.ui.postMessage({
      type: "connection-waiting",
      message: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441 Figma..."
    });
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }
  return false;
};

// src/js/color/clearRgbToHexCache.ts
var rgbToHexCache = /* @__PURE__ */ new Map();
var clearRgbToHexCache = () => {
  rgbToHexCache.clear();
};

// src/js/color/convertRgbToHex.ts
var convertRgbToHex = ({ r, g, b }) => {
  if (r === void 0 || g === void 0 || b === void 0 || typeof r !== "number" || typeof g !== "number" || typeof b !== "number" || // Проверка на тип number
  // @ts-ignore: figma.mixed может быть символом, а не числом, поэтому прямое сравнение может быть нежелательным.
  r === figma.mixed || g === figma.mixed || b === figma.mixed) {
    return "#MIXED";
  }
  try {
    const rClamped = Math.max(0, Math.min(1, r));
    const gClamped = Math.max(0, Math.min(1, g));
    const bClamped = Math.max(0, Math.min(1, b));
    const rInt = Math.round(rClamped * 255);
    const gInt = Math.round(gClamped * 255);
    const bInt = Math.round(bClamped * 255);
    const key = `${rInt}-${gInt}-${bInt}`;
    const cachedHex = rgbToHexCache.get(key);
    if (cachedHex) {
      return cachedHex;
    }
    const toHexComponent = (n_int) => {
      const hex2 = n_int.toString(16);
      return hex2.length === 1 ? "0" + hex2 : hex2;
    };
    const hex = `#${toHexComponent(rInt)}${toHexComponent(gInt)}${toHexComponent(bInt)}`;
    rgbToHexCache.set(key, hex);
    return hex;
  } catch (error) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u0438 RGB \u0432 HEX:", { r, g, b, error });
    return "#ERROR";
  }
};

// src/js/component/getParentComponentName.ts
var getParentComponentName = async (node) => {
  let parentNode = node.parent;
  while (parentNode) {
    if (parentNode.type === "INSTANCE") {
      try {
        const parentMainComponent = await retryGetMainComponent(parentNode, parentNode.name);
        if (parentMainComponent) {
          if (parentMainComponent.parent && parentMainComponent.parent.type === "COMPONENT_SET") {
            return parentMainComponent.parent.name;
          }
          return parentMainComponent.name;
        }
      } catch (error) {
        console.error(`\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438 mainComponent \u0434\u043B\u044F \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u044F ${parentNode.name} \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A:`, error);
      }
      return null;
    }
    parentNode = parentNode.parent;
  }
  return null;
};

// src/js/color/processVariableBindings.ts
var COLLECTION_NOT_FOUND = "Collection not found";
var ERROR_GETTING_COLLECTION = "Error getting collection";
var processVariableBindings = async (node, nodeData, propertyType, prefix) => {
  const boundVariables = node.boundVariables;
  if (boundVariables && boundVariables[propertyType]) {
    const binding = boundVariables[propertyType][0];
    if (binding && binding.id) {
      try {
        const variable = await retryWithBackoff(
          () => figma.variables.getVariableByIdAsync(binding.id),
          {
            onRetry: (attempt, error) => {
              console.warn(`Retry ${attempt} for getting variable by ID ${binding.id}:`, error.message);
            }
          }
        );
        if (variable) {
          nodeData[`${prefix}_variable_name`] = variable.name;
          try {
            const collection = await retryWithBackoff(
              () => figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId),
              {
                onRetry: (attempt, error) => {
                  console.warn(`Retry ${attempt} for getting variable collection by ID ${variable.variableCollectionId}:`, error.message);
                }
              }
            );
            nodeData[`${prefix}_collection_name`] = collection ? collection.name : COLLECTION_NOT_FOUND;
            nodeData[`${prefix}_collection_id`] = collection ? collection.id : null;
          } catch (collectionError) {
            console.error(`Error getting collection for variable ${variable.id}:`, collectionError);
            nodeData[`${prefix}_collection_name`] = ERROR_GETTING_COLLECTION;
          }
        }
      } catch (error) {
        console.error(`Error getting variable by ID ${binding.id}:`, error);
        nodeData[`${prefix}_variable_name`] = false;
      }
    }
  }
};

// src/js/utils/checkIsNodeOrParentHidden.ts
var checkIsNodeOrParentHidden = (node) => {
  let currentNode = node;
  while (currentNode) {
    if (currentNode.visible === false) {
      return true;
    }
    currentNode = currentNode.parent;
  }
  return false;
};

// src/js/color/processNodeColors.ts
var COLOR_MIXED = "#MIXED";
var COLOR_ERROR = "#ERROR";
var hasParentWithNameAndType = (targetNode, targetName, targetType) => {
  let current = targetNode.parent;
  while (current) {
    if (current.name && current.name.toLowerCase() === targetName.toLowerCase() && current.type === targetType) {
      return true;
    }
    current = current.parent;
  }
  return false;
};
var shouldExcludeNode = (node, nodeData) => {
  const excludedColors = ["#000000", "#ffffff", "#FFFFFF", "#ff33bb", COLOR_MIXED, COLOR_ERROR];
  const hasExcludedColor = nodeData.fill && excludedColors.indexOf(nodeData.fill) !== -1 || nodeData.stroke && excludedColors.indexOf(nodeData.stroke) !== -1;
  const isExcludedBySourceGroup = hasExcludedColor && hasParentWithNameAndType(node, "source", "GROUP");
  const isExcludedByGroupGroup = hasExcludedColor && hasParentWithNameAndType(node, "group", "GROUP");
  const isComponentSetBorder = nodeData.stroke === "#9747ff" && node.type === "COMPONENT_SET";
  return isExcludedBySourceGroup || isExcludedByGroupGroup || isComponentSetBorder;
};
var addResult = (nodeData, type, results) => {
  const colorValue = nodeData[type];
  if (colorValue && colorValue !== COLOR_MIXED && colorValue !== COLOR_ERROR) {
    const data = __spreadValues({}, nodeData);
    if (type === "fill") {
      delete data.stroke;
      delete data.stroke_variable_name;
      delete data.stroke_collection_id;
      delete data.stroke_collection_name;
    } else {
      delete data.fill;
      delete data.fill_variable_name;
      delete data.fill_collection_id;
      delete data.fill_collection_name;
    }
    if (Array.isArray(results.instances)) {
      results.instances.push(data);
    } else {
      console.error(`results.instances is not an array:`, results.instances);
    }
  }
};
var processPaintType = async (paints, styleId, prefix, nodeData, node) => {
  if (paints && paints.length > 0) {
    for (const paint of paints) {
      if (paint.type === "SOLID" && paint.visible !== false) {
        try {
          if (paint.color && typeof paint.color === "object") {
            const color = {
              r: typeof paint.color.r === "number" ? paint.color.r : 0,
              g: typeof paint.color.g === "number" ? paint.color.g : 0,
              b: typeof paint.color.b === "number" ? paint.color.b : 0
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
      const style = await figma.getStyleByIdAsync(styleId);
      if (style) {
        nodeData[`${prefix}_variable_name`] = style.name;
        const styleIdParts = style.id.split(",");
        if (styleIdParts.length > 0 && styleIdParts[0].startsWith("S:")) {
          nodeData[`${prefix}_collection_id`] = styleIdParts[0];
        } else {
          nodeData[`${prefix}_collection_id`] = style.id;
        }
        nodeData[`${prefix}_collection_name`] = style.description || "";
      } else {
        nodeData[`${prefix}_variable_name`] = String(styleId);
        console.warn(`Style with ID "${styleId}" not found for ${prefix} of node ${nodeData.name}.`);
      }
    } catch (e) {
      console.error(`Error getting style by ID "${styleId}" for ${prefix} of node ${nodeData.name}:`, e);
      nodeData[`${prefix}_variable_name`] = String(styleId);
    }
  }
  const propertyType = prefix === "fill" ? "fills" : "strokes";
  if (node.boundVariables && node.boundVariables[propertyType]) {
    await processVariableBindings(node, nodeData, propertyType, prefix);
  }
};
var processNodeColors = async (node, colorsResult2, colorsResultStroke2) => {
  const nodeData = {
    name: node.name,
    nodeId: node.id,
    key: node.key,
    color: true,
    hidden: checkIsNodeOrParentHidden(node),
    type: node.type
  };
  const parentComponentName = await getParentComponentName(node);
  if (parentComponentName) {
    nodeData.parentComponentName = parentComponentName;
  }
  await processPaintType(node.fills, node.fillStyleId, "fill", nodeData, node);
  await processPaintType(node.strokes, node.strokeStyleId, "stroke", nodeData, node);
  if (shouldExcludeNode(node, nodeData)) {
    return null;
  }
  addResult(nodeData, "fill", colorsResult2);
  addResult(nodeData, "stroke", colorsResultStroke2);
  if (nodeData.fill && nodeData.fill !== COLOR_MIXED && nodeData.fill !== COLOR_ERROR || nodeData.stroke && nodeData.stroke !== COLOR_MIXED && nodeData.stroke !== COLOR_ERROR) {
    return nodeData;
  }
  return null;
};

// src/js/color/checkFillOrStroke.ts
var hasFillOrStroke = (node) => {
  const fills = node.fills;
  const strokes = node.strokes;
  return Array.isArray(fills) && fills.length > 0 || Array.isArray(strokes) && strokes.length > 0;
};

// src/js/component/getDescription.ts
async function getDescription(node) {
  let description = "";
  if (!node) {
    console.warn("getDescription: \u043F\u043E\u043B\u0443\u0447\u0435\u043D \u043F\u0443\u0441\u0442\u043E\u0439 \u0443\u0437\u0435\u043B.");
    return { description: "", nodeVersion: null, nodeVersionMinimal: null };
  }
  try {
    if ("description" in node && node.description) {
      description = node.description || "";
    } else {
      description = "";
    }
    if (node.type === "COMPONENT" && !description && node.parent && node.parent.type === "COMPONENT_SET") {
      description = node.parent.description || "";
    } else if (node.type === "INSTANCE") {
      if (!description) {
        try {
          const mainComponent = await retryGetMainComponent(node, node.name);
          if (mainComponent) {
            description = mainComponent.description || "";
            if (!description && mainComponent.parent && mainComponent.parent.type === "COMPONENT_SET") {
              description = mainComponent.parent.description || "";
            }
          }
        } catch (retryError) {
          console.error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C mainComponent \u0434\u043B\u044F ${node.name} \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A:`, retryError);
        }
      }
    } else if (node.type === "COMPONENT" && !description && node.parent && node.parent.type === "COMPONENT_SET") {
      description = node.parent.description || "";
    }
  } catch (error) {
    console.error(`\u041E\u0448\u0438\u0431\u043A\u0430 \u0432 getDescription \u0434\u043B\u044F \u0443\u0437\u043B\u0430 "${node.name}" (ID: ${node.id}):`, error);
  }
  let nodeVersion = null;
  let nodeVersionMinimal = null;
  if (description) {
    const descStr = String(description);
    const minimalPattern = /v\s*(\d+\.\d+\.\d+)\s*\(minimal\)/i;
    const minimalMatch = descStr.match(minimalPattern);
    if (minimalMatch) {
      nodeVersionMinimal = minimalMatch[1];
    }
    const versionPattern = /v\s*(\d+\.\d+\.\d+)/i;
    const match = descStr.match(versionPattern);
    nodeVersion = match ? match[1] : null;
  }
  return { description: description || "", nodeVersion, nodeVersionMinimal };
}

// src/js/component/getComponentCacheKey.ts
var getComponentCacheKey = (component) => {
  if (!component) {
    return "unknown_component_no_id";
  }
  try {
    if (!component.key) {
      return `local_component_${component.id || "no_id"}`;
    }
    return component.key;
  } catch (error) {
    console.error("Error in getComponentCacheKey:", error);
    return `error_processing_component_${component.id || "no_id"}`;
  }
};

// src/js/update/compareVersions.ts
var compareVersions = (versionInstance, versionLatest, versionMinimal) => {
  const extractNumeric = (v) => {
    if (!v) return [];
    const m = String(v).match(/^(\d+(?:\.\d+)*)/);
    if (!m) return [];
    return m[1].split(".").map((s) => Number(s));
  };
  const cmpParts = (a, b) => {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const p1 = a[i] || 0;
      const p2 = b[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  };
  if (!versionLatest && !versionInstance) return "Latest";
  if (!versionLatest) return "Latest";
  if (!versionInstance) return "Outdated";
  const instParts = extractNumeric(versionInstance);
  const latestParts = extractNumeric(versionLatest);
  const minimalParts = versionMinimal ? extractNumeric(versionMinimal) : null;
  if (minimalParts) {
    const cmpToMinimal = cmpParts(instParts, minimalParts);
    if (cmpToMinimal < 0) return "Outdated";
    const cmpToLatest = cmpParts(instParts, latestParts);
    if (cmpToLatest < 0) return "NotLatest";
    return "Latest";
  }
  const cmp = cmpParts(instParts, latestParts);
  if (cmp < 0) return "Outdated";
  return "Latest";
};

// src/js/update/updateAvailabilityCheck.ts
var checkIsDeprecated = (componentName, setName = "") => {
  return componentName.includes("Deprecated") || componentName.includes("DEPRECATED") || componentName.includes("\u274C") || setName.includes("Deprecated") || setName.includes("DEPRECATED") || setName.includes("\u274C");
};
var componentUpdateCache = /* @__PURE__ */ new Map();
var updateAvailabilityCheck = async (mainComponent, instanceVersion) => {
  var _a2, _b;
  if (!mainComponent) {
    console.error("updateAvailabilityCheck: \u043F\u043E\u043B\u0443\u0447\u0435\u043D \u043F\u0443\u0441\u0442\u043E\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442");
    return {
      isOutdated: false,
      importedId: null,
      version: instanceVersion != null ? instanceVersion : null,
      checkVersion: null,
      description: null,
      mainComponentId: null,
      importedMainComponentId: null,
      libraryComponentName: null,
      libraryComponentSetName: null,
      isLost: false,
      isNotLatest: false,
      isDeprecated: false
    };
  }
  try {
    const cacheKey = getComponentCacheKey(mainComponent);
    const isPartOfSet = ((_a2 = mainComponent.parent) == null ? void 0 : _a2.type) === "COMPONENT_SET";
    let libraryVersionSourceNode = null;
    let importedComponentIdForComparison = null;
    let libraryComponentSetName = null;
    let libraryComponentName = null;
    let libraryVersion = null;
    let libraryVersionMinimal = null;
    const cached = componentUpdateCache.get(cacheKey);
    if (cached) {
      libraryVersion = cached.latest;
      libraryVersionMinimal = cached.minimal;
      libraryComponentSetName = cached.libraryComponentSetName;
      importedComponentIdForComparison = cached.libraryComponentId;
      libraryComponentName = cached.libraryComponentName;
      console.log(
        `[updateAvailabilityCheck] GET FROM CACHE \u2014 ${mainComponent.name}`,
        {
          latest: libraryVersion,
          minimal: libraryVersionMinimal,
          lost: cached.lost,
          cacheKey,
          rawCachedData: cached
        }
      );
      if (cached.lost) {
        const componentName2 = mainComponent.name || "";
        const isDeprecated2 = checkIsDeprecated(componentName2);
        const cachedLostResult = {
          isOutdated: false,
          isNotLatest: false,
          checkVersion: null,
          isLost: true,
          isDeprecated: isDeprecated2,
          mainComponentId: mainComponent.id,
          importedId: cached.libraryComponentId,
          importedMainComponentId: cached.libraryComponentId,
          libraryComponentName: cached.libraryComponentName,
          libraryComponentSetName: cached.libraryComponentSetName,
          libraryComponentId: cached.libraryComponentId,
          libraryComponentVersion: null,
          libraryComponentVersionMinimal: null,
          version: instanceVersion != null ? instanceVersion : null,
          description: null
        };
        console.warn("DEBUG: \u041A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442 \u043F\u043E\u043C\u0435\u0447\u0435\u043D \u043A\u0430\u043A \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u043D\u044B\u0439 (\u0438\u0437 \u043A\u044D\u0448\u0430)", {
          cacheKey,
          name: mainComponent.name,
          isDeprecated: isDeprecated2
        });
        return cachedLostResult;
      }
    } else {
      if (!mainComponent.key) {
        console.error("\u0423 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043A\u043B\u044E\u0447:", mainComponent.name);
      } else if (isPartOfSet && ((_b = mainComponent.parent) == null ? void 0 : _b.key)) {
        try {
          const importedSet = await figma.importComponentSetByKeyAsync(
            mainComponent.parent.key
          );
          if (importedSet) {
            libraryVersionSourceNode = importedSet;
            libraryComponentSetName = importedSet.name;
            const importedComponentInSet = importedSet.findChild(
              (comp) => comp.type === "COMPONENT" && comp.key === mainComponent.key
            );
            if (importedComponentInSet) {
              if (!importedComponentInSet.id) {
                console.error(
                  `\u041E\u0448\u0438\u0431\u043A\u0430: \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442 "${importedComponentInSet.name}" \u0432 \u043D\u0430\u0431\u043E\u0440\u0435 "${importedSet.name}" \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 ID.`
                );
              } else {
                importedComponentIdForComparison = importedComponentInSet.id;
                libraryComponentName = importedComponentInSet.name;
              }
            } else {
              console.error(
                `\u041A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442 "${mainComponent.name}" (key: ${mainComponent.key}) \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u043C \u043D\u0430\u0431\u043E\u0440\u0435 "${importedSet.name}"`
              );
            }
          } else {
            console.error(
              `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0431\u043E\u0440 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F "${mainComponent.name}" (parent key: ${mainComponent.parent.key})`
            );
          }
        } catch (setError) {
          console.error(
            `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0435 \u043D\u0430\u0431\u043E\u0440\u0430 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F "${mainComponent.name}":`,
            setError
          );
        }
      } else {
        try {
          const importedComponent = await figma.importComponentByKeyAsync(
            mainComponent.key
          );
          if (importedComponent) {
            if (!importedComponent.id) {
              console.error(
                `\u041E\u0448\u0438\u0431\u043A\u0430: \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043E\u0434\u0438\u043D\u043E\u0447\u043D\u044B\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442 "${importedComponent.name}" \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 ID.`
              );
            } else {
              libraryVersionSourceNode = importedComponent;
              importedComponentIdForComparison = importedComponent.id;
              libraryComponentName = importedComponent.name;
            }
          }
        } catch (componentError) {
          console.error(
            `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0435 \u043E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0433\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 "${mainComponent.name}":`,
            componentError
          );
        }
      }
      if (libraryVersionSourceNode) {
        console.log(
          `[updateAvailabilityCheck] LIBRARY SOURCE NODE FOUND for ${mainComponent.name}:`,
          {
            sourceNodeType: libraryVersionSourceNode.type,
            sourceNodeName: libraryVersionSourceNode.name,
            sourceNodeDescription: libraryVersionSourceNode.description
          }
        );
        const libraryDescData = await getDescription(libraryVersionSourceNode);
        console.log(
          `[updateAvailabilityCheck] GET DESCRIPTION RESULT for ${mainComponent.name}:`,
          {
            description: libraryDescData.description,
            nodeVersion: libraryDescData.nodeVersion,
            nodeVersionMinimal: libraryDescData.nodeVersionMinimal
          }
        );
        libraryVersion = libraryDescData.nodeVersion;
        libraryVersionMinimal = libraryDescData.nodeVersionMinimal;
        console.log(
          `[updateAvailabilityCheck] ASSIGNED VERSIONS for ${mainComponent.name}:`,
          {
            libraryVersion,
            libraryVersionMinimal
          }
        );
        componentUpdateCache.set(cacheKey, {
          latest: libraryVersion,
          minimal: libraryVersionMinimal,
          lost: false,
          libraryComponentSetName,
          libraryComponentId: importedComponentIdForComparison,
          libraryComponentName
        });
      } else {
        componentUpdateCache.set(cacheKey, {
          latest: null,
          minimal: null,
          lost: true,
          libraryComponentSetName: null,
          libraryComponentId: null,
          libraryComponentName: null
        });
      }
    }
    const componentName = mainComponent.name || "";
    const setName = libraryComponentSetName || "";
    const isDeprecated = checkIsDeprecated(componentName, setName);
    console.log(
      `[updateAvailabilityCheck] CREATING RESULT for ${mainComponent.name}:`,
      {
        libraryVersion,
        libraryVersionMinimal,
        willAssignToResult: {
          libraryComponentVersion: libraryVersion,
          libraryComponentVersionMinimal: libraryVersionMinimal
        }
      }
    );
    const result = {
      isOutdated: false,
      isNotLatest: false,
      checkVersion: null,
      isLost: false,
      isDeprecated,
      mainComponentId: mainComponent.id,
      importedId: importedComponentIdForComparison,
      importedMainComponentId: importedComponentIdForComparison,
      libraryComponentName,
      libraryComponentSetName,
      libraryComponentId: importedComponentIdForComparison,
      libraryComponentVersion: libraryVersion,
      libraryComponentVersionMinimal: libraryVersionMinimal,
      version: instanceVersion != null ? instanceVersion : null,
      description: null
    };
    console.log(
      `[updateAvailabilityCheck] RESULT CREATED for ${mainComponent.name}:`,
      {
        resultLibraryComponentVersion: result.libraryComponentVersion,
        resultLibraryComponentVersionMinimal: result.libraryComponentVersionMinimal
      }
    );
    if (libraryVersion || libraryVersionMinimal) {
      const compareResult = compareVersions(
        instanceVersion,
        libraryVersion,
        libraryVersionMinimal
      );
      result.isOutdated = compareResult === "Outdated";
      result.isNotLatest = compareResult === "NotLatest";
      result.checkVersion = compareResult;
    } else if (importedComponentIdForComparison) {
      result.isOutdated = false;
      result.checkVersion = "Latest";
    } else {
      result.isLost = true;
    }
    console.log(
      `[updateAvailabilityCheck] FINAL RESULT for ${mainComponent.name}:`,
      {
        name: mainComponent.name,
        isOutdated: result.isOutdated,
        isNotLatest: result.isNotLatest,
        isLost: result.isLost,
        checkVersion: result.checkVersion,
        instanceVersion,
        libraryVersion: result.libraryComponentVersion,
        libraryVersionMinimal: result.libraryComponentVersionMinimal,
        libraryComponentId: result.libraryComponentId,
        libraryComponentName: result.libraryComponentName,
        libraryComponentSetName: result.libraryComponentSetName,
        cacheKey
      }
    );
    return result;
  } catch (error) {
    console.error(
      `\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 "${mainComponent ? mainComponent.name : "N/A"}":`,
      {
        componentName: mainComponent ? mainComponent.name : "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E",
        error: error.message,
        stack: error.stack
      }
    );
    const safeResult = {
      isOutdated: false,
      isNotLatest: false,
      isDeprecated: false,
      mainComponentId: mainComponent ? mainComponent.id : null,
      importedMainComponentId: null,
      importedId: null,
      libraryComponentName: mainComponent ? mainComponent.name : null,
      libraryComponentSetName: null,
      libraryComponentId: null,
      checkVersion: null,
      version: instanceVersion != null ? instanceVersion : null,
      description: null,
      libraryComponentVersion: null,
      libraryComponentVersionMinimal: null,
      isLost: false
    };
    return safeResult;
  }
};
var clearUpdateCache = () => {
  componentUpdateCache.clear();
};

// src/js/update/updateQueue.ts
var UpdateQueue = class {
  constructor(config = {}) {
    this.queue = [];
    this.processing = /* @__PURE__ */ new Set();
    this.completed = /* @__PURE__ */ new Map();
    this.seenIds = /* @__PURE__ */ new Set();
    this.isRunning = false;
    this.totalComponents = 0;
    this.processedCount = 0;
    this.activeBatchesCount = 0;
    this.config = __spreadValues({
      batchSize: 5,
      maxConcurrent: 3,
      progressUpdateInterval: 1e3
    }, config);
  }
  /**
   * Add component to the update queue
   */
  addComponent(component) {
    if (!component.mainComponentKey) {
      console.warn(
        "[UpdateQueue] Component without mainComponentKey skipped:",
        component.name
      );
      return;
    }
    const dedupeKey = `${component.mainComponentKey || "unknown"}_$$${component.nodeId || "no-node"}`;
    if (this.seenIds.has(dedupeKey)) {
      console.warn(
        "[UpdateQueue] Duplicate component detected and skipped:",
        { name: component.name, nodeId: component.nodeId, mainKey: component.mainComponentKey }
      );
      return;
    }
    this.seenIds.add(dedupeKey);
    const queueItem = {
      component,
      index: this.queue.length,
      totalCount: this.totalComponents
    };
    this.queue.push(queueItem);
    this.totalComponents++;
    console.log(
      "[UpdateQueue] Added component to queue:",
      { name: component.name, nodeId: component.nodeId, mainKey: component.mainComponentKey, totalComponents: this.totalComponents, queueLength: this.queue.length }
    );
  }
  /**
   * Add multiple components to the queue
   */
  addComponents(components) {
    components.forEach((component) => this.addComponent(component));
  }
  /**
   * Start processing manually after all components are added
   */
  startProcessingManually() {
    if (!this.isRunning) {
      this.startProcessing();
    }
  }
  /**
   * Set progress callback
   */
  onProgress(callback) {
    this.onProgressCallback = callback;
  }
  /**
   * Set completion callback
   */
  onComplete(callback) {
    this.onCompleteCallback = callback;
  }
  /**
   * Start processing the queue
   */
  async startProcessing() {
    if (this.isRunning) {
      console.log("[UpdateQueue] startProcessing called but already running, skipping");
      return;
    }
    this.isRunning = true;
    console.log("[UpdateQueue] Starting parallel update check processing");
    console.log(
      "[UpdateQueue] Initial status:",
      {
        queueLength: this.queue.length,
        totalComponents: this.totalComponents,
        batchSize: this.config.batchSize,
        maxConcurrent: this.config.maxConcurrent
      }
    );
    const activeBatches = [];
    while (this.queue.length > 0 || activeBatches.length > 0) {
      while (activeBatches.length < this.config.maxConcurrent && this.queue.length > 0) {
        const batch = this.queue.splice(0, this.config.batchSize);
        const batchPromise = this.processBatch(batch);
        activeBatches.push(batchPromise);
        this.activeBatchesCount++;
        batchPromise.finally(() => {
          const index = activeBatches.indexOf(batchPromise);
          if (index > -1) {
            activeBatches.splice(index, 1);
            this.activeBatchesCount--;
          }
        });
      }
      if (activeBatches.length >= this.config.maxConcurrent) {
        await Promise.race(activeBatches);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.isRunning = false;
    console.log("[UpdateQueue] Processing completed, calling notifyCompletion");
    this.notifyCompletion();
  }
  /**
   * Process a batch of components
   */
  async processBatch(batch) {
    try {
      const promises = batch.map((item) => this.processComponent(item));
      await Promise.all(promises);
    } catch (error) {
      console.error("[UpdateQueue] Error processing batch:", error);
    }
  }
  /**
   * Process a single component
   */
  async processComponent(item) {
    var _a2;
    const { component } = item;
    const componentId = `${component.mainComponentKey || "unknown"}_$${component.nodeId || "no-node"}`;
    this.processing.add(componentId);
    console.log(
      `[UpdateQueue] Enqueued for processing: ${component.name}. In-flight now: ${this.processing.size}`
    );
    try {
      console.log(`[UpdateQueue] Processing component: ${component.name}`);
      const mainComponent = component.mainComponentId ? await figma.getNodeByIdAsync(
        component.mainComponentId
      ) : null;
      if (!mainComponent) {
        console.warn(`Main component not found for: ${component.name}`);
        let finalId2 = componentId;
        if (this.completed.has(finalId2)) {
          console.warn(
            `[UpdateQueue] Duplicate componentId detected (no main): ${finalId2}. Resolving with suffix`
          );
          let counter = 1;
          while (this.completed.has(`${componentId}__dup_${counter}`)) {
            counter++;
          }
          finalId2 = `${componentId}__dup_${counter}`;
        }
        const fallbackComponent = __spreadProps(__spreadValues({}, component), { updateStatus: "checked" });
        this.completed.set(finalId2, fallbackComponent);
        this.processedCount++;
        return;
      }
      const updateInfo = await updateAvailabilityCheck(
        mainComponent,
        component.nodeVersion
      );
      console.log(
        `[UpdateQueue] updateAvailabilityCheck result for ${component.name}:`,
        {
          checkVersion: updateInfo.checkVersion,
          libraryComponentVersion: updateInfo.libraryComponentVersion,
          libraryComponentVersionMinimal: updateInfo.libraryComponentVersionMinimal,
          libraryComponentId: updateInfo.libraryComponentId,
          libraryComponentName: updateInfo.libraryComponentName,
          libraryComponentSetName: updateInfo.libraryComponentSetName,
          hasVersionData: !!(updateInfo.libraryComponentVersion || updateInfo.libraryComponentVersionMinimal)
        }
      );
      const updatedComponent = __spreadProps(__spreadValues({}, component), {
        isOutdated: updateInfo.isOutdated,
        isLost: Boolean(updateInfo.isLost),
        isDeprecated: Boolean(updateInfo.isDeprecated),
        isNotLatest: Boolean(updateInfo.isNotLatest),
        checkVersion: updateInfo.checkVersion,
        libraryComponentVersion: updateInfo.libraryComponentVersion,
        libraryComponentVersionMinimal: updateInfo.libraryComponentVersionMinimal,
        libraryComponentName: updateInfo.libraryComponentName,
        libraryComponentSetName: updateInfo.libraryComponentSetName,
        libraryComponentId: updateInfo.libraryComponentId,
        updateStatus: "checked"
      });
      console.log(
        `[UpdateQueue] Final updatedComponent for ${component.name}:`,
        {
          libraryComponentVersion: updatedComponent.libraryComponentVersion,
          libraryComponentVersionMinimal: updatedComponent.libraryComponentVersionMinimal,
          libraryComponentId: updatedComponent.libraryComponentId,
          libraryComponentName: updatedComponent.libraryComponentName,
          libraryComponentSetName: updatedComponent.libraryComponentSetName,
          hasVersionData: !!(updatedComponent.libraryComponentVersion || updatedComponent.libraryComponentVersionMinimal)
        }
      );
      let finalId = componentId;
      if (this.completed.has(finalId)) {
        console.warn(
          `[UpdateQueue] Duplicate componentId detected: ${finalId}. Resolving with suffix`
        );
        console.warn(`[UpdateQueue] Existing component: ${(_a2 = this.completed.get(finalId)) == null ? void 0 : _a2.name}, New component: ${updatedComponent.name}`);
        let counter = 1;
        while (this.completed.has(`${componentId}__dup_${counter}`)) {
          counter++;
        }
        finalId = `${componentId}__dup_${counter}`;
        console.log(`[UpdateQueue] Resolved duplicate with key: ${finalId}`);
      }
      this.completed.set(finalId, updatedComponent);
      this.processedCount++;
      console.log(
        `[UpdateQueue] Component ${updatedComponent.name} processed successfully. ComponentId: ${finalId}`
      );
      console.log(
        `[UpdateQueue] Completed map size: ${this.completed.size}, keys:`,
        Array.from(this.completed.keys())
      );
      console.log(
        `[UpdateQueue] Component ${updatedComponent.name} stored in completed map:`,
        this.completed.has(finalId)
      );
      console.log(`[UpdateQueue] ALL COMPLETED COMPONENTS (${this.completed.size}):`);
      Array.from(this.completed.entries()).forEach(([key, comp]) => {
        console.log(`  [${key}]: ${comp.name} - hasLibraryVersion: ${!!comp.libraryComponentVersion}`);
      });
      if (this.onProgressCallback) {
        this.onProgressCallback(
          this.processedCount,
          this.totalComponents,
          updatedComponent
        );
      }
    } catch (error) {
      console.error(
        `[UpdateQueue] Error processing component ${component.name}:`,
        error
      );
      let finalId = componentId;
      if (this.completed.has(finalId)) {
        console.warn(
          `[UpdateQueue] Duplicate componentId detected (error path): ${finalId}. Resolving with suffix`
        );
        let counter = 1;
        while (this.completed.has(`${componentId}__dup_${counter}`)) {
          counter++;
        }
        finalId = `${componentId}__dup_${counter}`;
      }
      const fallbackComponent = __spreadProps(__spreadValues({}, component), { updateStatus: "checked" });
      this.completed.set(finalId, fallbackComponent);
      this.processedCount++;
      console.error(
        `[UpdateQueue] Component ${component.name} processed with error. Progress: ${this.processedCount}/${this.totalComponents}`
      );
    } finally {
      this.processing.delete(componentId);
    }
  }
  /**
   * Notify completion and return results
   */
  notifyCompletion() {
    const buttonCount = Array.from(this.completed.values()).filter((c) => (c.name || "").toLowerCase().includes("button")).length;
    if (this.completed.size !== this.totalComponents || this.processedCount !== this.totalComponents) {
      console.error(
        `[UpdateQueue] INTEGRITY MISMATCH: completed (${this.completed.size}) or processed (${this.processedCount}) != total (${this.totalComponents})`
      );
    } else {
      console.log("[UpdateQueue] INTEGRITY OK: counts are consistent");
    }
    const completedComponents = Array.from(this.completed.values()).map(
      (component) => __spreadProps(__spreadValues({}, component), {
        // Ensure all properties are copied explicitly
        libraryComponentVersion: component.libraryComponentVersion,
        libraryComponentVersionMinimal: component.libraryComponentVersionMinimal,
        libraryComponentId: component.libraryComponentId,
        libraryComponentName: component.libraryComponentName,
        libraryComponentSetName: component.libraryComponentSetName,
        isOutdated: component.isOutdated,
        isNotLatest: component.isNotLatest,
        isLost: component.isLost,
        isDeprecated: component.isDeprecated
      })
    );
    console.log(`[UpdateQueue] COMPLETED COMPONENTS BEFORE CALLBACK (${completedComponents.length}):`);
    completedComponents.forEach((comp, index) => {
      console.log(`  [${index}]: ${comp.name} - hasLibraryVersion: ${!!comp.libraryComponentVersion}, libraryVersion: ${comp.libraryComponentVersion}`);
    });
    const results = {
      instances: completedComponents,
      counts: {
        components: completedComponents.length,
        icons: completedComponents.filter((c) => c.isIcon).length
      }
    };
    const componentsWithVersions = results.instances.filter(
      (c) => c.libraryComponentVersion || c.libraryComponentVersionMinimal
    );
    if (componentsWithVersions.length > 0) {
      console.log(`[UpdateQueue] Sample component with versions:`, {
        name: componentsWithVersions[0].name,
        libraryComponentVersion: componentsWithVersions[0].libraryComponentVersion,
        libraryComponentVersionMinimal: componentsWithVersions[0].libraryComponentVersionMinimal
      });
    }
    const callbackToCall = this.onCompleteCallback;
    this.reset();
    if (callbackToCall) {
      callbackToCall(results);
    }
  }
  /**
   * Reset queue state
   */
  reset() {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.seenIds.clear();
    this.totalComponents = 0;
    this.processedCount = 0;
    this.activeBatchesCount = 0;
    this.isRunning = false;
  }
  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      total: this.totalComponents,
      isRunning: this.isRunning
    };
  }
  /**
   * Stop processing (graceful shutdown)
   */
  async stop() {
    this.isRunning = false;
    while (this.processing.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.reset();
  }
  /**
   * Clear queue state without stopping processing
   */
  clear() {
    console.log("[UpdateQueue] Clearing queue state");
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.seenIds.clear();
    this.totalComponents = 0;
    this.processedCount = 0;
    this.activeBatchesCount = 0;
    this.isRunning = false;
  }
};
var globalUpdateQueue = null;
var getUpdateQueue = () => {
  if (!globalUpdateQueue) {
    globalUpdateQueue = new UpdateQueue({
      batchSize: 5,
      maxConcurrent: 3,
      progressUpdateInterval: 1e3
    });
  }
  return globalUpdateQueue;
};
var resetUpdateQueue = () => {
  if (globalUpdateQueue) {
    globalUpdateQueue.stop();
    globalUpdateQueue = null;
  }
};

// src/js/component/processNodeComponent.ts
var processNodeComponent = async (node, componentsResult2) => {
  const isButtonComponent = node.name.toLowerCase().includes("button");
  if (isButtonComponent) {
    console.log(`[processNodeComponent] BUTTON COMPONENT - \u041D\u0430\u0447\u0430\u043B\u043E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438:`, {
      id: node.id,
      type: node.type,
      name: node.name,
      hasParent: !!node.parent
    });
  }
  let mainComponent = null;
  if (node.type === "INSTANCE") {
    try {
      mainComponent = await retryGetMainComponent(node, node.name);
    } catch (error) {
      console.error(`[processNodeComponent] \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438 mainComponent \u0434\u043B\u044F ${node.name} \u043F\u043E\u0441\u043B\u0435 \u0432\u0441\u0435\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A:`, error);
      figma.ui.postMessage({
        type: "error",
        message: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C mainComponent \u0434\u043B\u044F ${node.name} \u043F\u043E\u0441\u043B\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A: ${error.message}`
      });
      return null;
    }
  } else if (node.type === "COMPONENT") {
    mainComponent = node;
  }
  let name = node.name;
  const descriptionDataMain = await getDescription(mainComponent || node);
  let parentComponentName = null;
  if (node.type === "COMPONENT_SET") {
    const results = [];
    const setData = await processComponentSetNode(node);
    if (setData) {
    }
    if ("children" in node) {
      for (const child of node.children) {
        const childResults = await processNodeComponent(child, componentsResult2);
        if (childResults) {
          if (Array.isArray(childResults)) {
            results.push(...childResults);
          } else {
            results.push(childResults);
          }
        }
      }
    }
    console.log("COMPONENT_SET recursive results:", results);
    return results;
  }
  let mainComponentName = mainComponent ? mainComponent.name : null;
  let mainComponentKey = mainComponent ? mainComponent.key : null;
  let isNested = false;
  let parent = node.parent;
  while (parent) {
    if (parent.type === "INSTANCE") {
      isNested = true;
      break;
    }
    parent = parent.parent;
  }
  let componentKeyToUse = mainComponent ? mainComponent.key : null;
  let mainComponentSetKey = null;
  let mainComponentSetName = null;
  let mainComponentSetId = null;
  if (mainComponent && mainComponent.parent && mainComponent.parent.type === "COMPONENT_SET") {
    componentKeyToUse = mainComponent.parent.key;
    mainComponentSetName = mainComponent.parent.name;
    mainComponentSetKey = mainComponent.parent.key;
    mainComponentSetId = mainComponent.parent.id;
  } else if (mainComponent) {
  }
  parentComponentName = await getParentComponentName(node);
  if ((node.type === "INSTANCE" || node.type === "COMPONENT") && typeof name === "string" && name.trim() !== "") {
    const width = Math.round(node.width);
    const height = Math.round(node.height);
    const dimensionsMatch = width === height;
    const nameStartsWithNumber = /^\d+/.test(name);
    const hasSlashAfterNumber = /^\d+\s\//.test(name);
    const hasNumberTextSlashPattern = /^\d+\s.+\s\/\s/.test(name);
    const isIcon = dimensionsMatch && (nameStartsWithNumber && hasSlashAfterNumber || hasNumberTextSlashPattern);
    let pluginDataKey = "";
    let pluginDataVersion = "";
    try {
      pluginDataKey = node.getPluginData("customKey") || "";
      pluginDataVersion = node.getPluginData("customVersion") || "";
      if (node.type === "INSTANCE" && mainComponent && !pluginDataKey) {
        pluginDataKey = mainComponent.getPluginData("customKey") || "";
      }
    } catch (error) {
      console.error(`\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438 PluginData \u0434\u043B\u044F ${node.name}:`, error);
    }
    let parent2 = node.parent;
    if (!mainComponent) {
      console.warn(`[processNodeComponent] mainComponent is null for node ${node.name}, skipping.`);
      return null;
    }
    const componentData = {
      isLost: false,
      isDeprecated: false,
      isOutdated: false,
      isNotLatest: false,
      checkVersion: "false",
      type: node.type,
      // Тип узла
      name: name.trim(),
      // Имя узла (без лишних пробелов)
      nodeId: node.id,
      // ID узла
      key: node.key,
      // Ключ узла
      description: descriptionDataMain == null ? void 0 : descriptionDataMain.description,
      // Описание из descriptionDataMain
      nodeVersion: descriptionDataMain ? descriptionDataMain.nodeVersion : void 0,
      // Версия из описания из descriptionDataMain
      hidden: checkIsNodeOrParentHidden(node),
      // Статус скрытия
      remote: mainComponent.remote,
      // Является ли локальным компонентом
      parentName: parentComponentName ? parentComponentName : null,
      // Имя родительского компонента (если вложен в инстанс)
      parentId: parent2 ? parent2.id : null,
      // ID родителя
      mainComponentName,
      // Имя главного компонента или набора
      mainComponentKey,
      // Ключ главного компонента или набора
      mainComponentId: mainComponent.id,
      // ID самого главного компонента
      mainComponentSetKey: mainComponentSetKey ? mainComponentSetKey : null,
      // Ключ набора компонентов (если есть)
      mainComponentSetName: mainComponentSetName ? mainComponentSetName : null,
      // Имя набора компонентов (если есть)
      mainComponentSetId: mainComponentSetId ? mainComponentSetId : null,
      // Имя набора компонентов (если есть)
      isIcon,
      // Является ли иконкой
      size: isIcon ? width : `${width}x${height}`,
      // Размер (для иконок - одна сторона, для других - ШxВ)
      isNested,
      // Является ли вложенным инстансом
      skipUpdate: isNested,
      // Пропускать ли проверку обновления для вложенных инстансов
      pluginDataKey,
      // Пользовательский ключ из PluginData
      updateStatus: "checking",
      // Инициализируем поля версий библиотеки как null (будут обновлены в updateQueue)
      libraryComponentVersion: null,
      libraryComponentVersionMinimal: null,
      libraryComponentName: null,
      libraryComponentSetName: null,
      libraryComponentId: null
    };
    const updateQueue = getUpdateQueue();
    console.log(`[processNodeComponent] \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u044C:`, {
      name: componentData.name,
      type: componentData.type,
      mainComponentKey: componentData.mainComponentKey,
      mainComponentName: componentData.mainComponentName,
      skipUpdate: componentData.skipUpdate,
      isNested: componentData.isNested
    });
    if (!componentData.mainComponentKey) {
      console.warn(`[processNodeComponent] \u041F\u0420\u041E\u041F\u0423\u0429\u0415\u041D - \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 mainComponentKey \u0434\u043B\u044F:`, {
        name: componentData.name,
        type: componentData.type,
        nodeId: componentData.nodeId,
        mainComponent: mainComponent ? {
          name: mainComponent.name,
          key: mainComponent.key,
          id: mainComponent.id
        } : "null"
      });
    }
    updateQueue.addComponent(componentData);
    console.log(`[processNodeComponent] \u0421\u0442\u0430\u0442\u0443\u0441 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 \u043F\u043E\u0441\u043B\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F:`, updateQueue.getStatus());
    if (componentData && (node.type === "INSTANCE" || node.type === "COMPONENT")) {
      if (Array.isArray(componentsResult2.instances)) {
        componentsResult2.instances.push(componentData);
        componentsResult2.counts.components = (componentsResult2.counts.components || 0) + 1;
        if (componentData.isIcon) {
          componentsResult2.counts.icons = (componentsResult2.counts.icons || 0) + 1;
        }
        if (isButtonComponent) {
          console.log(`[processNodeComponent] BUTTON COMPONENT - \u0423\u0441\u043F\u0435\u0448\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442:`, {
            name: componentData.name,
            type: componentData.type,
            nodeId: componentData.nodeId,
            mainComponentName: componentData.mainComponentName,
            totalInstancesNow: componentsResult2.instances.length
          });
        }
      } else {
        console.error("componentsResult.instances is not an array:", componentsResult2.instances);
      }
    }
    return componentData;
  }
  return null;
};
var processComponentSetNode = async (node, parentSet = null) => {
  const name = node.name;
  const descriptionDataSet = await getDescription(node);
  if (node.type === "COMPONENT_SET" && typeof name === "string" && name.trim() !== "") {
    const componentSetData = {
      type: node.type,
      // Тип узла (COMPONENT_SET)
      name: name.trim(),
      // Имя набора
      nodeId: node.id,
      // ID набора
      key: node.key,
      // Ключ набора
      description: descriptionDataSet ? descriptionDataSet.description : void 0,
      // Описание набора
      nodeVersion: descriptionDataSet ? descriptionDataSet.nodeVersion : void 0,
      // Версия из описания набора
      hidden: checkIsNodeOrParentHidden(node),
      // Статус скрытия
      remote: node.remote,
      // Является ли локальным набором
      parentName: parentSet ? parentSet.name : null,
      // Имя родительского набора (если вложен)
      parentId: parentSet ? parentSet.id : null,
      // ID родительского набора
      //mainComponentName: name, // Имя главного компонента (для набора это его собственное имя)
      //mainComponentKey: node.key, // Для COMPONENT_SET используем его собственный ключ
      //mainComponentId: node.id, // ID самого набора
      isIcon: false,
      // COMPONENT_SET сам по себе не является иконкой
      size: `${Math.round(node.width)}x${Math.round(node.height)}`,
      // Размеры COMPONENT_SET
      isNested: false,
      // COMPONENT_SET не может быть вложенным в инстанс
      skipUpdate: false
      // COMPONENT_SET не обновляется как инстанс
    };
    return componentSetData;
  }
  return null;
};

// src/js/component/processNodeStatistics.ts
var processNodeStatistics = (nodes, nodeName = "Unnamed Selection") => {
  const typeStats = {};
  let totalCount = 0;
  const processedNodes = /* @__PURE__ */ new Set();
  const countNodeTypes = (currentNode) => {
    if (!currentNode || processedNodes.has(currentNode.id)) {
      return;
    }
    processedNodes.add(currentNode.id);
    typeStats[currentNode.type] = (typeStats[currentNode.type] || 0) + 1;
    totalCount++;
    if ("children" in currentNode) {
      currentNode.children.forEach((child) => countNodeTypes(child));
    }
  };
  if (Array.isArray(nodes)) {
    nodes.forEach((node) => countNodeTypes(node));
  } else {
    countNodeTypes(nodes);
  }
  return {
    nodeTypeCounts: typeStats,
    totalNodes: totalCount,
    nodeName
  };
};

// src/js/update/parallelUpdateProcessor.ts
var ParallelUpdateProcessor = class {
  constructor(config = {}) {
    this.isProcessing = false;
    this.processedCount = 0;
    this.totalCount = 0;
    this.config = __spreadValues({
      maxConcurrent: 3,
      batchSize: 5,
      progressUpdateInterval: 1e3
    }, config);
  }
  /**
   * Set progress callback
   */
  onProgress(callback) {
    this.onProgressCallback = callback;
  }
  /**
   * Set completion callback
   */
  onComplete(callback) {
    this.onCompleteCallback = callback;
  }
  /**
   * Process all components in the update queue
   */
  async processAll() {
    if (this.isProcessing) {
      throw new Error("Processor is already running");
    }
    this.isProcessing = true;
    this.processedCount = 0;
    try {
      const updateQueue = getUpdateQueue();
      const status = updateQueue.getStatus();
      this.totalCount = status.total;
      if (this.totalCount === 0) {
        return {
          instances: [],
          counts: {
            components: 0,
            icons: 0
          }
        };
      }
      return new Promise((resolve, reject) => {
        updateQueue.onProgress(async (processed, total, component) => {
          this.processedCount = processed;
          if (this.onProgressCallback) {
            await this.onProgressCallback(processed, total, component == null ? void 0 : component.name);
          }
        });
        updateQueue.onComplete((results) => {
          this.isProcessing = false;
          if (this.onCompleteCallback) {
            this.onCompleteCallback(results);
          }
          resolve(results);
        });
        updateQueue.startProcessingManually();
      });
    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }
  /**
   * Stop processing
   */
  async stop() {
    if (!this.isProcessing) {
      return;
    }
    const updateQueue = getUpdateQueue();
    await updateQueue.stop();
    this.isProcessing = false;
  }
  /**
   * Get current processing status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      processed: this.processedCount,
      total: this.totalCount,
      progress: this.totalCount > 0 ? this.processedCount / this.totalCount * 100 : 0
    };
  }
};
var globalProcessor = null;
var getParallelUpdateProcessor = () => {
  if (!globalProcessor) {
    globalProcessor = new ParallelUpdateProcessor({
      maxConcurrent: 3,
      batchSize: 5,
      progressUpdateInterval: 1e3
    });
  }
  return globalProcessor;
};

// src/js/index.ts
if (typeof window !== "undefined") {
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const err = event.reason;
      console.error("Global unhandledrejection:", err);
      const errMessage = err instanceof Error ? err.message : String(err);
      if (/wasm|memory|out of bounds|null function|function signature mismatch/i.test(
        errMessage
      )) {
        figma.notify(
          "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u043C\u044F\u0442\u0438 Figma API. \u041F\u043B\u0430\u0433\u0438\u043D \u0431\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D."
        );
        setTimeout(
          () => figma.closePlugin(
            "\u041F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 WebAssembly. \u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043B\u0430\u0433\u0438\u043D."
          ),
          15e3
        );
      } else {
        figma.ui.postMessage({
          type: "error",
          message: `Unhandled Rejection: ${errMessage}`
        });
      }
    }
  );
  window.addEventListener("error", (event) => {
    const err = event.error;
    console.error("Global error:", err);
    const errMessage = err instanceof Error ? err.message : String(err);
    if (/wasm|memory|out of bounds|null function|function signature mismatch/i.test(
      errMessage
    )) {
      figma.notify(
        "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u043C\u044F\u0442\u0438 Figma API. \u041F\u043B\u0430\u0433\u0438\u043D \u0431\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D."
      );
      setTimeout(
        () => figma.closePlugin(
          "\u041F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 WebAssembly. \u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043B\u0430\u0433\u0438\u043D."
        ),
        15e3
      );
    } else {
      figma.ui.postMessage({
        type: "error",
        message: `Error: ${errMessage}`
      });
    }
  });
}
figma.showUI(__html__, { width: 500, height: 800 });
var currentUser = figma.currentUser;
var _a;
if (currentUser) {
  figma.ui.postMessage({
    type: "user-info",
    user: {
      name: (_a = currentUser.name) != null ? _a : "",
      id: currentUser.id
    }
  });
}
var splashScreenCombinations = [
  {
    imageUrl: "https://downloader.disk.yandex.ru/preview/9f312e965a5cb62de3b834fbdbec01be8981c981359610a3e7c562f55be0f4ee/68686aa6/6M6Ljd-rK85c-sAIgPYzKWBKgOuPSPDx-IDf2mqBKp1t-o7e2PHljEgnQMWzjYVuTVsd2JaL-44X0Lx4c19FNw%3D%3D?uid=0&filename=pionerka.jpeg&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&size=2048x2048",
    titleText: "\u0414\u0438\u0437\u0430\u0439\u043D\u0435\u0440, \u043A \u0431\u043E\u0440\u044C\u0431\u0435 \u0437\u0430 \u043F\u043E\u0431\u0435\u0434\u0443 \u0432\u0441\u0435\u043E\u0431\u0449\u0435\u0439 \u043A\u043E\u043D\u0441\u0438\u0441\u0442\u0435\u043D\u0442\u043D\u043E\u0441\u0442\u0438 \u0431\u0443\u0434\u044C \u0433\u043E\u0442\u043E\u0432!",
    buttonText: "\u0412\u0441\u0435\u0433\u0434\u0430 \u0433\u043E\u0442\u043E\u0432!"
  },
  {
    imageUrl: "https://downloader.disk.yandex.ru/preview/97f205f91c4e6f96d4f1e89a90d47d476150b4d42ca3cbae2d3c326fb55ab3d0/68686a3d/se5BT60CXEEZWaCAmUtuG9a9f1ieqLEJ2CEJi7gCW4vo8WdCc-b_a2j9gNNYpsGainQW_fPnHiz5W9XoI-cRwQ%3D%3D?uid=0&filename=gagarin.jpg&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&size=2048x2048",
    // Example 2 image
    titleText: "\u041D\u0443 \u043A\u0430\u043A \u0432\u044B \u0442\u0430\u043C \u043F\u043E\u0442\u043E\u043C\u043A\u0438, \u0442\u0435\u043F\u0435\u0440\u044C \u0432\u0430\u043C AI \u043C\u0430\u043A\u0435\u0442\u044B \u0440\u0438\u0441\u0443\u0435\u0442?",
    buttonText: "\u042E\u0440\u0430, \u043C\u044B \u0432\u0441\u0451 \u0440\u0430\u0437\u0434\u0435\u0442\u0430\u0447\u0438\u043B\u0438"
  },
  {
    imageUrl: "https://downloader.disk.yandex.ru/preview/654e2ed50e413289aebd69772e5bf9004956b4ede643f359899c953a6f95cb12/68686adc/DSpXFN1MCoNBFH847La1OcdcOcVWJOdVaM8ulDYd8ldqIYYRgpZNiCjFmG_dfAH83IWKf2Y5r7NSiKBmC1y1SQ%3D%3D?uid=0&filename=rocket.jpg&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&size=2048x2048",
    // Example 3 image
    titleText: "\u041B\u044E\u0434\u0438 \u0440\u0430\u043A\u0435\u0442\u044B \u043D\u0430 \u041C\u0430\u0440\u0441 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0442, \u0430 \u0432\u044B \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442\u0435",
    buttonText: "\u041C\u043E\u0436\u0435\u043C!"
  }
];
var userSplashSettings = {
  // 'USER_ID_EXAMPLE_1': 0, // Assign first combination to this user
  // 'USER_ID_EXAMPLE_2': 1, // Assign second combination to this user
};
var selectedSplashData;
if (currentUser == null ? void 0 : currentUser.id) {
  const userSettingIndex = userSplashSettings[currentUser.id];
  if (typeof userSettingIndex === "number" && splashScreenCombinations[userSettingIndex]) {
    selectedSplashData = splashScreenCombinations[userSettingIndex];
  } else {
    const randomIndex = Math.floor(
      Math.random() * splashScreenCombinations.length
    );
    selectedSplashData = splashScreenCombinations[randomIndex];
  }
}
if (selectedSplashData) {
  figma.ui.postMessage({
    type: "splash-data",
    data: selectedSplashData
  });
}
var lastColorsData = null;
var totalStatsList = [];
var publishStatusCache = /* @__PURE__ */ new Map();
var componentsResult = {
  instances: [],
  counts: {
    components: 0,
    icons: 0
  }
};
var colorsResult = {
  instances: [],
  uniqueColors: /* @__PURE__ */ new Set(),
  totalUsage: 0
};
var colorsResultStroke = {
  instances: [],
  uniqueColors: /* @__PURE__ */ new Set(),
  totalUsage: 0
};
figma.ui.onmessage = async (msg) => {
  var _a2, _b, _c;
  console.log("\u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442 UI:", msg.type);
  if (msg.type === "resize") {
    figma.ui.resize(msg.width, msg.height);
  }
  if (msg.type === "check-all") {
    console.log("[INDEX] check-all handler started");
    console.log("[INDEX] [check-all] \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441 Figma...");
    if (!await checkFigmaConnection()) {
      console.warn(
        "[check-all] \u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 Figma \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E, \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F..."
      );
      figma.ui.postMessage({
        type: "connection-waiting",
        message: "\u041F\u0440\u043E\u0431\u043B\u0435\u043C\u044B \u0441 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435\u043C. \u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F..."
      });
      const connectionRestored = await waitForConnection(3e4);
      if (!connectionRestored) {
        figma.ui.postMessage({
          type: "error",
          message: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 Figma. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435."
        });
        return;
      }
      console.log("[check-all] \u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 Figma \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E.");
      figma.ui.postMessage({
        type: "progress-update",
        processed: 0,
        total: 0,
        phase: "analysis-start",
        currentComponentName: "\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E. \u041D\u0430\u0447\u0438\u043D\u0430\u0435\u043C \u0430\u043D\u0430\u043B\u0438\u0437..."
      });
    }
    clearUpdateCache();
    clearRgbToHexCache();
    publishStatusCache.clear();
    console.log("\u0412\u0441\u0435 \u043A\u044D\u0448\u0438 \u043E\u0447\u0438\u0449\u0435\u043D\u044B \u043F\u0435\u0440\u0435\u0434 \u043D\u043E\u0432\u044B\u043C \u043F\u043E\u0438\u0441\u043A\u043E\u043C.");
    const startTime = Date.now();
    const selection = figma.currentPage.selection;
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0440\u0435\u0439\u043C, \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442 \u0438\u043B\u0438 \u0438\u043D\u0441\u0442\u0430\u043D\u0441!"
      });
      return;
    }
    const uniqueNodesToProcess = /* @__PURE__ */ new Set();
    totalStatsList.length = 0;
    for (const selectedNode of selection) {
      uniqueNodesToProcess.add(selectedNode);
      if ("findAll" in selectedNode && typeof selectedNode.findAll === "function") {
        const nodeStats = processNodeStatistics(
          selectedNode,
          selectedNode.name
        );
        totalStatsList.push(nodeStats);
        try {
          const allDescendants = selectedNode.findAll();
          allDescendants.forEach((descendant) => {
            if (descendant && descendant.type !== "PAGE" && "visible" in descendant) {
              uniqueNodesToProcess.add(descendant);
            }
          });
        } catch (err) {
          console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0432\u044B\u0437\u043E\u0432\u0435 findAll:", err, selectedNode);
        }
      }
    }
    const nodesToProcess = Array.from(uniqueNodesToProcess);
    if (nodesToProcess.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "\u0412 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u043D\u0435\u0442 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0437\u0430."
      });
      return;
    }
    componentsResult = {
      instances: [],
      // Массив для данных инстансов/компонентов
      counts: {
        // Счетчики по типам
        components: 0,
        icons: 0
      }
    };
    resetUpdateQueue();
    colorsResult = {
      instances: [],
      // Массив для данных цветов заливки
      uniqueColors: /* @__PURE__ */ new Set(),
      totalUsage: 0
    };
    colorsResultStroke = {
      instances: [],
      // Массив для данных цветов обводки
      uniqueColors: /* @__PURE__ */ new Set(),
      totalUsage: 0
    };
    const updateQueue = getUpdateQueue();
    updateQueue.clear();
    try {
      let buildComponentTree2 = function(node) {
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          children: "children" in node ? node.children.map(buildComponentTree2) : []
        };
      };
      var buildComponentTree = buildComponentTree2;
      await updateProgress(
        "processing",
        0,
        nodesToProcess.length,
        "\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432"
      );
      const processNodeSafely = async (node, index) => {
        if (!node || !node.type) {
          console.warn(`[${index + 1}] \u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D \u043D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 \u0443\u0437\u0435\u043B:`, node);
          return;
        }
        try {
          let hasColor = false;
          try {
            hasColor = hasFillOrStroke(node);
          } catch (err) {
            console.error(
              `[${index + 1}] ERROR in hasFillOrStroke:`,
              err instanceof Error ? err.message : String(err)
            );
          }
          if (hasColor) {
            try {
              await processNodeColors(node, colorsResult, colorsResultStroke);
            } catch (err) {
              console.error(
                `[${index + 1}] ERROR in processNodeColors:`,
                err instanceof Error ? err.message : String(err)
              );
            }
          }
          if (node.type === "INSTANCE" || node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
            console.log(`[processNodeSafely] \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u0443\u0437\u0435\u043B \u0442\u0438\u043F\u0430 ${node.type}:`, {
              name: node.name,
              id: node.id,
              type: node.type,
              index: index + 1
            });
            try {
              await processNodeComponent(
                node,
                componentsResult
              );
            } catch (err) {
              console.error(
                `[${index + 1}] ERROR in processNodeComponent:`,
                err
              );
            }
          } else {
            console.log(`[processNodeSafely] \u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D \u0443\u0437\u0435\u043B \u0442\u0438\u043F\u0430 ${node.type}:`, {
              name: node.name,
              id: node.id,
              type: node.type,
              index: index + 1
            });
          }
        } catch (error) {
          console.error(`[${index + 1}] \u041E\u0448\u0438\u0431\u043A\u0430 \u043D\u0430 \u044D\u0442\u0430\u043F\u0435 \u043B\u043E\u0433\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F:`, error);
        }
      };
      const nodeTypeStats = nodesToProcess.reduce((stats, node) => {
        stats[node.type] = (stats[node.type] || 0) + 1;
        return stats;
      }, {});
      console.log(`[DEBUG] \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0443\u0437\u043B\u043E\u0432 \u0434\u043B\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438:`, {
        total: nodesToProcess.length,
        byType: nodeTypeStats
      });
      for (let i = 0; i < nodesToProcess.length; i++) {
        await processNodeSafely(nodesToProcess[i], i);
        if (i % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          await updateProgress(
            "processing",
            i + 1,
            nodesToProcess.length,
            "\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432",
            nodesToProcess[i].name
          );
        }
      }
      const finalUpdateQueue = getUpdateQueue();
      const finalQueueStatus = finalUpdateQueue.getStatus();
      console.log(`[DEBUG] \u0424\u0438\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 \u043F\u043E\u0441\u043B\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0432\u0441\u0435\u0445 \u0443\u0437\u043B\u043E\u0432:`, {
        queueLength: finalQueueStatus.queueLength,
        total: finalQueueStatus.total,
        processing: finalQueueStatus.processing,
        completed: finalQueueStatus.completed,
        isRunning: finalQueueStatus.isRunning,
        componentsResultCount: componentsResult.instances.length
      });
      const queueTotalComponents = finalQueueStatus.total;
      const instancesCount = componentsResult.instances.length;
      console.log(`[CRITICAL DEBUG] \u0410\u041D\u0410\u041B\u0418\u0417 \u041F\u041E\u0422\u0415\u0420\u0418 \u0414\u0410\u041D\u041D\u042B\u0425:`, {
        totalProcessedNodes: nodesToProcess.length,
        queueTotalComponents,
        componentsInResult: instancesCount,
        buttonComponentsInResult: componentsResult.instances.filter((comp) => comp.name.toLowerCase().includes("button")).length,
        queueSize: finalQueueStatus.queueLength,
        // Потери считаем относительно общего количества компонентов, попавших в очередь, а не относительно всех узлов страницы
        lossPercentageByQueue: queueTotalComponents > 0 ? ((queueTotalComponents - instancesCount) / queueTotalComponents * 100).toFixed(2) + "%" : "0%"
      });
      const componentTypeAnalysis = componentsResult.instances.reduce((acc, comp) => {
        acc[comp.type] = (acc[comp.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`[CRITICAL DEBUG] \u0422\u0438\u043F\u044B \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0435:`, componentTypeAnalysis);
      const buttonComponents = componentsResult.instances.filter((comp) => comp.name.toLowerCase().includes("button"));
      if (buttonComponents.length > 0) {
        console.log(
          `[CRITICAL DEBUG] \u041D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 button \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B:`,
          buttonComponents.slice(0, 5).map((comp) => ({
            name: comp.name,
            type: comp.type,
            nodeId: comp.nodeId,
            mainComponentName: comp.mainComponentName
          }))
        );
      } else {
        console.log(`[CRITICAL DEBUG] \u041F\u0420\u041E\u0411\u041B\u0415\u041C\u0410: \u041A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B button \u041D\u0415 \u041D\u0410\u0419\u0414\u0415\u041D\u042B \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0435!`);
      }
      componentsResult.instances.sort((a, b) => {
        const aName = a.mainComponentName || a.name;
        const bName = b.mainComponentName || b.name;
        const removeEmoji = (str) => str.replace(
          /([\u0023-\u0039]\uFE0F?\u20E3|\u00A9|\u00AE|[\u2000-\u3300]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])/gu,
          ""
        ).trim();
        const startsWithSpecial = (str) => /^[._]/.test(str);
        const cleanA = removeEmoji(aName);
        const cleanB = removeEmoji(bName);
        const aSpecial = startsWithSpecial(cleanA);
        const bSpecial = startsWithSpecial(cleanB);
        if (aSpecial && !bSpecial) return 1;
        if (!aSpecial && bSpecial) return -1;
        return cleanA.localeCompare(cleanB);
      });
      lastColorsData = colorsResult;
      const updateQueue2 = getUpdateQueue();
      const queueStatus = updateQueue2.getStatus();
      console.log("[INDEX] Queue status:", queueStatus);
      console.log("[INDEX] Components in queue:", queueStatus.total);
      if (queueStatus.total > 0) {
        await updateProgress(
          "processing",
          0,
          queueStatus.total,
          "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432"
        );
        const processor = getParallelUpdateProcessor();
        const updateQueue3 = getUpdateQueue();
        processor.onProgress(
          async (processed, total, componentName) => {
            await updateProgress(
              "processing",
              processed,
              total,
              "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432",
              componentName
            );
          }
        );
        const results = await processor.processAll();
        const updatedComponentsMap = /* @__PURE__ */ new Map();
        results.instances.forEach((updatedComponent) => {
          const key = `${updatedComponent.mainComponentKey || "unknown"}_$$${updatedComponent.nodeId || "no-node"}`;
          updatedComponentsMap.set(key, updatedComponent);
        });
        console.log("[INDEX] Updated components map keys:", Array.from(updatedComponentsMap.keys()));
        let matchedCount = 0;
        let unmatchedKeys = [];
        componentsResult.instances = componentsResult.instances.map((existingComponent) => {
          const key = `${existingComponent.mainComponentKey || "unknown"}_$$${existingComponent.nodeId || "no-node"}`;
          const updatedComponent = updatedComponentsMap.get(key);
          if (updatedComponent) {
            matchedCount++;
            console.log(`[INDEX] MATCHED: ${existingComponent.name} with key: ${key}`);
            return __spreadProps(__spreadValues({}, existingComponent), {
              isOutdated: updatedComponent.isOutdated,
              isLost: updatedComponent.isLost,
              isDeprecated: updatedComponent.isDeprecated,
              isNotLatest: updatedComponent.isNotLatest,
              checkVersion: updatedComponent.checkVersion,
              libraryComponentVersion: updatedComponent.libraryComponentVersion,
              libraryComponentVersionMinimal: updatedComponent.libraryComponentVersionMinimal,
              libraryComponentName: updatedComponent.libraryComponentName,
              libraryComponentSetName: updatedComponent.libraryComponentSetName,
              libraryComponentId: updatedComponent.libraryComponentId,
              updateStatus: updatedComponent.updateStatus
            });
          } else {
            unmatchedKeys.push(key);
            console.log(`[INDEX] NO MATCH: ${existingComponent.name} with key: ${key}`);
          }
          return existingComponent;
        });
        console.log(`[INDEX] Unmatched keys (${unmatchedKeys.length}):`, unmatchedKeys.slice(0, 10));
        console.log("[INDEX] After updating components:", {
          originalCount: results.instances.length,
          finalCount: componentsResult.instances.length,
          updatedComponentsCount: updatedComponentsMap.size,
          matchedCount,
          componentsWithLibraryVersions: componentsResult.instances.filter(
            (c) => c.libraryComponentVersion || c.libraryComponentVersionMinimal
          ).length
        });
        console.log("[INDEX] Received results from processor:", results);
        console.log(
          "[INDEX] Results instances count:",
          results.instances.length
        );
        if (results.instances.length > 0) {
          console.log("[INDEX] First instance data:", results.instances[0]);
          console.log(
            "[INDEX] First instance libraryComponentVersion:",
            results.instances[0].libraryComponentVersion
          );
          console.log(
            "[INDEX] First instance isOutdated:",
            results.instances[0].isOutdated
          );
          console.log(
            "[INDEX] First instance updateStatus:",
            results.instances[0].updateStatus
          );
        }
        const statusAfter = updateQueue3.getStatus();
        console.log("[INTEGRITY] Queue status after processing:", statusAfter);
        const expectedTotal = statusAfter.total;
        const received = results.instances.length;
        if (expectedTotal !== received) {
          console.warn("[INTEGRITY] \u041D\u0435\u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u043C\u0435\u0436\u0434\u0443 \u043E\u0447\u0435\u0440\u0435\u0434\u044C\u044E \u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u043C", {
            expectedTotal,
            received,
            delta: expectedTotal - received
          });
        } else {
          console.log("[INTEGRITY] \u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043E \u043C\u0435\u0436\u0434\u0443 \u043E\u0447\u0435\u0440\u0435\u0434\u044C\u044E \u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u043C");
        }
      }
      console.log("Final components result:", {
        total: componentsResult.instances.length,
        components: componentsResult.counts.components,
        icons: componentsResult.counts.icons,
        instances: componentsResult.instances
      });
      let componentTree = [];
      if (figma.currentPage.selection && figma.currentPage.selection.length > 0) {
        componentTree = figma.currentPage.selection.map(buildComponentTree2);
      } else {
        figma.notify("\u041D\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F \u0434\u0435\u0440\u0435\u0432\u0430.");
      }
      let executionTime = Date.now() - startTime;
      componentsResult.executionTime = executionTime;
      console.log(`\u0412\u0440\u0435\u043C\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043F\u0440\u043E\u0441\u0430 check-all: ${executionTime}ms`);
      const totalStats = processNodeStatistics(selection, "Total");
      figma.ui.postMessage({
        type: "display-total",
        data: {
          overallStats: totalStats,
          totalCount: totalStats.totalNodes
          // Добавляем общее количество явно
        }
      });
      console.log(
        "[INDEX] Sending all-results to UI with components:",
        componentsResult.instances.length
      );
      if (componentsResult.instances.length > 0) {
        console.log(
          "[INDEX] Final libraryComponentVersion:",
          componentsResult.instances.map((item) => item.libraryComponentVersion)
        );
        console.log(
          "[INDEX] Final first instance isOutdated:",
          componentsResult.instances[0].isOutdated
        );
        console.log(
          "[INDEX] Final first instance updateStatus:",
          componentsResult.instances[0].updateStatus
        );
      }
      console.log("[INDEX] BEFORE UI SEND - componentsResult structure:", {
        instancesCount: componentsResult.instances.length,
        firstInstanceKeys: componentsResult.instances.length > 0 ? Object.keys(componentsResult.instances[0]) : [],
        firstInstanceLibraryVersion: componentsResult.instances.length > 0 ? componentsResult.instances[0].libraryComponentVersion : "NO_INSTANCES",
        componentsResultReference: componentsResult
      });
      figma.ui.postMessage({
        type: "all-results",
        components: componentsResult,
        colors: colorsResult,
        colorsStroke: colorsResultStroke,
        componentTree,
        totalStats
        // Включаем статистику и в этом сообщении для синхронизации
      });
      console.log("[INDEX] AFTER UI SEND - data still intact:", {
        instancesCount: componentsResult.instances.length,
        firstInstanceLibraryVersion: componentsResult.instances.length > 0 ? componentsResult.instances[0].libraryComponentVersion : "NO_INSTANCES"
      });
    } catch (error) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435:", error);
      const errMessage = error instanceof Error ? error.message : String(error);
      figma.notify(`\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435: ${errMessage}`);
      figma.ui.postMessage({
        type: "error",
        message: `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435: ${errMessage}`
      });
      return;
    }
  } else if (msg.type === "scroll-to-node") {
    (async () => {
      try {
        const nodeId = msg.nodeId;
        let node = null;
        try {
          node = await figma.getNodeByIdAsync(nodeId);
        } catch (err) {
          console.error("[PLUGIN] getNodeByIdAsync error:", err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          figma.notify("\u041E\u0448\u0438\u0431\u043A\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0443: " + errorMessage);
          return;
        }
        console.log("[PLUGIN] Node found:", !!node, node);
        if (node && "type" in node && node.type !== "PAGE" && "visible" in node) {
          let page = node.parent;
          while (page && page.type !== "PAGE") page = page.parent;
          if (page && page.id && page.id !== figma.currentPage.id) {
            figma.currentPage = page;
          }
          try {
            figma.viewport.scrollAndZoomIntoView([node]);
            figma.currentPage.selection = [node];
          } catch (err) {
            console.error("\u041E\u0448\u0438\u0431\u043A\u0430 scrollAndZoomIntoView:", err, node);
            figma.notify(
              "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0437\u0438\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: " + (err instanceof Error ? err.message : String(err))
            );
            if (err && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(
              err instanceof Error ? err.message : String(err)
            )) {
              figma.notify(
                "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 Figma API. \u041F\u043B\u0430\u0433\u0438\u043D \u0431\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D."
              );
              setTimeout(
                () => figma.closePlugin(
                  "\u041F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 WebAssembly. \u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043B\u0430\u0433\u0438\u043D."
                ),
                3e3
              );
            }
          }
        } else if (node) {
          console.warn("Node is not a valid SceneNode:", node);
          figma.notify("\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u0438.");
        } else {
          figma.notify("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u0443\u0437\u0435\u043B \u0441 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u043C ID.");
        }
      } catch (criticalErr) {
        console.error("Critical error in scroll-to-node:", criticalErr);
        figma.notify(
          "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u043C: " + (criticalErr instanceof Error ? criticalErr.message : String(criticalErr))
        );
        if (criticalErr && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(
          criticalErr instanceof Error ? criticalErr.message : String(criticalErr)
        )) {
          figma.notify(
            "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 Figma API. \u041F\u043B\u0430\u0433\u0438\u043D \u0431\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D."
          );
          setTimeout(
            () => figma.closePlugin(
              "\u041F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 WebAssembly. \u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043B\u0430\u0433\u0438\u043D."
            ),
            3e3
          );
        }
      }
    })();
  } else if (msg.type === "select-nodes") {
    (async () => {
      const nodeIds = msg.nodeIds;
      if (!nodeIds || nodeIds.length === 0) {
        figma.notify("\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u044B ID \u0443\u0437\u043B\u043E\u0432 \u0434\u043B\u044F \u0432\u044B\u0431\u043E\u0440\u0430");
        return;
      }
      let nodes = [];
      try {
        const foundNodes = await Promise.all(
          nodeIds.map(async (id) => {
            try {
              const n = await figma.getNodeByIdAsync(id);
              return n && "type" in n && n.type !== "PAGE" && "visible" in n ? n : null;
            } catch (err) {
              console.error("\u041E\u0448\u0438\u0431\u043A\u0430 getNodeByIdAsync:", id, err);
              return null;
            }
          })
        );
        nodes = foundNodes.filter((n) => n !== null);
      } catch (err) {
        console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u0438\u0441\u043A\u0435 \u0433\u0440\u0443\u043F\u043F\u044B \u0443\u0437\u043B\u043E\u0432:", err);
        const errMessage = err instanceof Error ? err.message : String(err);
        figma.notify("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u0438\u0441\u043A\u0435 \u0433\u0440\u0443\u043F\u043F\u044B \u0443\u0437\u043B\u043E\u0432: " + errMessage);
        return;
      }
      if (nodes.length === 0) {
        figma.notify("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u043D\u0438 \u043E\u0434\u0438\u043D \u0438\u0437 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u0445 \u0443\u0437\u043B\u043E\u0432");
        return;
      }
      const validNodes = nodes.filter(
        (n) => n && "type" in n && typeof n.visible === "boolean"
      );
      if (validNodes.length === 0) {
        figma.notify("\u041D\u0435\u0442 \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u044F!");
        return;
      }
      figma.currentPage.selection = validNodes;
      figma.viewport.scrollAndZoomIntoView(validNodes);
      figma.notify(`\u0412\u044B\u0431\u0440\u0430\u043D\u043E ${validNodes.length} \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432`);
    })();
  } else if (msg.type === "get-component-data") {
    console.log("\u041F\u043E\u043B\u0443\u0447\u0435\u043D \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0447\u0442\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430");
    const selection = figma.currentPage.selection;
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({
        type: "component-data-result",
        message: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F \u0434\u0430\u043D\u043D\u044B\u0445.",
        isError: true
      });
      return;
    }
    const componentData = {};
    let validComponentsCount = 0;
    for (const node of selection) {
      if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
        validComponentsCount++;
      }
    }
    if (validComponentsCount === 0) {
      figma.ui.postMessage({
        type: "component-data-result",
        message: "\u0412\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0438\u043B\u0438 \u043D\u0430\u0431\u043E\u0440\u043E\u0432 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.",
        isError: true
      });
      return;
    }
    for (const node of selection) {
      if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
        try {
          const customKey = node.getPluginData("customKey") || "";
          const customVersion = node.getPluginData("customVersion") || "";
          componentData[node.id] = {
            name: node.name,
            type: node.type,
            key: customKey,
            version: customVersion,
            // Дополнительно можно добавить оригинальный ключ Figma, если он есть
            originalKey: node.key || null
          };
        } catch (error) {
          console.error(
            `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0447\u0442\u0435\u043D\u0438\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${node.id} (${node.name}):`,
            error
          );
          componentData[node.id] = {
            name: node.name,
            type: node.type,
            error: `\u041E\u0448\u0438\u0431\u043A\u0430 \u0447\u0442\u0435\u043D\u0438\u044F \u0434\u0430\u043D\u043D\u044B\u0445: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
    }
    if (Object.keys(componentData).length > 0) {
      figma.ui.postMessage({
        type: "component-data-result",
        data: componentData
      });
    } else {
      figma.ui.postMessage({
        type: "component-data-result",
        message: "\u0414\u0430\u043D\u043D\u044B\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u0445."
      });
    }
  } else if (msg.type === "set-component-data") {
    try {
      console.log("\u041F\u043E\u043B\u0443\u0447\u0435\u043D \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430:", msg);
      if (!msg.key || !msg.version) {
        console.warn("\u041E\u0448\u0438\u0431\u043A\u0430: \u043A\u043B\u044E\u0447 \u0438\u043B\u0438 \u0432\u0435\u0440\u0441\u0438\u044F \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438", msg);
        figma.ui.postMessage({
          type: "component-data-set",
          message: "\u041A\u043B\u044E\u0447 \u0438 \u0432\u0435\u0440\u0441\u0438\u044F \u043D\u0435 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C\u0438.",
          isError: true
        });
        return;
      }
      const selection = figma.currentPage.selection;
      const { key, version } = msg;
      if (!selection || selection.length === 0) {
        console.warn("\u041D\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445");
        figma.ui.postMessage({
          type: "component-data-set",
          message: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B \u0434\u043B\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445.",
          isError: true
        });
        return;
      }
      let dataSet = false;
      let updatedComponents = 0;
      let validComponentsCount = 0;
      for (const node of selection) {
        if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
          validComponentsCount++;
        }
      }
      if (validComponentsCount === 0) {
        figma.ui.postMessage({
          type: "component-data-set",
          message: "\u0412\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0438\u043B\u0438 \u043D\u0430\u0431\u043E\u0440\u043E\u0432 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.",
          isError: true
        });
        return;
      }
      for (const node of selection) {
        try {
          if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
            node.setPluginData("customKey", key);
            node.setPluginData("customVersion", version);
            console.log(
              `\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${node.id} (${node.type}) (${node.name}): key = ${key}, version = ${version}`
            );
            dataSet = true;
            updatedComponents++;
          } else {
            console.log(
              `\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C \u043D\u043E\u0434 ${node.id} (${node.name}), \u0442\u0430\u043A \u043A\u0430\u043A \u043E\u043D \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u043C \u0438\u043B\u0438 \u043D\u0430\u0431\u043E\u0440\u043E\u043C \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432`
            );
          }
        } catch (error) {
          console.error(
            `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${node.id} (${node.name}):`,
            error
          );
        }
      }
      if (dataSet) {
        figma.ui.postMessage({
          type: "component-data-set",
          message: `\u0414\u0430\u043D\u043D\u044B\u0435 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u0434\u043B\u044F ${updatedComponents} \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.`
        });
      } else {
        figma.ui.postMessage({
          type: "component-data-set",
          message: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.",
          isError: true
        });
      }
    } catch (error) {
      console.error(
        "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430:",
        error
      );
      figma.ui.postMessage({
        type: "component-data-set",
        message: `\u041E\u0448\u0438\u0431\u043A\u0430: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      });
    }
  } else if (msg.type === "clear-component-data") {
    console.log("\u041F\u043E\u043B\u0443\u0447\u0435\u043D \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u043E\u0447\u0438\u0441\u0442\u043A\u0443 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430");
    const selection = figma.currentPage.selection;
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({
        type: "component-data-cleared",
        message: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B \u0434\u043B\u044F \u043E\u0447\u0438\u0441\u0442\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445.",
        isError: true
      });
      return;
    }
    let dataCleared = false;
    let clearedComponents = 0;
    let validComponentsCount = 0;
    for (const node of selection) {
      if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
        validComponentsCount++;
      }
    }
    if (validComponentsCount === 0) {
      figma.ui.postMessage({
        type: "component-data-cleared",
        message: "\u0412\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0438\u043B\u0438 \u043D\u0430\u0431\u043E\u0440\u043E\u0432 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.",
        isError: true
      });
      return;
    }
    for (const node of selection) {
      try {
        if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
          node.setPluginData("customKey", "");
          node.setPluginData("customVersion", "");
          console.log(
            `\u041E\u0447\u0438\u0449\u0435\u043D\u044B \u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${node.id} (${node.type}) (${node.name})`
          );
          dataCleared = true;
          clearedComponents++;
        } else {
        }
      } catch (error) {
        console.error(
          `\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0447\u0438\u0441\u0442\u043A\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${node.id} (${node.name}):`,
          error
        );
      }
    }
    if (dataCleared) {
      figma.ui.postMessage({
        type: "component-data-cleared",
        message: `\u0414\u0430\u043D\u043D\u044B\u0435 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043E\u0447\u0438\u0449\u0435\u043D\u044B \u0434\u043B\u044F ${clearedComponents} \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.`
      });
    } else {
      figma.ui.postMessage({
        type: "component-data-cleared",
        message: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432.",
        isError: true
      });
    }
  } else if (msg.type === "check-updates") {
    console.log("[INDEX] Received update check request");
    console.log("[INDEX] Message data:", msg);
    clearUpdateCache();
    console.log("[INDEX] \u041A\u0435\u0448 \u043E\u0447\u0438\u0449\u0435\u043D \u043F\u0435\u0440\u0435\u0434 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u043E\u0439 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439.");
    let componentsToCheck = null;
    if (msg.components && msg.components.instances) {
      componentsToCheck = msg.components;
    }
    if (!componentsToCheck || !componentsToCheck.instances || !componentsToCheck.instances.length) {
      figma.ui.postMessage({
        type: "error",
        message: "No components to check for updates. Please run a search first."
      });
      return;
    }
    try {
      const processor = getParallelUpdateProcessor();
      const updateQueue = getUpdateQueue();
      updateQueue.clear();
      for (const component of componentsToCheck.instances) {
        updateQueue.addComponent(component);
      }
      processor.onProgress(
        async (processed, total, componentName) => {
          await updateProgress(
            "check-updates",
            processed,
            total,
            "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432",
            componentName
          );
        }
      );
      const results = await processor.processAll();
      componentsToCheck.instances = results.instances;
      componentsToCheck.outdated = results.instances.filter(
        (inst) => inst.isOutdated
      );
      componentsToCheck.lost = results.instances.filter((inst) => inst.isLost);
      componentsToCheck.deprecated = results.instances.filter(
        (inst) => inst.isDeprecated
      );
      if (componentsToCheck.counts) {
        componentsToCheck.counts.outdated = (_a2 = componentsToCheck.outdated) == null ? void 0 : _a2.length;
        componentsToCheck.counts.lost = (_b = componentsToCheck.lost) == null ? void 0 : _b.length;
        componentsToCheck.counts.deprecated = (_c = componentsToCheck.deprecated) == null ? void 0 : _c.length;
      }
      const componentsWithVersions = componentsToCheck.instances.filter(
        (c) => c.libraryComponentVersion || c.libraryComponentVersionMinimal
      );
      console.log(
        `[Index] Components with library versions before sending to UI: ${componentsWithVersions.length}`
      );
      if (componentsWithVersions.length > 0) {
        console.log(`[Index] Sample component with versions before UI:`, {
          name: componentsWithVersions[0].name,
          libraryComponentVersion: componentsWithVersions[0].libraryComponentVersion,
          libraryComponentVersionMinimal: componentsWithVersions[0].libraryComponentVersionMinimal
        });
      }
      figma.ui.postMessage({
        type: "all-results",
        components: componentsToCheck,
        colors: lastColorsData || colorsResult,
        colorsStroke: colorsResultStroke,
        componentTree: [],
        totalStats: { nodeTypeCounts: {}, totalNodes: 0, nodeName: "" }
      });
    } catch (error) {
      console.error("Error during update check:", error);
      figma.ui.postMessage({
        type: "error",
        message: `Error checking for updates: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
};
