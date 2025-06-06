// Глобальный обработчик ошибок для wasm/memory/out of bounds
if (typeof window !== 'undefined') {
  // Обработчик для необработанных промисов (unhandledrejection)
  window.addEventListener('unhandledrejection', event => {
    const err = event.reason;
    console.error('Global unhandledrejection:', err);
    // Проверяем, связана ли ошибка с WebAssembly или памятью
    if (err && err.message && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err.message)) {
      // Уведомляем пользователя о критической ошибке
      figma.notify('Критическая ошибка памяти Figma API. Плагин будет перезапущен.');
      // Закрываем плагин через 3 секунды с сообщением об ошибке
      setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 15000);
    } else {
      figma.ui.postMessage({
        type: 'error',
        message: `Unhandled Rejection: ${err.message || err}`
      });
    }
  });
  // Обработчик для общих ошибок (error)
  window.addEventListener('error', event => {
    const err = event.error;
    console.error('Global error:', err);
    // Проверяем, связана ли ошибка с WebAssembly или памятью
    if (err && err.message && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err.message)) {
      // Уведомляем пользователя о критической ошибке
      figma.notify('Критическая ошибка памяти Figma API. Плагин будет перезапущен.');
      // Закрываем плагин через 3 секунды с сообщением об ошибке
      setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 15000);
    } else {
      figma.ui.postMessage({
        type: 'error',
        message: `Error: ${err.message || err}`
      });
    }
  });
}
// Показываем пользовательский интерфейс плагина
figma.showUI(__html__, { width: 500, height: 800 });

// Отправляем информацию о текущем пользователе в UI
figma.ui.postMessage({
  type: 'user-info',
  user: {
    name: figma.currentUser.name,
    id: figma.currentUser.id,
  }
});



// Добавляем хранилище кэша на верхнем уровне
const componentUpdateCache = new Map();
// Добавляем массив для хранения результатов проверок
let resultsList = [];
// Добавляем кэш для функции rgbToHex
const rgbToHexCache = new Map();

// Добавляем глобальную переменную для хранения данных о цветах
let lastColorsData = null;

/**
 * Получает уникальный ключ кэширования для компонента.
 * @param {ComponentNode} component - Компонент для получения ключа
 * @returns {string} Уникальный ключ для кэширования
 */
function getComponentCacheKey(component) {
  // Если компонент отсутствует, возвращаем стандартный ключ для неизвестного компонента.
  if (!component) {
    return 'unknown_component_no_id';
  }

  try {
    // Если у компонента нет ключа (например, локальный компонент),
    // используем его ID для генерации уникального ключа.
    if (!component.key) {
      return `local_component_${component.id || 'no_id'}`;
    }

    // Если компонент является частью набора компонентов (COMPONENT_SET) и у набора есть ключ,
    // формируем ключ на основе ключа набора и имени компонента.
    const parent = component.parent;
    if (parent && parent.type === 'COMPONENT_SET' && parent.key) {
      const componentNameInSet = component.name || 'unnamed_variant';
      return `set_${parent.key}_variant_${componentNameInSet}`;
    }

    // Для обычных компонентов с ключом используем сам ключ.
    return component.key;
  } catch (error) {
    console.error('Error in getComponentCacheKey:', error);
    // В случае ошибки возвращаем ключ, указывающий на ошибку и ID компонента, если он доступен.
    return `error_processing_component_${component.id || 'no_id'}`;
  }
}

/**
 * Проверяет, требует ли компонент обновления
 * Сравнивает текущий компонент с импортированной версией из библиотеки
 * Использует кэширование для оптимизации повторных проверок (закомментировано в текущей версии)
 * @param {ComponentNode} mainComponent - Компонент для проверки
 * @returns {Promise<{isOutdated: boolean, importedId: string|null, version: string|null, description: string|null, mainComponentId: string, importedMainComponentId: string|null, libraryComponentVersion?: string, libraryComponentId?: string, isLost?: boolean}>} Объект с информацией об актуальности
 */
async function checkComponentUpdate(mainComponent) {
  // 1. Проверка входных данных и инициализация
  if (!mainComponent) {
    console.error('checkComponentUpdate: получен пустой компонент');
    return {
      isOutdated: false,
      importedId: null, // ID импортированного компонента (для одиночных)
      version: null, // Версия из описания импортированного одиночного компонента
      description: null, // Описание импортированного одиночного компонента
      mainComponentId: null, // ID текущего проверяемого компонента
      importedMainComponentId: null // ID импортированного главного компонента (для одиночных)
    };
  }

  try {
    const cacheKey = getComponentCacheKey(mainComponent);

    // Инициализируем объект результата с полями по умолчанию
    const result = {
      isOutdated: false,
      mainComponentId: mainComponent.id,
      importedId: null, // Для одиночного импортированного компонента
      importedMainComponentId: null, // Для одиночного импортированного компонента
      libraryComponentId: null, // Для компонента из импортированного набора
      version: null, // Версия из описания (может быть от набора или одиночного)
      description: null, // Описание (может быть от набора или одиночного)
      libraryComponentVersion: null, // Версия из описания набора (если применимо)
      isLost: false // Флаг, если компонент не найден в импортированном наборе
    };

    // 2. Проверка на локальный компонент (без ключа)
    if (!mainComponent.key) {
      console.error('У компонента отсутствует ключ:', mainComponent.name);
      // componentUpdateCache.set(cacheKey, result); // Кэширование пока закомментировано
      return result; // Локальные компоненты не могут быть устаревшими из библиотеки
    }

    // 3. Определение, является ли компонент частью набора (COMPONENT_SET)
    const isPartOfSet = mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET';
    let libraryVersionSourceNode = null; // Узел, из которого берем версию и описание (набор или одиночный компонент)

    // 4. Логика импорта и проверки
    if (isPartOfSet && mainComponent.parent && mainComponent.parent.key) {
      // 4.1. Компонент является частью набора
      try {
        const importedSet = await figma.importComponentSetByKeyAsync(mainComponent.parent.key);
        if (importedSet) {
          libraryVersionSourceNode = importedSet; // Описание и версию берем из набора
          const importedComponentInSet = importedSet.findChild(comp => comp.key === mainComponent.key);

          if (importedComponentInSet) {
            result.isOutdated = importedComponentInSet.id !== mainComponent.id;
            result.libraryComponentId = importedComponentInSet.id;
          } else {
            // Компонент с таким ключом не найден в импортированном наборе
            result.isOutdated = true;
            result.isLost = true; // Помечаем, что компонент "потерян" в библиотеке
            console.error(`Компонент "${mainComponent.name}" (key: ${mainComponent.key}) не найден в импортированном наборе "${importedSet.name}"`);
          }
        } else {
          console.error(`Не удалось импортировать набор компонентов для "${mainComponent.name}" (parent key: ${mainComponent.parent.key})`);
          result.isOutdated = true; // Считаем устаревшим, если не удалось импортировать набор
        }
      } catch (setError) {
        console.error(`Ошибка при импорте набора компонентов для "${mainComponent.name}":`, setError);
        result.isOutdated = true; // Считаем устаревшим при ошибке импорта
      }
    } else {
      // 4.2. Одиночный компонент (не в наборе или набор без ключа)
      try {
        const importedComponent = await figma.importComponentByKeyAsync(mainComponent.key);
        if (importedComponent) {
          libraryVersionSourceNode = importedComponent; // Описание и версию берем из самого компонента
          result.isOutdated = importedComponent.id !== mainComponent.id;
          result.importedId = importedComponent.id; // ID импортированного компонента
          result.importedMainComponentId = importedComponent.id; // ID импортированного главного компонента
        } else {
          console.error(`Не удалось импортировать одиночный компонент "${mainComponent.name}" (key: ${mainComponent.key})`);
          result.isOutdated = true; // Считаем устаревшим, если не удалось импортировать
        }
      } catch (componentError) {
        console.error(`Ошибка при импорте одиночного компонента "${mainComponent.name}":`, componentError);
        result.isOutdated = true; // Считаем устаревшим при ошибке импорта
      }
    }

    // 5. Получение описания и версии из libraryVersionSourceNode (импортированный набор или компонент)
    if (libraryVersionSourceNode) {
      const descData = await getDescription(libraryVersionSourceNode);
      result.description = descData.description;
      if (isPartOfSet && mainComponent.parent && mainComponent.parent.key) {
        // Если это был набор, версия из набора идет в libraryComponentVersion
        result.libraryComponentVersion = descData.nodeVersion;
        result.version = descData.nodeVersion; // Также дублируем в общее поле version для консистентности
      } else {
        // Если это был одиночный компонент, версия идет в основное поле version
        result.version = descData.nodeVersion;
      }
    }

    // componentUpdateCache.set(cacheKey, result); // Кэширование пока закомментировано

    /*
    console.log('Результат проверки компонента:', {
      name: mainComponent.name,
      isOutdated: result.isOutdated,
      cacheKey,
      libraryComponentId: result.libraryComponentId,
      libraryComponentVersion: result.libraryComponentVersion,
    });
    */
    return result;

  } catch (error) {
    console.error(`Критическая ошибка при проверке компонента "${mainComponent ? mainComponent.name : 'N/A'}":`, {
      componentName: mainComponent ? mainComponent.name : 'неизвестно',
      error: error.message,
      stack: error.stack
    });

    // Возвращаем безопасный результат в случае ошибки
    const safeResult = {
      isOutdated: false, // По умолчанию не устарел при ошибке
      mainComponentId: mainComponent ? mainComponent.id : null,
      importedMainComponentId: null,
      importedId: null,
      libraryComponentId: null,
      version: null,
      description: null,
      libraryComponentVersion: null,
      isLost: false
    };

    // try {
    //   const cacheKey = getComponentCacheKey(mainComponent);
    //   componentUpdateCache.set(cacheKey, safeResult); // Кэширование пока закомментировано
    // } catch (cacheError) {
    //   console.error('Не удалось сохранить безопасный результат в кэш при ошибке:', cacheError);
    // }
    return safeResult;
  }
}

