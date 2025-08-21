import { getDescription } from "./getDescription";
import { checkIsNodeOrParentHidden } from "../utils/checkIsNodeOrParentHidden";
import { getParentComponentName } from "./getParentComponentName";
import { retryGetMainComponent } from "../utils/retryWithBackoff";
import { getUpdateQueue } from "../update/updateQueue";
import {
  SceneNode,
  ComponentNode,
  ComponentSetNode,
  ComponentData,
  ComponentsResult,
} from "../../shared/types";

/**
 * Обрабатывает компонент или инстанс узла, собирает информацию о нем, его главном компоненте и статусе актуальности.
 * @param {SceneNode} node - Узел (INSTANCE или COMPONENT) для обработки
 * @param {Object} componentsResult - Объект для хранения результатов компонентов
 * @param {Array<Object>} componentsResult.instances - Массив для данных инстансов/компонентов.
 * @param {Object} componentsResult.counts - Счетчики для компонентов.
 * @returns {Promise<Object|null>} Объект с данными компонента или null, если узел не является INSTANCE или COMPONENT
 */
export const processNodeComponent = async (
  node: SceneNode,
  componentsResult: ComponentsResult
): Promise<ComponentData | ComponentData[] | null> => {
  // Логируем начало обработки для button компонентов
  const isButtonComponent = node.name.toLowerCase().includes("button");

  let mainComponent: ComponentNode | null = null; // Переменная для хранения главного компонента
  // Если узел является инстансом, получаем его главный компонент
  if (node.type === "INSTANCE") {
    try {
      mainComponent = await retryGetMainComponent(
        node as InstanceNode,
        node.name
      ); // Используем утилиту с повторными попытками
    } catch (error: unknown) {
      // Обработка ошибок при получении главного компонента
      console.error(
        `[processNodeComponent] Ошибка при получении mainComponent для ${node.name} после всех попыток:`,
        error
      );
      figma.ui.postMessage({
        type: "error" as const,
        message: `Не удалось получить mainComponent для ${
          node.name
        } после нескольких попыток: ${(error as Error).message}`,
      });
      return null;
    }
  } else if (node.type === "COMPONENT") {
    mainComponent = node; // Если это сам компонент, а не инстанс, он и есть главный компонент
  }

  let name = node.name; // Имя узла

  // Получаем описание и версию, используя главный компонент (если есть) или сам узел
  const descriptionDataMain = await getDescription(mainComponent || node); // Передаем mainComponent или сам node
  let parentComponentName: string | null = null; // Имя родительского компонента (если вложен в инстанс)
  if (node.type === "COMPONENT_SET") {
    const results: any[] = [];
    // Обрабатываем сам COMPONENT_SET (если нужно получить его данные)
    const setData = await processComponentSetNode(node as ComponentSetNode);
    if (setData) {
      // Не добавляем сам COMPONENT_SET в список компонентов, только его дочерние элементы
      // results.push(setData);
    }

    // Обрабатываем все дочерние узлы рекурсивно
    if ("children" in node) {
      for (const child of node.children) {
        const childResults = await processNodeComponent(
          child,
          componentsResult
        ); // Рекурсивный вызов
        if (childResults) {
          if (Array.isArray(childResults)) {
            results.push(...childResults);
          } else {
            results.push(childResults);
          }
        }
      }
    }

    return results; // Возвращаем результаты обработки дочерних элементов
  }

  // Этот блок кода был перемещен выше, чтобы mainComponentName и mainComponentKey
  // были доступны до блока COMPONENT_SET
  let mainComponentName = mainComponent ? mainComponent.name : null;
  let mainComponentKey = mainComponent ? mainComponent.key : null;

  // Проверяем, находится ли инстанс внутри другого инстанса
  let isNested = false;
  let parent = node.parent; // Начинаем с непосредственного родителя
  // Поднимаемся по иерархии родителей
  while (parent) {
    // Если найден родитель типа INSTANCE, устанавливаем флаг isNested и прерываем цикл
    if (parent.type === "INSTANCE") {
      isNested = true;
      break;
    }
    parent = parent.parent; // Переходим к следующему родительскому узлу
  }

  // Определяем имя и ключ главного компонента или родительского ComponentSet
  let componentKeyToUse = mainComponent ? mainComponent.key : null; // Ключ главного компонента по умолчанию
  let mainComponentSetKey: string | null = null; // Ключ набора компонентов, если есть
  let mainComponentSetName: string | null = null; // Имя набора компонентов, если есть
  let mainComponentSetId: string | null = null; // ID набора компонентов, если есть

  // Если главный компонент является частью набора, используем имя и ключ набора
  if (
    mainComponent &&
    mainComponent.parent &&
    mainComponent.parent.type === "COMPONENT_SET"
  ) {
    componentKeyToUse = mainComponent.parent.key; // Ключ родительского ComponentSet
    mainComponentSetName = mainComponent.parent.name; // Имя набора
    mainComponentSetKey = mainComponent.parent.key; // Ключ набора компонентов
    mainComponentSetId = mainComponent.parent.id; // id набора компонентов
  } else if (mainComponent) {
    //mainComponentName = mainComponent.name; // Для одиночных компонентов/инстансов используем имя главного компонента
  }

  parentComponentName = await getParentComponentName(node); // Используем новую вспомогательную функцию

  // Обрабатываем только узлы типа INSTANCE или COMPONENT (игнорируем COMPONENT_SET здесь)
  if (
    (node.type === "INSTANCE" || node.type === "COMPONENT") &&
    typeof name === "string" &&
    name.trim() !== ""
  ) {
    const width = Math.round(node.width); // Ширина узла (округленная)
    const height = Math.round(node.height); // Высота узла (округленная)

    // Проверяем, совпадают ли размеры (для определения иконки)
    const dimensionsMatch = width === height;
    // Проверяем, начинается ли имя с числа
    const nameStartsWithNumber = /^\d+/.test(name);
    // Проверяем, есть ли слеш после числа и пробела
    const hasSlashAfterNumber = /^\d+\s\//.test(name);
    // Проверяем паттерн "Число Текст /"
    const hasNumberTextSlashPattern = /^\d+\s.+\s\/\s/.test(name);

    // Определяем, является ли компонент иконкой (квадратный и соответствует одному из паттернов имени)
    const isIcon =
      dimensionsMatch &&
      ((nameStartsWithNumber && hasSlashAfterNumber) ||
        hasNumberTextSlashPattern);

    // Получаем пользовательские данные из PluginData
    let pluginDataKey = "";
    let pluginDataVersion = "";

    try {
      // Пробуем получить данные из PluginData самого узла
      pluginDataKey = node.getPluginData("customKey") || "";
      pluginDataVersion = node.getPluginData("customVersion") || "";

      // Если это инстанс и у него нет своих данных, проверяем PluginData главного компонента
      if (node.type === "INSTANCE" && mainComponent && !pluginDataKey) {
        pluginDataKey = mainComponent.getPluginData("customKey") || "";
      }

      //console.log(`Получены данные из PluginData для ${node.name}:`, { ключ: pluginDataKey, версия: pluginDataVersion });
    } catch (error) {
      // Обработка ошибок при получении PluginData
      console.error(`Ошибка при получении PluginData для ${node.name}:`, error);
    }

    let parent = node.parent; // Непосредственный родитель узла

    if (!mainComponent) {
      console.warn(
        `[processNodeComponent] mainComponent is null for node ${node.name}, skipping.`
      );
      return null;
    }

    // Формируем объект с данными компонента/инстанса
    const componentData: ComponentData = {
      isLost: false,
      isDeprecated: false,
      isOutdated: false,
      isNotLatest: false,
      checkVersion: "false",
      type: node.type, // Тип узла
      name: name.trim(), // Имя узла (без лишних пробелов)
      nodeId: node.id, // ID узла
      key: node.key, // Ключ узла
      description: descriptionDataMain?.description, // Описание из descriptionDataMain
      nodeVersion: descriptionDataMain
        ? descriptionDataMain.nodeVersion
        : undefined, // Версия из описания из descriptionDataMain
      hidden: checkIsNodeOrParentHidden(node), // Статус скрытия
      remote: mainComponent.remote, // Является ли локальным компонентом
      parentName: parentComponentName ? parentComponentName : null, // Имя родительского компонента (если вложен в инстанс)
      parentId: parent ? parent.id : null, // ID родителя
      mainComponentName: mainComponentName, // Имя главного компонента или набора
      mainComponentKey: mainComponentKey, // Ключ главного компонента или набора
      mainComponentId: mainComponent.id, // ID самого главного компонента
      mainComponentSetKey: mainComponentSetKey ? mainComponentSetKey : null, // Ключ набора компонентов (если есть)
      mainComponentSetName: mainComponentSetName ? mainComponentSetName : null, // Имя набора компонентов (если есть)
      mainComponentSetId: mainComponentSetId ? mainComponentSetId : null, // Имя набора компонентов (если есть)
      isIcon: isIcon, // Является ли иконкой
      size: isIcon ? width : `${width}x${height}`, // Размер (для иконок - одна сторона, для других - ШxВ)
      isNested: isNested, // Является ли вложенным инстансом
      skipUpdate: isNested, // Пропускать ли проверку обновления для вложенных инстансов
      pluginDataKey: pluginDataKey, // Пользовательский ключ из PluginData
      updateStatus: "checking",
      // Инициализируем поля версий библиотеки как null (будут обновлены в updateQueue)
      libraryComponentVersion: null,
      libraryComponentVersionMinimal: null,
      libraryComponentName: null,
      libraryComponentSetName: null,
      libraryComponentId: null,
    };

    // Добавляем компонент в очередь для проверки обновлений
    const updateQueue = getUpdateQueue();

    if (!componentData.mainComponentKey) {
      console.warn(
        `[processNodeComponent] ПРОПУЩЕН - отсутствует mainComponentKey для:`,
        {
          name: componentData.name,
          type: componentData.type,
          nodeId: componentData.nodeId,
          mainComponent: mainComponent
            ? {
                name: mainComponent.name,
                key: mainComponent.key,
                id: mainComponent.id,
              }
            : "null",
        }
      );
    }

    // Фильтрация иконок и компонентов с именами, начинающимися с '_' или '.'
    const trimmedMainComponentName = (componentData.mainComponentName || "").trim();
    const trimmedMainComponentSetName = (
      componentData.mainComponentSetName || ""
    ).trim();
    const skipByName =
      componentData.type === "INSTANCE" && (
        trimmedMainComponentName.startsWith("_") || trimmedMainComponentName.startsWith(".") ||
        trimmedMainComponentSetName.startsWith("_") || trimmedMainComponentSetName.startsWith(".")
      );
    
    if (componentData.isIcon === true || skipByName) {
      console.log(
        `[processNodeComponent] ИСКЛЮЧЕН из результатов - иконка или имя начинается с '_'/'.' для:`,
        {
          name: componentData.name,
          mainComponentName: componentData.mainComponentName,
          isIcon: componentData.isIcon,
          skipByName: skipByName,
        }
      );
      return null; // Полностью исключаем из результатов
    }

    updateQueue.addComponent(componentData);

    // Если объект данных компонента создан и узел является INSTANCE или COMPONENT
    if (
      componentData &&
      (node.type === "INSTANCE" || node.type === "COMPONENT")
    ) {
      // Проверяем, что массив componentsResult.instances существует и является массивом
      if (Array.isArray(componentsResult.instances)) {
        // Добавляем данные компонента в массив результатов
        componentsResult.instances.push(componentData);
        // Увеличиваем счетчик компонентов
        componentsResult.counts.components =
          (componentsResult.counts.components || 0) + 1;
        // Если это иконка, увеличиваем счетчик иконок
        if (componentData.isIcon) {
          componentsResult.counts.icons =
            (componentsResult.counts.icons || 0) + 1;
        }
      } else {
        // Логируем ошибку, если componentsResult.instances не массив
        console.error(
          "componentsResult.instances is not an array:",
          componentsResult.instances
        );
      }
    }
    // Возвращаем собранные данные компонента
    return componentData;
  }
  // Если узел не является INSTANCE или COMPONENT, возвращаем null
  return null;
};