/**
 * Получает полный путь к узлу через всех его родителей
 * Формирует строку из ID всех родительских узлов, разделенных запятыми
 * @param {SceneNode} node - Узел для получения пути
 * @returns {string} Строка пути, состоящая из ID узлов
 */
function getNodePath(node) {
  const path = []; // Массив для хранения ID узлов пути
  let current = node; // Начинаем с текущего узла

  // Собираем все ID по цепочке родителей до корневого узла
  while (current && current.parent) {
    path.unshift(current.id); // Добавляем ID текущего узла в начало массива
    current = current.parent; // Переходим к родительскому узлу
  }

  // Формируем строку пути, объединяя ID запятыми
  return path.join(',');
}

/**
 * Извлекает описание и версию из описания узла или его главного компонента
 * @param {SceneNode} node - Узел для получения описания
 * @param {ComponentNode|ComponentSetNode|null} [mainComponent=null] - Главный компонент или набор компонента (если известен)
 * @returns {Promise<Object>} Объект с описанием (`description`) и найденной версией (`nodeVersion`)
 */
async function getDescription(node, mainComponent = null) {
  let description = ''; // Переменная для хранения описания

  // Если передан mainComponent, пытаемся получить описание из него или его родителя
  if (mainComponent) {
    description = mainComponent.description || '';
    if (!description && mainComponent.parent) {
      description = mainComponent.parent.description;
    }
  } else { // Если mainComponent не передан, работаем с текущим узлом
    description = node.description || '';
    // Если узел - INSTANCE и у него нет описания, пытаемся получить описание главного компонента
    if (!description && node.type === 'INSTANCE') {
      try {
        let mc = null;
        try {
          // Асинхронно получаем главный компонент инстанса
          mc = await node.getMainComponentAsync();
        } catch (error) {
          console.error(`Ошибка при получении mainComponent для ${node.name}:`, error);
        }
        // Если главный компонент найден, пытаемся получить описание из него или его родителя
        if (mc) {
          description = mc.description || '';
          if (!description && mc.parent) {
            description = mc.parent.description;
          }
        }
      } catch (error) {
        console.error(`Ошибка при получении mainComponent в getDescription:`, error);
        figma.ui.postMessage({
          type: 'error',
          message: `Ошибка при получении mainComponent в getDescription: ${error.message}`
        });
      }
    }
  }

  // Извлекаем версию из описания с помощью регулярного выражения
  let nodeVersion = null;
  if (description) {
    const versionPattern = /v\s*(\d+\.\d+\.\d+)/i; // Паттерн для поиска "v X.Y.Z"
    const match = description.match(versionPattern);
    nodeVersion = match ? match[1] : null; // Если найдено совпадение, берем первую группу (версию)
  }

  // Возвращаем объект с описанием и версией
  return { description, nodeVersion };
}

/**
 * Проверяет, скрыт ли узел или любой из его родителей
 * @param {SceneNode} node - Узел для проверки
 * @returns {boolean} true если узел или любой из родителей скрыт, иначе false
 */
function isNodeOrParentHidden(node) {
  let currentNode = node; // Начинаем с текущего узла
  // Поднимаемся по иерархии родителей
  while (currentNode) {
    // Если текущий узел скрыт (visible === false), возвращаем true
    if (currentNode.visible === false) {
      return true;
    }
    currentNode = currentNode.parent; // Переходим к родительскому узлу
  }
  // Если ни один из узлов в цепочке не скрыт, возвращаем false
  return false;
}

/**
 * Проверяет, является ли узел вложенным в другой экземпляр (INSTANCE)
 * Рекурсивно проверяет родителей узла на тип INSTANCE
 * @param {SceneNode} node - Узел для проверки
 * @returns {boolean} true если узел вложен в другой экземпляр, иначе false
 */
function isNestedInstance(node) {
  let parent = node.parent; // Начинаем с непосредственного родителя
  // Поднимаемся по иерархии родителей
  while (parent) {
    // Если найден родитель типа INSTANCE, возвращаем true
    if (parent.type === 'INSTANCE') {
      return true;
    }
    parent = parent.parent; // Переходим к следующему родительскому узлу
  }
  // Если ни один из родителей не является INSTANCE, возвращаем false
  return false;
}

// Вспомогательная функция для создания асинхронной задержки
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для отправки информации о прогрессе выполнения в UI
async function updateProgress(phase, processed, total, message) {
  // Отправляем сообщение типа 'progress-update' в UI
  figma.ui.postMessage({
    type: 'progress-update',
    phase, // Текущий этап (например, 'processing')
    processed, // Количество обработанных элементов
    total, // Общее количество элементов
    message // Дополнительное сообщение
  });
  // Небольшая задержка для того, чтобы UI успел обработать сообщение и обновить интерфейс
  await delay(1);
}

/**
 * Основной обработчик сообщений от UI плагина
 * Обрабатывает различные команды, поступающие из пользовательского интерфейса.
 *
 * @param {Object} msg - Объект сообщения от UI
 * @param {string} msg.type - Тип сообщения, определяющий действие ('resize', 'check-all', 'scroll-to-node', 'select-nodes', 'get-component-data', 'set-component-data', 'clear-component-data')
 * @param {number} [msg.width] - Новая ширина UI (для 'resize')
 * @param {number} [msg.height] - Новая высота UI (для 'resize')
 * @param {string} [msg.nodeId] - ID узла для прокрутки (для 'scroll-to-node')
 * @param {string[]} [msg.nodeIds] - Массив ID узлов для выделения (для 'select-nodes')
 * @param {string} [msg.key] - Ключ компонента (для 'set-component-data')
 * @param {string} [msg.version] - Версия компонента (для 'set-component-data')
 */
figma.ui.onmessage = async (msg) => {
  console.log('Получено сообщение от UI:', msg.type);

  // Обработка сообщения для изменения размера окна плагина
  if (msg.type === 'resize') {figma.ui.resize(msg.width, msg.height);}

  // Обработчики для работы с данными компонента (get-component-data, clear-component-data)
  // Логика этих обработчиков находится ниже в этом же блоке onmessage

  // Обработка основного запроса на анализ всех элементов в выделенной области
    if (msg.type === 'check-all') {
      // Записываем время начала выполнения
      const startTime = Date.now();

      // Получаем текущее выделение пользователя
      const selection = figma.currentPage.selection;

    // Если ничего не выделено, отправляем сообщение об ошибке в UI и выходим
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Выберите фрейм, компонент или инстанс!'
      });
      return;
    }

    // Собираем все уникальные узлы для обработки из выделенных элементов и их потомков
    const uniqueNodesToProcess = new Set();

    // Проходим по каждому выделенному элементу
    for (const selectedNode of selection) {
      // Добавляем сам выделенный узел, если он является компонентом, инстансом или набором компонентов
      if (selectedNode.type === 'INSTANCE' || selectedNode.type === 'COMPONENT' || selectedNode.type === 'COMPONENT_SET') {uniqueNodesToProcess.add(selectedNode);}

      // Если узел является контейнером (имеет метод findAll), добавляем всех его потомков
      if (typeof selectedNode.findAll === 'function') {
        const allDescendants = selectedNode.findAll();
        for (const descendant of allDescendants) {uniqueNodesToProcess.add(descendant);}
      }
    }

    // Преобразуем Set уникальных узлов в массив для удобной итерации
    const nodesToProcess = Array.from(uniqueNodesToProcess);

    // Если после сбора нет узлов для обработки, отправляем сообщение об ошибке и выходим
    if (nodesToProcess.length === 0) {
       figma.ui.postMessage({
         type: 'error',
         message: 'В выделенной области нет поддерживаемых элементов (компоненты, инстансы, элементы с цветами).'
       });
       return;
    }

    // Инициализируем объекты для хранения результатов анализа компонентов и цветов
    let componentsResult = {
      instances: [], // Массив для данных инстансов/компонентов
      counts: { // Счетчики по типам
        components: 0,
        icons: 0
      }
    };
    let colorsResult = {
      instances: [], // Массив для данных цветов заливки
      counts: { // Счетчики по типам
        colors: 0
      }
    };
    let colorsResultStroke = {
      instances: [], // Массив для данных цветов обводки
      counts: { // Счетчики по типам
        colors: 0
      }
    };

   
    //let executionTime = Date.now() - startTime;
    //console.log(`Первый этап выполнен: ${executionTime}ms`);
    //console.log(`Результат: ${nodesToProcess}`);

    try {
      // Отправляем начальное сообщение о прогрессе в UI
      await updateProgress('processing', 0, nodesToProcess.length, 'Обработка элементов');

      // Асинхронно обрабатываем каждый узел из списка
      const processNodeSafely = async (node, index) => {
        // Пропускаем невалидные узлы
        if (!node || !node.type) {
          console.warn(`[${index + 1}] Пропущен невалидный узел:`, node);
          return;
        }

        try {
          // Проверяем, имеет ли узел заливки или обводки
          let hasColor = false;
          try {hasColor = hasFillOrStroke(node);} catch (err) {
            console.error(`[${index + 1}] ERROR in hasFillOrStroke:`, err);
          }

          // Если узел имеет цвет, обрабатываем его цвета
          if (hasColor) {
            try {await processNodeColors(node, colorsResult, colorsResultStroke);
            } catch (err) {
              console.error(`[${index + 1}] ERROR in processNodeColors:`, err);
            }
          }

          // Если узел является инстансом, обрабатываем его как компонент
          if (node.type === 'INSTANCE') {
            try {
              await processNodeComponent(node, componentsResult);
            } catch (err) {
              console.error(`[${index + 1}] ERROR in processNodeComponent:`, err);
            }
          }
        } catch (error) {
          console.error(`[${index + 1}] Ошибка на этапе логирования:`, error);
        }
      };

      // Запускаем цикл обработки узлов с асинхронной задержкой
      for (let i = 0; i < nodesToProcess.length; i++) {
        await processNodeSafely(nodesToProcess[i], i);
        // Обновляем прогресс после каждого узла
        // Даем браузеру "подышать" после каждого 10 узла, чтобы UI не зависал
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          await updateProgress('processing', i + 1, nodesToProcess.length, 'Обработка элементов');
        }
      }

      // Сортируем результаты компонентов по имени (с учетом специальных символов и эмодзи)
      componentsResult.instances.sort((a, b) => {
        const aName = a.mainComponentName || a.name;
        const bName = b.mainComponentName || b.name;

        // Функция для удаления эмодзи из строки
        const removeEmoji = (str) => str.replace(/([\u0023-\u0039]\uFE0F?\u20E3|\u00A9|\u00AE|[\u2000-\u3300]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])/gu, '').trim();

        // Функция для проверки специальных символов в начале имени
        const startsWithSpecial = (str) => /^[._]/.test(str);

        const cleanA = removeEmoji(aName);
        const cleanB = removeEmoji(bName);

        // Сначала сортируем по наличию специальных символов в начале
        const aSpecial = startsWithSpecial(cleanA);
        const bSpecial = startsWithSpecial(cleanB);

        if (aSpecial && !bSpecial) return 1; // Элементы со спецсимволами идут после
        if (!aSpecial && bSpecial) return -1; // Элементы без спецсимволов идут раньше

        // Если оба имеют или не имеют спец. символы, сортируем по тексту
        return cleanA.localeCompare(cleanB);
      });


      console.log('Final components result:', {
        total: componentsResult.instances.length,
        components: componentsResult.counts.components,
        icons: componentsResult.counts.icons,
        instances: componentsResult.instances
      });

      // Сохраняем результаты компонентов в общий массив (resultsList)
      resultsList = componentsResult.instances.map(instance => {
        return Object.assign({}, instance, {
          updateStatus: null // Статус обновления будет заполнен позже (если потребуется)
        });
      });

      // Сохраняем данные о цветах в глобальную переменную
      lastColorsData = colorsResult;

      // Отправляем все собранные результаты в UI
      // Формируем дерево только для выбранных элементов (для отладки)
      function buildComponentTree(node) {
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          children: node.children ? node.children.map(buildComponentTree) : []
        };
      }
      let componentTree = [];
      if (figma.currentPage.selection && figma.currentPage.selection.length > 0) {
        componentTree = figma.currentPage.selection.map(buildComponentTree);
      } else {
        figma.notify('Нет выбранных элементов для построения дерева.');
      }

       // Вычисляем время выполнения
      let executionTime = Date.now() - startTime;

      // Добавляем время выполнения в componentsResult
      componentsResult.executionTime = executionTime;
      console.log(`Время выполнения запроса check-all: ${executionTime}ms`);
      
      figma.ui.postMessage({
        type: 'all-results', // Тип сообщения для UI
        components: componentsResult, // Результаты компонентов
        colors: colorsResult, // Результаты цветов заливки
        colorsStroke: colorsResultStroke, // Результаты цветов обводки
        componentTree: componentTree // Дерево выбранных элементов
      });

     

      // Небольшая задержка перед возможным следующим этапом (проверка обновлений, закомментировано)
      //await delay(30);
      // Второй этап: асинхронная проверка обновлений (УДАЛЕНО)
      // await checkComponentUpdates(componentsResult);

    } catch (error) {
      // Обработка ошибок в процессе анализа
      console.error('Ошибка при проверке:', error);
      figma.notify(`Ошибка при проверке: ${error.message}`);
      // Отправляем сообщение об ошибке в UI
      figma.ui.postMessage({ type: 'error', message: `Ошибка при проверке: ${error.message}` });
      return;
    }
  }

  // Обработка запроса на прокрутку к определенному узлу в документе Figma
  else if (msg.type === 'scroll-to-node') {
    // Используем асинхронную IIFE для работы с async/await
    (async () => {
      try {
        const nodeId = msg.nodeId; // Получаем ID узла из сообщения
        let node = null;
        try {
          // Асинхронно получаем узел по его ID
          node = await figma.getNodeByIdAsync(nodeId);
        } catch (err) {
          // Обработка ошибок при получении узла
          console.error('[PLUGIN] getNodeByIdAsync error:', err);
          figma.notify('Ошибка доступа к элементу: ' + err.message);
          return;
        }
        console.log('[PLUGIN] Node found:', !!node, node);
        // Проверяем, что узел найден и является SceneNode (имеет тип и свойство visible)
        if (node && 'type' in node && typeof node.visible === 'boolean') {
          // Проверяем, находится ли узел на текущей странице
          let page = node.parent;
          while (page && page.type !== 'PAGE') page = page.parent; // Поднимаемся по родителям до типа PAGE
          // Если узел находится на другой странице, переключаемся на нее
          if (page && page.id && page.id !== figma.currentPage.id) {
            //console.log('Node is on another page:', page.name);
            figma.currentPage = page;
          }
          try {
            // Прокручиваем и масштабируем вид так, чтобы узел был виден
            figma.viewport.scrollAndZoomIntoView([node]);
            // Выделяем найденный узел в интерфейсе Figma
            figma.currentPage.selection = [node];
          } catch (err) {
            // Обработка ошибок при прокрутке и выделении
            console.error('Ошибка scrollAndZoomIntoView:', err, node);
            figma.notify('Ошибка позиционирования: ' + err.message);
            // Если ошибка связана с WebAssembly/памятью, уведомляем и перезапускаем плагин
            if (err && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err.message)) {
              figma.notify('Критическая ошибка Figma API. Плагин будет перезапущен.');
              setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 3000);
            }
          }
        } else if (node) {
          // Если узел найден, но не является SceneNode, уведомляем пользователя
          console.warn('Node is not a valid SceneNode:', node);
          figma.notify('Выбранный элемент не поддерживается для прокрутки.');
        } else {
          // Если узел не найден по ID, уведомляем пользователя
          figma.notify('Не удалось найти узел с указанным ID.');
        }
      } catch (criticalErr) {
        // Общая обработка критических ошибок в этом блоке
        console.error('Critical error in scroll-to-node:', criticalErr);
        figma.notify('Критическая ошибка работы с элементом: ' + (criticalErr.message || criticalErr));
        // Если ошибка связана с WebAssembly/памятью, уведомляем и перезапускаем плагин
        if (criticalErr && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(criticalErr.message)) {
          figma.notify('Критическая ошибка Figma API. Плагин будет перезапущен.');
          setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 3000);
        }
      }
    })();
  }
  // Обработка запроса на выбор группы узлов в документе Figma
  else if (msg.type === 'select-nodes') {
    // Используем асинхронную IIFE для работы с async/await
    (async () => {
      const nodeIds = msg.nodeIds; // Получаем массив ID узлов из сообщения
      // console.log('Выбираем группу узлов:', nodeIds);
      // Проверяем корректность входных данных: массив ID не должен быть пустым
      if (!nodeIds || nodeIds.length === 0) {
        figma.notify('Не указаны ID узлов для выбора');
        return;
      }
      let nodes = []; // Массив для хранения найденных узлов
      try {
        // Асинхронно ищем все узлы по их ID параллельно
        const foundNodes = await Promise.all(
          nodeIds.map(async id => {
            try {
              // Получаем узел по ID
              const n = await figma.getNodeByIdAsync(id);
              // Возвращаем узел, только если он найден и является валидным SceneNode
              return n && 'type' in n && typeof n.visible === 'boolean' ? n : null;
            } catch (err) {
              // Логируем ошибки при получении отдельных узлов, но не прерываем Promise.all
              console.error('Ошибка getNodeByIdAsync:', id, err);
              return null;
            }
          })
        );
        // Фильтруем массив, оставляя только успешно найденные валидные узлы
        nodes = foundNodes.filter(n => n !== null);
      } catch (err) {
        // Обработка ошибок при выполнении Promise.all
        console.error('Ошибка при поиске группы узлов:', err);
        figma.notify('Ошибка при поиске группы узлов: ' + err.message);
        return;
      }
      // Проверяем, найдены ли какие-либо узлы
      if (nodes.length === 0) {
        figma.notify('Не удалось найти ни один из указанных узлов');
        return;
      }
      // Жёстко фильтруем только SceneNode (повторная проверка, хотя уже была в map)
      const validNodes = nodes.filter(n => n && 'type' in n && typeof n.visible === 'boolean');
      //console.log('Valid nodes for selection:', validNodes.map(n => n && n.type), validNodes);
      // Если после фильтрации не осталось валидных узлов, уведомляем пользователя
      if (validNodes.length === 0) {
        figma.notify('Нет валидных элементов для выделения!');
        return;
      }
      // Выделяем найденные валидные узлы в интерфейсе Figma
      figma.currentPage.selection = validNodes;
      // Прокручиваем и масштабируем вид так, чтобы все выделенные узлы были видны
      figma.viewport.scrollAndZoomIntoView(validNodes);
      // Уведомляем пользователя о количестве выбранных элементов
      figma.notify(`Выбрано ${validNodes.length} элементов`);
    })();
  }

  // Обработка запроса на чтение пользовательских данных (pluginData) компонента/набора
  else if (msg.type === 'get-component-data') {
    console.log('Получен запрос на чтение данных компонента');
    // Получаем текущее выделение пользователя
    const selection = figma.currentPage.selection;

    // Если ничего не выделено, отправляем сообщение об ошибке в UI и выходим
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({
        type: 'component-data-result',
        message: 'Выберите компоненты для чтения данных.',
        isError: true
      });
      return;
    }

    // Объект для хранения собранных данных компонентов
    const componentData = {};

    // Считаем количество подходящих компонентов (COMPONENT или COMPONENT_SET) в выделении
    let validComponentsCount = 0;
    for (const node of selection) {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        validComponentsCount++;
      }
    }

    // Если нет подходящих компонентов, отправляем сообщение об ошибке и выходим
    if (validComponentsCount === 0) {
      figma.ui.postMessage({
        type: 'component-data-result',
        message: 'Выделение не содержит компонентов или наборов компонентов.',
        isError: true
      });
      return;
    }

    // Получаем данные только для компонентов и наборов компонентов
    for (const node of selection) {
      // Проверяем, является ли узел компонентом или набором компонентов
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        try {
          // Читаем пользовательские данные 'customKey' и 'customVersion'
          const customKey = node.getPluginData('customKey') || '';
          const customVersion = node.getPluginData('customVersion') || '';
          // Добавляем данные в результирующий объект по ID узла
          componentData[node.id] = {
            name: node.name,
            type: node.type,
            key: customKey,
            version: customVersion,
            // Дополнительно можно добавить оригинальный ключ Figma, если он есть
            originalKey: node.key || null
          };
        } catch (error) {
          console.error(`Ошибка при чтении данных компонента ${node.id} (${node.name}):`, error);
          // В случае ошибки добавляем информацию об ошибке в данные
           componentData[node.id] = {
            name: node.name,
            type: node.type,
            error: `Ошибка чтения данных: ${error.message}`
          };
        }
      }
    }

    // Если собраны какие-либо данные, отправляем их в UI
    if (Object.keys(componentData).length > 0) {
      figma.ui.postMessage({
        type: 'component-data-result',
        data: componentData
      });
    } else {
      // Если данных не найдено (хотя подходящие узлы были), отправляем сообщение
      figma.ui.postMessage({
        type: 'component-data-result',
        message: 'Данные компонентов не найдены в выбранных элементах.'
      });
    }
  }

  // Обработка запроса на установку пользовательских данных (pluginData) компонента/набора
  else if (msg.type === 'set-component-data') {
    try {
      console.log('Получен запрос на установку данных компонента:', msg);

      // Проверяем параметры сообщения: ключ и версия должны быть переданы
      if (!msg.key || !msg.version) {
        console.warn('Ошибка: ключ или версия отсутствуют в сообщении', msg);
        figma.ui.postMessage({
          type: 'component-data-set',
          message: 'Ключ и версия не могут быть пустыми.',
          isError: true
        });
        return;
      }

      // Получаем текущее выделение пользователя
      const selection = figma.currentPage.selection;
      const { key, version } = msg; // Извлекаем ключ и версию из сообщения

      // Если ничего не выделено, отправляем сообщение об ошибке в UI и выходим
      if (!selection || selection.length === 0) {
        console.warn('Нет выбранных элементов для установки данных');
        figma.ui.postMessage({
          type: 'component-data-set',
          message: 'Выберите компоненты для установки данных.',
          isError: true
        });
        return;
      }

      let dataSet = false; // Флаг, указывающий, были ли данные установлены хотя бы для одного компонента
      let updatedComponents = 0; // Счетчик обновленных компонентов

      // Считаем количество подходящих компонентов (COMPONENT или COMPONENT_SET) в выделении
      let validComponentsCount = 0;
      for (const node of selection) {
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          validComponentsCount++;
        }
      }

      // Если нет подходящих компонентов, отправляем сообщение об ошибке и выходим
      if (validComponentsCount === 0) {
        figma.ui.postMessage({
          type: 'component-data-set',
          message: 'Выделение не содержит компонентов или наборов компонентов.',
          isError: true
        });
        return;
      }

      // Устанавливаем данные только для компонентов и наборов компонентов
      for (const node of selection) {
        try {
          // Проверяем, является ли узел компонентом или набором компонентов
          if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
            // Устанавливаем пользовательские данные 'customKey' и 'customVersion'
            node.setPluginData('customKey', key);
            node.setPluginData('customVersion', version);
            console.log(`Установлены данные компонента ${node.id} (${node.type}) (${node.name}): key = ${key}, version = ${version}`);
            dataSet = true; // Устанавливаем флаг
            updatedComponents++; // Увеличиваем счетчик
          } else {
            console.log(`Пропускаем нод ${node.id} (${node.name}), так как он не является компонентом или набором компонентов`);
          }
        } catch (error) {
          // Обработка ошибок при установке данных для конкретного компонента
          console.error(`Ошибка при установке данных компонента ${node.id} (${node.name}):`, error);
        }
      }

      // Отправляем сообщение в UI о результате операции
      if (dataSet) {
        figma.ui.postMessage({
          type: 'component-data-set',
          message: `Данные успешно установлены для ${updatedComponents} компонентов.`
        });
      } else {
        figma.ui.postMessage({
          type: 'component-data-set',
          message: 'Не удалось установить данные компонентов.',
          isError: true
        });
      }
    } catch (error) {
      // Общая обработка ошибок при обработке запроса на установку данных
      console.error('Ошибка при обработке запроса на установку данных компонента:', error);
      figma.ui.postMessage({
        type: 'component-data-set',
        message: `Ошибка: ${error.message}`,
        isError: true
      });
    }
  }

  // Обработка запроса на очистку пользовательских данных (pluginData) компонента/набора
  else if (msg.type === 'clear-component-data') {
    console.log('Получен запрос на очистку данных компонента');
    // Получаем текущее выделение пользователя
    const selection = figma.currentPage.selection;

    // Если ничего не выделено, отправляем сообщение об ошибке в UI и выходим
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({
        type: 'component-data-cleared',
        message: 'Выберите компоненты для очистки данных.',
        isError: true
      });
      return;
    }

    let dataCleared = false; // Флаг, указывающий, были ли данные очищены хотя бы для одного компонента
    let clearedComponents = 0; // Счетчик очищенных компонентов

    // Считаем количество подходящих компонентов (COMPONENT или COMPONENT_SET) в выделении
    let validComponentsCount = 0;
    for (const node of selection) {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        validComponentsCount++;
      }
    }

    // Если нет подходящих компонентов, отправляем сообщение об ошибке и выходим
    if (validComponentsCount === 0) {
      figma.ui.postMessage({
        type: 'component-data-cleared',
        message: 'Выделение не содержит компонентов или наборов компонентов.',
        isError: true
      });
      return;
    }

    // Очищаем данные только для компонентов и наборов компонентов
    for (const node of selection) {
      try {
        // Проверяем, является ли узел компонентом или набором компонентов
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          // Устанавливаем пустые строки для пользовательских данных 'customKey' и 'customVersion'
          node.setPluginData('customKey', '');
          node.setPluginData('customVersion', '');
          console.log(`Очищены данные компонента ${node.id} (${node.type}) (${node.name})`);
          dataCleared = true; // Устанавливаем флаг
          clearedComponents++; // Увеличиваем счетчик
        } else {
          //console.log(`Пропускаем нод ${node.id} (${node.name}), так как он не является компонентом или набором компонентов`);
        }
      } catch (error) {
        // Обработка ошибок при очистке данных для конкретного компонента
        console.error(`Ошибка при очистке данных компонента ${node.id} (${node.name}):`, error);
      }
    }

    // Отправляем сообщение в UI о результате операции
    if (dataCleared) {
      figma.ui.postMessage({
        type: 'component-data-cleared',
        message: `Данные успешно очищены для ${clearedComponents} компонентов.`
      });
    } else {
      figma.ui.postMessage({
        type: 'component-data-cleared',
        message: 'Не удалось очистить данные компонентов.',
        isError: true
      });
    }
  }

  // === Новый обработчик для проверки обновлений по кнопке ===
  else if (msg.type === 'check-updates') {
    console.log('Received update check request');
    let componentsResult = null;

    // Use the component data sent from UI
    if (msg.components && msg.components.instances) {
      componentsResult = msg.components;
    }

    if (!componentsResult || !componentsResult.instances || componentsResult.instances.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'No components to check for updates. Please run a search first.'
      });
      return;
    }

    try {
      await checkComponentUpdates(componentsResult);
    } catch (error) {
      console.error('Error during update check:', error);
      figma.ui.postMessage({
        type: 'error', 
        message: `Error checking for updates: ${error.message}`
      });
    }
  }
};