// Вспомогательная функция для обработки узлов COMPONENT_SET и их дочерних компонентов
// (В текущей версии кода используется только для получения данных о самом COMPONENT_SET, если нужно)
export const processComponentSetNode = async (
  node: ComponentSetNode,
  parentSet: ComponentSetNode | null = null
): Promise<Partial<ComponentData> | null> => {
  // Эта функция теперь в основном используется для получения данных о самом COMPONENT_SET, если это необходимо.
  // Рекурсивный обход дочерних элементов перенесен в processNodeComponent.

  const name = node.name; // Имя набора компонентов
  // Используем await, так как getDescription теперь асинхронная (получаем описание и версию набора)
  const descriptionDataSet = await getDescription(node);

  // Возвращаем данные только для самого COMPONENT_SET, если это необходимо
  // Если node.type === 'COMPONENT', это дочерний компонент, который будет обработан в processNodeComponent
  if (
    node.type === "COMPONENT_SET" &&
    typeof name === "string" &&
    name.trim() !== ""
  ) {
    const componentSetData: Partial<ComponentData> = {
      type: node.type, // Тип узла (COMPONENT_SET)
      name: name.trim(), // Имя набора
      nodeId: node.id, // ID набора
      key: node.key, // Ключ набора
      description: descriptionDataSet
        ? descriptionDataSet.description
        : undefined, // Описание набора
      nodeVersion: descriptionDataSet
        ? descriptionDataSet.nodeVersion
        : undefined, // Версия из описания набора
      hidden: checkIsNodeOrParentHidden(node), // Статус скрытия
      remote: node.remote, // Является ли локальным набором
      parentName: parentSet ? parentSet.name : null, // Имя родительского набора (если вложен)
      parentId: parentSet ? parentSet.id : null, // ID родительского набора
      //mainComponentName: name, // Имя главного компонента (для набора это его собственное имя)
      //mainComponentKey: node.key, // Для COMPONENT_SET используем его собственный ключ
      //mainComponentId: node.id, // ID самого набора
      isIcon: false, // COMPONENT_SET сам по себе не является иконкой
      size: `${Math.round(node.width)}x${Math.round(node.height)}`, // Размеры COMPONENT_SET
      isNested: false, // COMPONENT_SET не может быть вложенным в инстанс
      skipUpdate: false, // COMPONENT_SET не обновляется как инстанс
    };
    return componentSetData;
  }

  // Если узел не является COMPONENT_SET, возвращаем null
  return null;
};