/**
 * Проверяет наличие заливки или обводки у узла
 * Анализирует свойства fills и strokes на наличие видимых
 * сплошных цветов (SOLID)
 * @param {SceneNode} node - Узел для проверки
 * @returns {boolean} true если узел имеет заливку или обводку, иначе false
 */
function hasFillOrStroke(node) {
  // Проверяем, является ли fills массивом и содержит ли элементы
  // ИЛИ проверяем, является ли strokes массивом и содержит ли элементы
  return (Array.isArray(node.fills) && node.fills.length > 0) ||
         (Array.isArray(node.strokes) && node.strokes.length > 0);
}

/**
 * Преобразует RGB цвет (компоненты 0-1) в HEX формат (#RRGGBB)
 * Обрабатывает особые случаи:
 * - figma.mixed значения (возвращает #000000)
 * - Некорректные значения (возвращает #000000)
 * - Масштабирование из диапазона 0-1 в 0-255
 * @param {Object} color - Объект с компонентами цвета
 * @param {number} color.r - Красный компонент (0-1)
 * @param {number} color.g - Зеленый компонент (0-1)
 * @param {number} color.b - Синий компонент (0-1)
 * @returns {string} Цвет в формате HEX (#RRGGBB)
 */
function rgbToHex({ r, g, b }) {
  try {
    // Проверяем, что все значения определены и являются числами
    if (r === undefined || g === undefined || b === undefined ||
        typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') {
      //console.error('Неверные значения RGB:', { r, g, b });
      return '#000000'; // Возвращаем черный цвет в случае некорректных данных
    }

    // Если значение уже было рассчитано ранее, возвращаем его
    const key = `${Math.round(r * 255)}-${Math.round(g * 255)}-${Math.round(b * 255)}`;
    if (rgbToHexCache.has(key)) {return rgbToHexCache.get(key);}

    // Вспомогательная функция для конвертации компонента (0-1) в 16-ричную строку (00-FF)
    const toHex = (n) => {
      const hex = Math.round(n * 255).toString(16); // Масштабируем, округляем и конвертируем в 16-ричную строку
      return hex.length === 1 ? '0' + hex : hex; // Добавляем ведущий ноль, если нужно
    };

    // Формируем HEX строку
    const hex = '#' + toHex(r) + toHex(g) + toHex(b);
    rgbToHexCache.set(key, hex);
    return hex;
  } catch (error) {
    // Обработка ошибок в процессе конвертации
    //console.error('Ошибка при конвертации RGB в HEX:', error);
    return '#000000'; // Возвращаем черный цвет в случае ошибки
  }
}



/**
 * Обрабатывает цвета (заливки и обводки) для отдельного узла
 * Извлекает информацию о цвете, привязанных переменных и применяет фильтры.
 * @param {SceneNode} node - Узел для обработки
 * @param {Object} colorsResult - Объект для сбора результатов по заливкам
 * @param {Object} colorsResultStroke - Объект для сбора результатов по обводкам
 * @returns {Promise<Object|null>} Данные о цветах узла или null, если узел отфильтрован
 */
async function processNodeColors(node, colorsResult, colorsResultStroke) {
  //console.log(`\\n=== Начало обработки цветов для узла \"${node.name}\" (ID: ${node.id}) ===`);

  // Инициализируем объект для хранения данных узла о цветах
  const nodeData = {
    name: node.name, // Имя узла
    nodeId: node.id, // ID узла
    key: node.key, // Ключ узла
    color: true, // Флаг, указывающий, что узел имеет цвет
    hidden: isNodeOrParentHidden(node), // Статус скрытия узла или его родителя
    type: node.type // Тип узла
  };

  //console.log('Базовые данные узла:', {
  //  name: nodeData.name,
  //  id: nodeData.nodeId,
  //  type: nodeData.type,
  //  hidden: nodeData.hidden
  //});

  // Находим имя родительского компонента (если узел является инстансом внутри инстанса)
  //console.log('Поиск родительского компонента...');
  let parentComponentName = null;
  let parentNode = node.parent; // Начинаем с непосредственного родителя

  // Поднимаемся по иерархии родителей, пока не найдем родителя типа INSTANCE или не достигнем корня
  while (parentNode && !parentComponentName) {
    //console.log(`Проверка родителя: ${parentNode.type} (${parentNode.name})`);
    // Если родитель - INSTANCE
    if (parentNode.type === 'INSTANCE') {
      try {
        // Используем асинхронный метод для получения главного компонента родительского инстанса
        const parentMainComponent = await parentNode.getMainComponentAsync();
        // Если главный компонент родителя найден
        if (parentMainComponent) {
          // Используем имя главного компонента родителя
          parentComponentName = parentMainComponent.name;
          // Если главный компонент родителя является частью набора, используем имя набора
          if (parentMainComponent.parent && parentMainComponent.parent.type === 'COMPONENT_SET') {
            parentComponentName = parentMainComponent.parent.name;
        //console.warn(`Найден родительский компонент в наборе: ${parentComponentName}`);
          } else {
            //console.log(`Найден родительский компонент: ${parentComponentName}`);
          }
        }
      } catch (error) {
        // Обработка ошибок при получении главного компонента родителя
        console.error(`Ошибка при получении mainComponent для родителя ${parentNode.name}:`, error);
      }
    }
    parentNode = parentNode.parent; // Переходим к следующему родительскому узлу
  }

  // Если имя родительского компонента найдено, добавляем его в данные узла
  if (parentComponentName) {
    nodeData.parentComponentName = parentComponentName;
    //console.log(`Установлено имя родительского компонента: ${parentComponentName}`);
  } else {
    //console.log('Родительский компонент не найден');
  }

  // Обрабатываем заливку (fills) узла
  //console.log('\nОбработка заливки...');
  // Проверяем наличие заливок и что массив не пустой
  if (node.fills && node.fills.length > 0) {
    //console.log(`Найдено ${node.fills.length} заливок`);
    // Итерируем по заливкам
    for (const fill of node.fills) {
      // Обрабатываем только видимые сплошные заливки (SOLID)
      if (fill.type === 'SOLID' && fill.visible !== false) {
        //console.log('Найдена видимая сплошная заливка');
        try {
          // Проверяем, что у заливки есть объект цвета
          if (fill.color && typeof fill.color === 'object') {
            // Извлекаем компоненты цвета
            const color = {
              r: typeof fill.color.r === 'number' ? fill.color.r : 0,
              g: typeof fill.color.g === 'number' ? fill.color.g : 0,
              b: typeof fill.color.b === 'number' ? fill.color.b : 0
            };
            // Конвертируем цвет в HEX и сохраняем в nodeData
            nodeData.fill = rgbToHex(color);
            //console.log(`Цвет заливки преобразован в HEX: ${nodeData.fill}`);
            break; // Прерываем цикл после нахождения первой видимой SOLID заливки
          }
        } catch (error) {
          // Обработка ошибок при обработке цвета заливки
          //console.log('Ошибка при обработке цвета заливки:', error);
          nodeData.fill = '#MIXED'; // В случае ошибки помечаем как смешанный цвет
        }
      }
    }
  }

  // === ДОБАВЛЯЕМ: обработка fillStyleId ===
  if (node.fillStyleId && node.fillStyleId !== figma.mixed) {
    try {
      const fillStyle = await figma.getStyleByIdAsync(node.fillStyleId);
      if (fillStyle) {
        nodeData.fill_variable_name = fillStyle.name;
        nodeData.fill_collection_id = node.fillStyleId.split(",")[0];
        nodeData.fill_collection_name = fillStyle.description || '';
      } else {
        nodeData.fill_variable_name = node.fillStyleId;
      }
    } catch (e) {
      nodeData.fill_variable_name = node.fillStyleId;
    }
  }

  // Обрабатываем обводку (strokes) узла
  //console.log('\nОбработка обводки...');
  // Проверяем наличие обводок и что массив не пустой
  if (node.strokes && node.strokes.length > 0) {
    //console.log(`Найдено ${node.strokes.length} обводок`);
    // Итерируем по обводкам
    for (const stroke of node.strokes) {
      // Обрабатываем только видимые сплошные обводки (SOLID)
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        //console.log('Найдена видимая сплошная обводка');
        try {
          // Проверяем, что у обводки есть объект цвета
          if (stroke.color && typeof stroke.color === 'object') {
            // Извлекаем компоненты цвета
            const color = {
              r: typeof stroke.color.r === 'number' ? stroke.color.r : 0,
              g: typeof stroke.color.g === 'number' ? stroke.color.g : 0,
              b: typeof stroke.color.b === 'number' ? stroke.color.b : 0
            };
            // Конвертируем цвет в HEX и сохраняем в nodeData
            nodeData.stroke = rgbToHex(color);
            //console.log(`Цвет обводки преобразован в HEX: ${nodeData.stroke}`);
            break; // Прерываем цикл после нахождения первой видимой SOLID обводки
          }
        } catch (error) {
          // Обработка ошибок при обработке цвета обводки
          //console.log('Ошибка при обработке цвета обводки:', error);
          nodeData.stroke = '#MIXED'; // В случае ошибки помечаем как смешанный цвет
        }
      }
    }
  }

  // === ДОБАВЛЯЕМ: обработка strokeStyleId ===
  if (node.strokeStyleId && node.strokeStyleId !== figma.mixed) {
    try {
      const strokeStyle = await figma.getStyleByIdAsync(node.strokeStyleId);
      if (strokeStyle) {
        nodeData.stroke_variable_name = strokeStyle.name;
        nodeData.stroke_collection_id = node.strokeStyleId.split(",")[0];
        nodeData.stroke_collection_name = strokeStyle.description || '';
      } else {
        nodeData.stroke_variable_name = node.strokeStyleId;
      }
    } catch (e) {
      nodeData.stroke_variable_name = node.strokeStyleId;
    }
  }

  // Обрабатываем привязки переменных цвета к заливкам и обводкам
  //console.log('\nОбработка привязок переменных...');
  // Проверяем наличие привязанных переменных у узла
  if (node.boundVariables) {
    //console.log('Найдены привязки переменных');
    // Обрабатываем привязки для заливок
    await processVariableBindings(node, nodeData, 'fills', 'fill');
    // Обрабатываем привязки для обводок
    await processVariableBindings(node, nodeData, 'strokes', 'stroke');
  } else {
    //console.log('Привязки переменных не найдены');
  }

  // Проверяем условия фильтрации узлов с цветами
  let parent = node.parent; // Получаем родителя узла

  // КОСТЫЛЬ: не обрабатываем ноды с определенными цветами (черный, белый, #FF33BB),
  // у которых любой из родителей называется 'source' и является группой. Это фильтр для исходников иконок.
  function hasParentWithNameAndType(node, targetName, targetType) {
    let current = node.parent;
    while (current) {
      if (
        current.name &&
        current.name.toLowerCase() === targetName &&
        current.type === targetType
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
  const excludedColors = ['#000000', '#ffffff', 'FFFFFF', '#ff33bb'];
  if (
    (excludedColors.includes(nodeData.fill) || excludedColors.includes(nodeData.stroke)) &&
    hasParentWithNameAndType(node, 'source', 'GROUP')
  ) {
    return null; // Возвращаем null, чтобы исключить узел из результатов
  }
  // КОСТЫЛЬ: не обрабатываем ноды с определенными цветами (черный, белый, #FF33BB),
  // у которых любой из родителей называется 'group' и является группой. Это фильтр для исходников продуктовых логотипов.
  if (
    (excludedColors.includes(nodeData.fill) || excludedColors.includes(nodeData.stroke)) &&
    hasParentWithNameAndType(node, 'group', 'GROUP')
  ) {
    return null; // Возвращаем null, чтобы исключить узел из результатов
  }
  // Игнорируем фиолетовую обводку у узлов типа COMPONENT_SET (стандартная обводка Figma)
  if (nodeData.stroke ==='#9747ff' && node.type==="COMPONENT_SET") return null;


  // Если узел имеет заливку (после фильтрации), добавляем его в список результатов заливок
  if (nodeData.fill) {
    if (Array.isArray(colorsResult.instances)) {
        colorsResult.instances.push(nodeData);
       // console.log('Added fill to colorsResult.instances:', nodeData);
    } else {
        console.error('colorsResult.instances is not an array:', colorsResult.instances);
    }
}
// Если узел имеет обводку (после фильтрации), добавляем его в список результатов обводок
if (nodeData.stroke) {
  if (Array.isArray(colorsResultStroke.instances)) {
      colorsResultStroke.instances.push(nodeData);
     // console.log('Added fill to colorsResult.instances:', nodeData);
  } else {
      console.error('colorsResult.instances is not an array:', colorsResultStroke.instances);
  }
}

// Возвращаем данные узла, если он не был отфильтрован
return nodeData;
}

/**
 * Обрабатывает компонент или инстанс узла, собирает информацию о нем, его главном компоненте и статусе актуальности.
 * @param {SceneNode} node - Узел (INSTANCE или COMPONENT) для обработки
 * @param {Object} componentsResult - Объект для хранения результатов компонентов
 * @returns {Promise<Object|null>} Объект с данными компонента или null, если узел не является INSTANCE или COMPONENT
 */
async function processNodeComponent(node, componentsResult) {
      /*console.log(`[processNodeComponent] Начало обработки узла:`, {
        id: node.id,
        type: node.type,
        name: node.name,
        hasParent: !!node.parent
      });*/

      let mainComponent = null; // Переменная для хранения главного компонента
      // Если узел является инстансом, получаем его главный компонент
      if (node.type === 'INSTANCE') {
        try {
          //console.log(`[processNodeComponent] Получаем mainComponent для инстанса:`, node.name);
          mainComponent = await node.getMainComponentAsync(); // Асинхронно получаем главный компонент
          //console.log(`[processNodeComponent] Получен mainComponent:`, mainComponent ? `${mainComponent.name} (${mainComponent.remote})` : 'null');
        } catch (error) {
          // Обработка ошибок при получении главного компонента
          console.error(`[processNodeComponent] Ошибка при получении mainComponent для ${node.name}:`, error);
          figma.ui.postMessage({
            type: 'error',
            message: `Ошибка при получении mainComponent для ${node.name}: ${error.message}`
          });
          return null;
        }
      } else if (node.type === 'COMPONENT') {
        //console.log(`[processNodeComponent] Узел является компонентом:`, node.name);
        mainComponent = node; // Если это сам компонент, а не инстанс, он и есть главный компонент
      }

      let parentNode = node.parent; // Непосредственный родитель узла
      let name = node.name; // Имя узла

      // Получаем описание и версию, используя главный компонент (если есть) или сам узел
      const descriptionDataMain = await getDescription(node, mainComponent);
      let parentComponentName = null; // Имя родительского компонента (если вложен в инстанс)
      let mainComponentName = mainComponent ? mainComponent.name : null; // Имя главного компонента
      let mainComponentKey = mainComponent ? mainComponent.key : null; // Имя главного компонента

      // Если узел является набором компонентов (COMPONENT_SET), обрабатываем его дочерние элементы рекурсивно
      // (Примечание: в основном цикле check-all дети COMPONENT_SET обрабатываются напрямую, эта часть может быть избыточной или использоваться для других целей)
      if (node.type === 'COMPONENT_SET') {
        const results = [];
        // Обрабатываем сам COMPONENT_SET (если нужно получить его данные)
        const setData = await processComponentSetNode(node);
        if (setData) {
          // Не добавляем сам COMPONENT_SET в список компонентов, только его дочерние элементы
          // results.push(setData);
        }

        // Обрабатываем все дочерние узлы рекурсивно
        if (node.children) {
          for (const child of node.children) {
            const childResults = await processNodeComponent(child); // Рекурсивный вызов
            if (childResults) {
              if (Array.isArray(childResults)) {
                results.push(...childResults);
              } else {
                results.push(childResults);
              }
            }
          }
        }

        console.log('COMPONENT_SET recursive results:', results);
        return results; // Возвращаем результаты обработки дочерних элементов
      }

      // Проверяем, находится ли инстанс внутри другого инстанса
      let isNested = false;
      let parent = node.parent; // Начинаем с непосредственного родителя
      // Поднимаемся по иерархии родителей
      while (parent) {
        // Если найден родитель типа INSTANCE, устанавливаем флаг isNested и прерываем цикл
        if (parent.type === 'INSTANCE') {
          isNested = true;
          break;
        }
        parent = parent.parent; // Переходим к следующему родительскому узлу
      }

      // Определяем имя и ключ главного компонента или родительского ComponentSet
      let componentKeyToUse = mainComponent ? mainComponent.key : null; // Ключ главного компонента по умолчанию
      let mainComponentSetKey = null; // Ключ набора компонентов, если есть
      let mainComponentSetName = null; // Имя набора компонентов, если есть
      let mainComponentSetId = null; // ID набора компонентов, если есть

      // Если главный компонент является частью набора, используем имя и ключ набора
      if (mainComponent && mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
        componentKeyToUse = mainComponent.parent.key; // Ключ родительского ComponentSet
        mainComponentSetName = mainComponent.parent.name; // Имя набора
        mainComponentSetKey = mainComponent.parent.key; // Ключ набора компонентов
        mainComponentSetId = mainComponent.parent.id; // id набора компонентов
      } else if (mainComponent) {
         //mainComponentName = mainComponent.name; // Для одиночных компонентов/инстансов используем имя главного компонента
      }

      // Используем await, так как getDescription теперь асинхронная (получаем описание и версию из самого узла, если нет mainComponent)
      const descriptionDataSingle = await getDescription(node);

      // Повторно находим имя родительского компонента (если узел является инстансом внутри инстанса)
      // Эта логика дублируется с processNodeColors, возможно, стоит вынести в отдельную функцию
      while (parentNode && !parentComponentName) {
        if (parentNode.type === 'INSTANCE') {
          try {
            // Используем асинхронный метод для получения mainComponent родительского инстанса
            const parentMainComponent = await parentNode.getMainComponentAsync();
            if (parentMainComponent) {
              parentComponentName = parentMainComponent.name;
              if (parentMainComponent.parent && parentMainComponent.parent.type === 'COMPONENT_SET') {
                parentComponentName = parentMainComponent.parent.name;
            //console.log(`Найден родительский компонент в наборе: ${parentComponentName}`);
              } else {
                //console.log(`Найден родительский компонент: ${parentComponentName}`);
              }
            }
          } catch (error) {
            console.error(`Ошибка при получении mainComponent для родителя ${parentNode.name}:`, error);
          }
        }
        parentNode = parentNode.parent;
      }

      // Обрабатываем только узлы типа INSTANCE или COMPONENT (игнорируем COMPONENT_SET здесь)
      if ((node.type === 'INSTANCE' || node.type === 'COMPONENT') && typeof name === 'string' && name.trim() !== "") {
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
        const isIcon = dimensionsMatch &&
                    (nameStartsWithNumber && hasSlashAfterNumber || hasNumberTextSlashPattern);


        // Получаем пользовательские данные из PluginData
        let pluginDataKey = '';
        let pluginDataVersion = '';

        try {
          // Пробуем получить данные из PluginData самого узла
          pluginDataKey = node.getPluginData('customKey') || '';
          pluginDataVersion = node.getPluginData('customVersion') || '';

          // Если это инстанс и у него нет своих данных, проверяем PluginData главного компонента
          if (node.type === 'INSTANCE' && mainComponent && (!pluginDataKey || !pluginDataVersion)) {
            const pluginDataKey = mainComponent.getPluginData('customKey') || '';
            //const mainComponentVersion = mainComponent.getPluginData('customVersion') || '';

            // Используем данные из главного компонента, если у инстанса нет своих
            //if (mainComponentKey && !pluginDataKey) pluginDataKey = mainComponentKey;
            //if (mainComponentVersion && !pluginDataVersion) pluginDataVersion = mainComponentVersion;
          }

          //console.log(`Получены данные из PluginData для ${node.name}:`, { ключ: pluginDataKey, версия: pluginDataVersion });
        } catch (error) {
          // Обработка ошибок при получении PluginData
          console.error(`Ошибка при получении PluginData для ${node.name}:`, error);
        }

        let parent = node.parent; // Непосредственный родитель узла
        // Формируем объект с данными компонента/инстанса
        const componentData = {
          type: node.type, // Тип узла
          name: name.trim(), // Имя узла (без лишних пробелов)
          nodeId: node.id, // ID узла
          key: node.key, // Ключ узла
          description: descriptionDataMain ? descriptionDataMain.description : (descriptionDataSingle ? descriptionDataSingle.description : undefined), // Описание
          nodeVersion: descriptionDataMain ? descriptionDataMain.nodeVersion : (descriptionDataSingle ? descriptionDataSingle.nodeVersion : undefined), // Версия из описания
          hidden: isNodeOrParentHidden(node), // Статус скрытия
          remote: mainComponent.remote, // Является ли локальным компонентом
          parentName: parentComponentName ? parentComponentName : null, // Имя родительского компонента (если вложен в инстанс)
          parentId: parent ? parent.id : null, // ID родителя
          mainComponentName: mainComponentName, // Имя главного компонента или набора
          mainComponentKey: mainComponentKey, // Ключ главного компонента или набора
          mainComponentId: mainComponent ? mainComponent.id : null, // ID самого главного компонента
          mainComponentSetKey: mainComponentSetKey ? mainComponentSetKey : null, // Ключ набора компонентов (если есть)
          mainComponentSetName: mainComponentSetName ? mainComponentSetName : null, // Имя набора компонентов (если есть)
          mainComponentSetId: mainComponentSetId ? mainComponentSetId : null, // Имя набора компонентов (если есть)
          
          fileKey: figma.fileKey, // Ключ текущего файла Figma
          isIcon: isIcon, // Является ли иконкой
          size: isIcon ? width : `${width}x${height}`, // Размер (для иконок - одна сторона, для других - ШxВ)
          isNested: isNested, // Является ли вложенным инстансом
          skipUpdate: isNested, // Пропускать ли проверку обновления для вложенных инстансов
          pluginDataKey: pluginDataKey, // Пользовательский ключ из PluginData
          //pluginDataVersion: pluginDataVersion // Пользовательская версия из PluginData
        };
        // Если объект данных компонента создан и узел является INSTANCE или COMPONENT
        if (componentData && (node.type === 'INSTANCE' || node.type === 'COMPONENT')) {
            // Проверяем, что массив componentsResult.instances существует и является массивом
            if (Array.isArray(componentsResult.instances)) {
            // Добавляем данные компонента в массив результатов
            componentsResult.instances.push(componentData);
        // Увеличиваем счетчик компонентов
        componentsResult.counts.components = (componentsResult.counts.components || 0) + 1;
        // Если это иконка, увеличиваем счетчик иконок
        if (componentData.isIcon) {
            componentsResult.counts.icons = (componentsResult.counts.icons || 0) + 1;
        }
        //console.log('Added to componentsResult.instances:', componentData);
    } else {
        // Логируем ошибку, если componentsResult.instances не массив
        console.error('componentsResult.instances is not an array:', componentsResult.instances);
    }
}
        // Возвращаем собранные данные компонента
        return componentData;
      }
      // Если узел не является INSTANCE или COMPONENT, возвращаем null
      return null;
}

// Вспомогательная функция для обработки узлов COMPONENT_SET и их дочерних компонентов
// (В текущей версии кода используется только для получения данных о самом COMPONENT_SET, если нужно)
async function processComponentSetNode(node, parentSet = null) {
  // Эта функция теперь в основном используется для получения данных о самом COMPONENT_SET, если это необходимо.
  // Рекурсивный обход дочерних элементов перенесен в processNodeComponent.

  const name = node.name; // Имя набора компонентов
  // Используем await, так как getDescription теперь асинхронная (получаем описание и версию набора)
  const descriptionDataSet = await getDescription(node);

  // Возвращаем данные только для самого COMPONENT_SET, если это необходимо
  // Если node.type === 'COMPONENT', это дочерний компонент, который будет обработан в processNodeComponent
  if (node.type === 'COMPONENT_SET' && typeof name === 'string' && name.trim() !== "") {
    return {
      type: node.type, // Тип узла (COMPONENT_SET)
      name: name.trim(), // Имя набора
      nodeId: node.id, // ID набора
      key: node.key, // Ключ набора
      description: descriptionDataSet ? descriptionDataSet.description : undefined, // Описание набора
      nodeVersion: descriptionDataSet ? descriptionDataSet.nodeVersion : undefined, // Версия из описания набора
      hidden: isNodeOrParentHidden(node), // Статус скрытия
      remote: node.remote, // Является ли локальным набором
      parentName: parentSet ? parentSet.name : null, // Имя родительского набора (если вложен)
      parentId: parentSet ? parentSet.id : null, // ID родительского набора
      //mainComponentName: name, // Имя главного компонента (для набора это его собственное имя)
      //mainComponentKey: node.key, // Для COMPONENT_SET используем его собственный ключ
      //mainComponentId: node.id, // ID самого набора
      fileKey: figma.fileKey, // Ключ текущего файла Figma
      isIcon: false, // COMPONENT_SET сам по себе не является иконкой
      size: `${Math.round(node.width)}x${Math.round(node.height)}`, // Размеры COMPONENT_SET
      isNested: false, // COMPONENT_SET не может быть вложенным в инстанс
      skipUpdate: false // COMPONENT_SET не обновляется как инстанс
    };
  }

  // Если узел не является COMPONENT_SET, возвращаем null
  return null;
}

// Асинхронная функция для проверки обновлений списка компонентов
// (Закомментирована в основном цикле check-all, проверка актуальности интегрирована в processNodeComponent)
async function checkComponentUpdates(componentsResult) {
  console.log('\n=== Starting component update checks ===');
  
  // Use saved colors data from global variable
  const colorsData = lastColorsData || { instances: [], counts: { colors: 0 } };

  // Iterate through each component instance
  for (let i = 0; i < componentsResult.instances.length; i++) {
    const instance = componentsResult.instances[i];

    try {
      // Skip components without mainComponentId
      if (!instance.mainComponentId) {
        continue;
      }

      console.log(`Checking component: "${instance.name}" (mainComponentId: ${instance.mainComponentId})`);
      
      // Get the main component by ID
      const mainComponent = await figma.getNodeByIdAsync(instance.mainComponentId);

      // Skip if main component not found
      if (!mainComponent) {
        console.log(`Could not find component with ID: ${instance.mainComponentId}`);
        continue; 
      }

      // Check for updates
      const updateInfo = await checkComponentUpdate(mainComponent);

      // Update the instance info
      componentsResult.instances[i] = Object.assign({}, instance, {
        isOutdated: updateInfo.isOutdated,
        libraryComponentId: updateInfo.libraryComponentId, 
        libraryComponentVersion: updateInfo.libraryComponentVersion,
        mainComponentId: updateInfo.mainComponentId
      });

      // Send progress update to UI
      figma.ui.postMessage({
        type: 'progress-update',
        processed: i + 1,
        total: componentsResult.instances.length,
        currentComponentName: instance.name
      });

      // Send partial results update to UI
      figma.ui.postMessage({
        type: 'all-results',
        components: {
          instances: componentsResult.instances,
          counts: componentsResult.counts
        },
        colors: colorsData
      });

    } catch (componentError) {
      console.error(`Error checking component "${instance.name}":`, componentError);
      continue;
    }
  }

  // Send final completion message
  figma.ui.postMessage({
    type: 'all-results',
    components: {
      instances: componentsResult.instances, 
      counts: componentsResult.counts
    },
    colors: colorsData,
    complete: true
  });

  console.log('\n=== Component update checks completed ===');
}

/**
 * Обрабатывает привязки переменных цвета для указанного свойства узла (заливки или обводки)
 * Извлекает информацию о переменной и ее коллекции.
 * @param {SceneNode} node - Узел для обработки
 * @param {Object} nodeData - Объект с данными узла, куда будут добавлены данные о переменных
 * @param {string} propertyType - Тип свойства ('fills' или 'strokes')
 * @param {string} prefix - Префикс для имени свойства в nodeData ('fill' или 'stroke')
 */
async function processVariableBindings(node, nodeData, propertyType, prefix) {
  //console.log(`\\n--- Обработка привязок для ${propertyType} (префикс: ${prefix}) ---`);

  // Проверяем наличие привязанных переменных для указанного типа свойства
  if (node.boundVariables && node.boundVariables[propertyType]) {
    //console.log(`Найдены привязки для ${propertyType}`);
    // Получаем первую привязку для данного свойства
    const binding = node.boundVariables[propertyType][0];

    // Если привязка существует
    if (binding) {
      //console.log(`Обработка привязки: ${binding.id}`);
      try {
        // Асинхронно получаем объект переменной по ее ID
        const variable = await figma.variables.getVariableByIdAsync(binding.id);
        // Если переменная найдена
        if (variable) {
          // Сохраняем имя переменной в nodeData
          nodeData[`${prefix}_variable_name`] = variable.name;

          // Получаем коллекцию переменной
          try {
            // Асинхронно получаем объект коллекции переменной по ее ID
            const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
            // Если коллекция найдена
            if (collection) {
              // Сохраняем имя и ID коллекции в nodeData
              nodeData[`${prefix}_collection_name`] = collection.name;
              nodeData[`${prefix}_collection_id`] = collection.id;
              //console.log('Успешно получены данные переменной:', {
              //  variableName: variable.name,
              //  collectionName: collection.name,
              //  collectionId: collection.id
              //});
            } else {
              //console.log('Коллекция не найдена');
              nodeData[`${prefix}_collection_name`] = 'Коллекция не найдена'; // Помечаем, если коллекция не найдена
            }
          } catch (collectionError) {
            // Обработка ошибок при получении коллекции
            //console.error(`Ошибка при получении коллекции: ${collectionError}`);
            nodeData[`${prefix}_collection_name`] = 'Ошибка получения коллекции'; // Помечаем ошибку получения коллекции
          }
        } else {
          //console.log('Переменная не найдена по ID');
          // Если переменная не найдена по ID, ничего не делаем или помечаем как отсутствующую
        }
      } catch (error) {
        // Обработка ошибок при обработке переменной
        //console.error(`Ошибка при обработке переменной для ${propertyType}:`, error);
        nodeData[`${prefix}_variable_name`] = false; // Помечаем, что переменная не найдена из-за ошибки
        //console.log(`Установлено ${prefix}_variable_name = false из-за ошибки`);
      }
    } else {
      //console.log('Привязка не содержит данных');
      // Если привязка существует, но не содержит данных (например, ID переменной), ничего не делаем
    }
  } else {
    //console.log(`Привязки для ${propertyType} не найдены`);
    // Если привязки для данного типа свойства отсутствуют, ничего не делаем
  }

  //console.log(`--- Завершена обработка привязок для ${propertyType} ---\\n`);
}
