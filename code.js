// Глобальный обработчик ошибок для wasm/memory/out of bounds
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', event => {
    const err = event.reason;
    console.error('Global unhandledrejection:', err);
    if (err && err.message && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err.message)) {
      figma.notify('Критическая ошибка памяти Figma API. Плагин будет перезапущен.');
      setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 3000);
    }
  });
  window.addEventListener('error', event => {
    const err = event.error;
    console.error('Global error:', err);
    if (err && err.message && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err.message)) {
      figma.notify('Критическая ошибка памяти Figma API. Плагин будет перезапущен.');
      setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 3000);
    }
  });
}
// Show the UI
figma.showUI(__html__, { width: 600, height: 800 });

// Отправляем информацию о пользователе в UI
figma.ui.postMessage({
  type: 'user-info',
  user: {
    name: figma.currentUser.name,
    id: figma.currentUser.id,
  }
});



// Add cache storage at the top level
const componentUpdateCache = new Map();
// Добавляем массив для хранения результатов проверок
let resultsList = [];

// Добавляем глобальную переменную для хранения данных о цветах
let lastColorsData = null;

/**
 * Получает уникальный ключ кэширования для компонента
 * Если компонент находится в наборе компонентов (COMPONENT_SET),
 * использует комбинацию ключа родителя и имени компонента,
 * иначе использует собственный ключ компонента
 * @param {ComponentNode} component - Компонент для получения ключа
 * @returns {string} Уникальный ключ для кэширования
 */
function getComponentCacheKey(component) {
  try {
    // Проверяем наличие компонента
    if (!component) {
      //console.error('getComponentCacheKey: компонент не определен');
      return 'undefined_component';
    }

    // Проверяем наличие ключа компонента
    if (!component.key) {
      //console.error('getComponentCacheKey: у компонента отсутствует ключ');
      return `no_key_${component.id || 'unknown'}`;
    }

    // Проверяем наличие родителя и его тип
    if (component.parent && component.parent.type === 'COMPONENT_SET' && component.parent.key) {
      return `${component.parent.key}_${component.name || 'unnamed'}`;
    }

    return component.key;
  } catch (error) {
    //console.error('Ошибка в getComponentCacheKey:', error);
    return `error_${component.id || 'unknown'}`;
  }
}

/**
 * Проверяет, требует ли компонент обновления
 * Сравнивает текущий компонент с импортированной версией
 * Использует кэширование для оптимизации повторных проверок
 * @param {ComponentNode} mainComponent - Компонент для проверки
 * @returns {Promise<{isOutdated: boolean, importedId: string|null}>}
 */
async function checkComponentUpdate(mainComponent) {
  // Проверяем входные данные
  if (!mainComponent) {
    //console.error('checkComponentUpdate: получен пустой компонент');
    return {
      isOutdated: false,
      importedId: null,
      mainComponentId: null,
      importedMainComponentId: null
    };
  }

  try {
    const cacheKey = getComponentCacheKey(mainComponent);
    
    //console.log('Проверка компонента:', {
    //  name: mainComponent.name,
    //  key: mainComponent.key,
    //  id: mainComponent.id,
    //  mainComponentId: mainComponent.id,
    //  parentType: mainComponent.parent ? mainComponent.parent.type : 'нет родителя'
    //});

  let result = {
    isOutdated: false,
      importedId: null,
      version: null,
      description: null,
      mainComponentId: mainComponent.id,
      importedMainComponentId: null
    };

    // Проверяем наличие ключа у компонента
    if (!mainComponent.key) {
      //console.log('У компонента отсутствует ключ:', mainComponent.name);
      componentUpdateCache.set(cacheKey, result);
      return result;
    }

    const isPartOfSet = mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET';
    let importedComponent = null;

    if (isPartOfSet && mainComponent.parent && mainComponent.parent.key) {
      try {
        //console.log('Импортируем набор компонентов:', {
        //  parentKey: mainComponent.parent.key,
        //  componentName: mainComponent.name,
        //  mainComponentId: mainComponent.id
        //});
        
        const importedSet = await figma.importComponentSetByKeyAsync(mainComponent.parent.key);
        
        if (importedSet) {
          //console.log('Набор компонентов ', importedSet.name, "импортирован");
          let foundMatch = false;
          importedComponent = importedSet.findChild(comp => {
            if (comp.name === mainComponent.name && comp.type === 'COMPONENT') {
              foundMatch = true;
              return true;
            }
            return false;
          });
          
          const importedSetDescData = await getDescription(importedSet);
          result = {
            isOutdated: importedComponent ? importedComponent.id !== mainComponent.id : false,
            mainComponentId: mainComponent.id,
            libraryComponentId: importedComponent ? importedComponent.id : null,
            libraryComponentVersion: importedSetDescData.nodeVersion,
            description: importedSetDescData.description
          };
          
          if (!foundMatch) {
            result.isOutdated = true;
            //console.log('Совпадений по ID в наборе не найдено');
           }

           //console.log('Результат поиска в наборе:', foundMatch ? 'Компонент с таким ID в наборе не найден' : result);
        } else {
          //console.log('Не удалось импортировать набор компонентов');
        }
      } catch (setError) {
        console.error('Ошибка при импорте набора компонентов:', setError);
      }
    } else {
      try {
        //console.log('Импортируем отдельный компонент по ключу:', {
        //  key: mainComponent.key,
        //  mainComponentId: mainComponent.id
        //});
        importedComponent = await figma.importComponentByKeyAsync(mainComponent.key);
        //console.log('Результат импорта компонента:', importedComponent ? {
        //  success: true,
        //  importedMainComponentId: importedComponent.id,
        //  mainComponentId: mainComponent.id
        //} : 'не удалось');
      } catch (componentError) {
        console.error('Ошибка при импорте компонента:', componentError);
      }
      
    const importedDescData = importedComponent ? await getDescription(importedComponent) : { description: null, nodeVersion: null };
    result = {
      isOutdated: importedComponent ? importedComponent.id !== mainComponent.id : false,
        importedId: importedComponent ? importedComponent.id : null,
        version: importedDescData.nodeVersion,
        mainComponentId: mainComponent.id,
        importedMainComponentId: importedComponent ? importedComponent.id : null,
        description: importedDescData.description
      };
    
    }
    

    // Сохраняем результат в кэш
    //componentUpdateCache.set(cacheKey, result);
    
    /*
    console.log('Результат проверки компонента:', {
      name: mainComponent.name,
      isOutdated: result.isOutdated,
      //cacheKey,
      libraryComponentId: result.libraryComponentId,
      libraryComponentVersion: result.libraryComponentVersion,
    });
*/
    return result;

  } catch (error) {
    console.error('Ошибка при проверке компонента:', {
      componentName: mainComponent ? mainComponent.name : 'неизвестно',
      error: error.message,
      stack: error.stack
    });
    
    const safeResult = {
      isOutdated: false,
      importedId: null,
      libraryName: null,
      mainComponentId: mainComponent ? mainComponent.id : null,
      importedMainComponentId: null
    };
    
    try {
      const cacheKey = getComponentCacheKey(mainComponent);
      componentUpdateCache.set(cacheKey, safeResult);
    } catch (cacheError) {
      console.error('Не удалось сохранить результат в кэш:', cacheError);
    }

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
  const path = [];
  let current = node;

  // Collect all IDs along the parent chain
  while (current && current.parent) {
    path.unshift(current.id);
    current = current.parent;
  }

  // Form the path string, adding the necessary separators
  return path.join(',');
}

/**
 * Извлекает версию из описания компонента
 * @param {SceneNode} node - Узел для получения описания
 * @returns {Promise<Object>} Объект с описанием и версией
 */
// getDescription(node, mainComponent)
// Если mainComponent передан — используем его для получения описания и версии. Иначе работаем по старой логике.
async function getDescription(node, mainComponent = null) {
  let description = '';
  if (mainComponent) {
    description = mainComponent.description || '';
    if (!description && mainComponent.parent) {
      description = mainComponent.parent.description;
    }
  } else {
    description = node.description || '';
    if (!description && node.type === 'INSTANCE') {
      try {
        let mc = null;
        try {
          mc = await node.getMainComponentAsync();
        } catch (error) {
          console.error(`Ошибка при получении mainComponent для ${node.name}:`, error);
        }
        if (mc) {
          description = mc.description || '';
          if (!description && mc.parent) {
            description = mc.parent.description;
          }
        }
      } catch (error) {
        console.error(`Ошибка при получении mainComponent в getDescription:`, error);
      }
    }
  }
  // Извлекаем версию
  let nodeVersion = null;
  if (description) {
    const versionPattern = /v\s*(\d+\.\d+\.\d+)/i;
    const match = description.match(versionPattern);
    nodeVersion = match ? match[1] : null;
  }
  return { description, nodeVersion };
}

/**
 * Проверяет, скрыт ли узел или любой из его родителей
 * @param {SceneNode} node - Узел для проверки
 * @returns {boolean} true если узел или любой из родителей скрыт
 */
function isNodeOrParentHidden(node) {
  let currentNode = node;
  while (currentNode) {
    if (currentNode.visible === false) {
      return true; // Если текущий узел скрыт, возвращаем true
    }
    currentNode = currentNode.parent; // Переходим к родителю
  }
  return false; // Если ни один из узлов не скрыт, возвращаем false
}

/**
 * Проверяет, является ли узел вложенным в другой экземпляр
 * Рекурсивно проверяет родителей узла на тип INSTANCE
 * @param {SceneNode} node - Узел для проверки
 * @returns {boolean} true если узел вложен в другой экземпляр
 */
function isNestedInstance(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'INSTANCE') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

// Добавляем вспомогательную функцию для задержки
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Добавляем функцию для отправки прогресса
async function updateProgress(phase, processed, total, message) {
  figma.ui.postMessage({
    type: 'progress-update',
    phase,
    processed,
    total,
    message
  });
  // Небольшая задержка для обработки UI
  await delay(1);
}

/**
 * Основной обработчик сообщений от UI плагина
 * Обрабатывает следующие типы сообщений:
 * 
 * 1. 'list-instances':
 *    - Ищет все экземпляры компонентов в выбранном фрейме/секции
 *    - Собирает информацию о каждом экземпляре (имя, размеры, описание и т.д.)
 *    - Определяет, является ли компонент иконкой на основе размеров и имени
 *    - Отправляет собранные данные обратно в UI
 * 
 * 2. 'list-colors':
 *    - Анализирует все элементы в выбранном фрейме/секции на наличие цветов
 *    - Собирает информацию о заливках, обводках и связанных переменных
 *    - Проверяет API переменных Figma и логирует отладочную информацию
 *    - Отправляет собранные данные о цветах обратно в UI
 * 
 * 3. 'scroll-to-node':
 *    - Находит узел по переданному ID
 *    - Прокручивает и масштабирует вид к найденному узлу
 *    - Выделяет узел в интерфейсе Figma
 * 
 * 4. 'select-nodes':
 *    - Принимает массив ID узлов
 *    - Находит все указанные узлы
 *    - Выделяет группу узлов в интерфейсе Figma
 *    - Прокручивает вид к выделенным узлам
 * 
 * 5. 'check-all':
 *    - Последовательно вызывает проверку компонентов и цветов
 *    - Собирает и отправляет результаты проверки в UI
 * 
 * @param {Object} msg - Объект сообщения от UI
 * @param {string} msg.type - Тип сообщения ('list-instances', 'list-colors', 'scroll-to-node', 'select-nodes', 'check-all')
 * @param {string} [msg.nodeId] - ID узла для прокрутки (для 'scroll-to-node')
 * @param {string[]} [msg.nodeIds] - Массив ID узлов для выделения (для 'select-nodes')
 */
figma.ui.onmessage = async (msg) => {
  console.log('Получено сообщение от UI:', msg.type);
  
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }
  
  // Обработчики для работы с данными компонента
  // Обработчик get-component-data перенесен в другое место кода

  // Обработчик clear-component-data перенесен в другое место кода
  
  if (msg.type === 'check-all') {
    const selection = figma.currentPage.selection;

    if (!selection || selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Выберите фрейм, компонент или инстанс!' 
      });
      return;
    }

    // Удаляем const container = selection[0];
    // Вместо этого собираем все уникальные узлы из всех выделенных элементов и их потомков
    const uniqueNodesToProcess = new Set();

    // Проходим по всем выделенным элементам
    for (const selectedNode of selection) {
      // Добавляем сам выделенный узел, если это INSTANCE, COMPONENT, COMPONENT_SET или имеет fills/strokes
      // Узлы других типов (например, TEXT, VECTOR) будут добавлены через findAll, если они внутри контейнера
      /*if (selectedNode.type === 'INSTANCE' || selectedNode.type === 'COMPONENT' || selectedNode.type === 'COMPONENT_SET' || hasFillOrStroke(selectedNode)) {
         uniqueNodesToProcess.add(selectedNode);*/
         if (selectedNode.type === 'INSTANCE' || selectedNode.type === 'COMPONENT' || selectedNode.type === 'COMPONENT_SET') {
          uniqueNodesToProcess.add(selectedNode);
      }

      // Если узел является контейнером, добавляем все его дочерние узлы
      if (typeof selectedNode.findAll === 'function') {
        const allDescendants = selectedNode.findAll();
        for (const descendant of allDescendants) {
           uniqueNodesToProcess.add(descendant);
        }
      }
    }

    const nodesToProcess = Array.from(uniqueNodesToProcess);

    if (nodesToProcess.length === 0) {
       figma.ui.postMessage({ 
         type: 'error', 
         message: 'В выделенной области нет поддерживаемых элементов (компоненты, инстансы, элементы с цветами).' 
       });
       return;
    }


    let componentsResult = {
      instances: [],
      counts: {
        components: 0,
        icons: 0
      }
    };
    let colorsResult = {
      instances: [],
      counts: {
        colors: 0
      }
    };
    let colorsResultStroke = {
      instances: [],
      counts: {
        colors: 0
      }
    };

    try {
      // Логируем текущее выделение и nodesToProcess
      //console.log('SELECTION RAW:', selection);
      //console.log('NODES TO PROCESS RAW:', nodesToProcess);

      await updateProgress('processing', 0, nodesToProcess.length, 'Обработка элементов');

      // Обрабатываем узлы по одному с задержкой
      const processNodeSafely = async (node, index) => {
        if (!node || !node.type) {
          console.warn(`[${index + 1}] Пропущен невалидный узел:`, node);
          return;
        }
        //console.log(`[${index + 1}] RAW NODE (без сериализации):`, node);
        
        if (!node || !node.type) return;
        
        try {
          //console.log(`[${index + 1}/${filteredNodesToProcess.length}] Processing node:`, node.type, node.name);

          // Проверка на цвет (fills/strokes)
          let hasColor = false;
          try {
            hasColor = hasFillOrStroke(node);
            //console.log(`[${index + 1}] hasFillOrStroke:`, hasColor);
          } catch (err) {
            console.error(`[${index + 1}] ERROR in hasFillOrStroke:`, err);
          }

          // Обработка цветов
          if (hasColor) {
            try {
              await processNodeColors(node, colorsResult, colorsResultStroke);
            } catch (err) {
              console.error(`[${index + 1}] ERROR in processNodeColors:`, err);
            }
          }
          
          // Обработка компонентов
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
      
      // Лог перед циклом обработки
      //console.log('Перед циклом обработки, filteredNodesToProcess:', filteredNodesToProcess);
      // Восстановленная обработка узлов
      for (let i = 0; i < nodesToProcess.length; i++) {
        await processNodeSafely(nodesToProcess[i], i);
        // Обновляем прогресс после каждого узла
        
        // Даем браузеру "подышать" после каждого узла
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          await updateProgress('processing', i + 1, nodesToProcess.length, 'Обработка элементов');
        }
      }
      //console.log('После цикла обработки');

      // Сортировка компонентов
      componentsResult.instances.sort((a, b) => {
        const aName = a.mainComponentName || a.name;
        const bName = b.mainComponentName || b.name;
        
        // Функция для удаления эмодзи из строки (обновленное регулярное выражение)
        const removeEmoji = (str) => str.replace(/([\u0023-\u0039]\uFE0F?\u20E3|\u00A9|\u00AE|[\u2000-\u3300]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])/gu, '').trim();
        
        // Функция для проверки специальных символов в начале
        const startsWithSpecial = (str) => /^[._]/.test(str);
        
        const cleanA = removeEmoji(aName);
        const cleanB = removeEmoji(bName);
        
        // Сначала проверяем специальные символы
        const aSpecial = startsWithSpecial(cleanA);
        const bSpecial = startsWithSpecial(cleanB);
        
        if (aSpecial && !bSpecial) return 1;
        if (!aSpecial && bSpecial) return -1;
        
        // Если оба имеют или не имеют спец. символы, сортируем по тексту
        return cleanA.localeCompare(cleanB);
      });
      
      
      console.log('Final components result:', {
        total: componentsResult.instances.length,
        components: componentsResult.counts.components,
        icons: componentsResult.counts.icons,
        instances: componentsResult.instances
      });
      
      // Сохраняем результаты в общий массив
      resultsList = componentsResult.instances.map(instance => {
        return Object.assign({}, instance, {
          updateStatus: null // Будет заполнено позже при проверке обновлений
        });
      });

      // Сохраняем данные о цветах
      lastColorsData = colorsResult;
      
      // Отправляем первичные результаты в UI
      // Формируем дерево только для выбранных элементов
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
      figma.ui.postMessage({
        type: 'all-results',
        components: componentsResult,
        colors: colorsResult,
        colorsStroke: colorsResultStroke,
        componentTree: componentTree
      });
      await delay(30);
      // Второй этап: асинхронная проверка обновлений
      //await checkComponentUpdates(componentsResult);
      
    } catch (error) {
      console.error('Ошибка при проверке:', error);
      figma.notify(`Ошибка при проверке: ${error.message}`);
      figma.ui.postMessage({ type: 'error', message: `Ошибка при проверке: ${error.message}` });
      return;
    }
  } 
  
  // Обработка запроса на прокрутку к определенному узлу
  else if (msg.type === 'scroll-to-node') {
    // Use async for getNodeByIdAsync
    (async () => {
      try {
        //console.log('[PLUGIN] scroll-to-node received:', msg.nodeId);
        const nodeId = msg.nodeId;
        let node = null;
        try {
          node = await figma.getNodeByIdAsync(nodeId);
        } catch (err) {
          console.error('[PLUGIN] getNodeByIdAsync error:', err);
          figma.notify('Ошибка доступа к элементу: ' + err.message);
          return;
        }
        console.log('[PLUGIN] Node found:', !!node, node);
        if (node && 'type' in node && typeof node.visible === 'boolean') {
          // Проверяем, на той ли странице node
          let page = node.parent;
          while (page && page.type !== 'PAGE') page = page.parent;
          if (page && page.id && page.id !== figma.currentPage.id) {
            //console.log('Node is on another page:', page.name);
            figma.currentPage = page;
          }
          try {
            figma.viewport.scrollAndZoomIntoView([node]);
            figma.currentPage.selection = [node];
          } catch (err) {
            console.error('Ошибка scrollAndZoomIntoView:', err, node);
            figma.notify('Ошибка позиционирования: ' + err.message);
            if (err && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err.message)) {
              figma.notify('Критическая ошибка Figma API. Плагин будет перезапущен.');
              setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 3000);
            }
          }
        } else if (node) {
          console.warn('Node is not a valid SceneNode:', node);
          figma.notify('Выбранный элемент не поддерживается для прокрутки.');
        } else {
          figma.notify('Не удалось найти узел с указанным ID.');
        }
      } catch (criticalErr) {
        console.error('Critical error in scroll-to-node:', criticalErr);
        figma.notify('Критическая ошибка работы с элементом: ' + (criticalErr.message || criticalErr));
        if (criticalErr && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(criticalErr.message)) {
          figma.notify('Критическая ошибка Figma API. Плагин будет перезапущен.');
          setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 3000);
        }
      }
    })();
  } 
  // Обработка запроса на выбор группы узлов
  else if (msg.type === 'select-nodes') {
    (async () => {
      const nodeIds = msg.nodeIds;
      // console.log('Выбираем группу узлов:', nodeIds);
      // Проверяем корректность входных данных
      if (!nodeIds || nodeIds.length === 0) {
        figma.notify('Не указаны ID узлов для выбора');
        return;
      }
      let nodes = [];
      try {
        // Асинхронно ищем все узлы по id
        const foundNodes = await Promise.all(
          nodeIds.map(async id => {
            try {
              const n = await figma.getNodeByIdAsync(id);
              return n && 'type' in n && typeof n.visible === 'boolean' ? n : null;
            } catch (err) {
              console.error('Ошибка getNodeByIdAsync:', id, err);
              return null;
            }
          })
        );
        nodes = foundNodes.filter(n => n !== null);
      } catch (err) {
        console.error('Ошибка при поиске группы узлов:', err);
        figma.notify('Ошибка при поиске группы узлов: ' + err.message);
        return;
      }
      // Проверяем, найдены ли узлы
      if (nodes.length === 0) {
        figma.notify('Не удалось найти ни один из указанных узлов');
        return;
      }
      // Жёстко фильтруем только SceneNode
      const validNodes = nodes.filter(n => n && 'type' in n && typeof n.visible === 'boolean');
      //console.log('Valid nodes for selection:', validNodes.map(n => n && n.type), validNodes);
      if (validNodes.length === 0) {
        figma.notify('Нет валидных элементов для выделения!');
        return;
      }
      // Выделяем найденные узлы и прокручиваем к ним
      figma.currentPage.selection = validNodes;
      figma.viewport.scrollAndZoomIntoView(validNodes);
      figma.notify(`Выбрано ${validNodes.length} элементов`);
    })();
  }
  
  // Обработка запроса на чтение данных компонента
  else if (msg.type === 'get-component-data') {
    console.log('Получен запрос на чтение данных компонента');
    const selection = figma.currentPage.selection;
    
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'component-data-result', 
        message: 'Выберите компоненты для чтения данных.', 
        isError: true 
      });
      return;
    }
    
    const componentData = {};
    
    // Считаем количество подходящих компонентов в выделении
    let validComponentsCount = 0;
    for (const node of selection) {
      if (node.type === 'COMPONENT' || node.type === 'INSTANCE' || node.type === 'COMPONENT_SET') {
        validComponentsCount++;
      }
    }
    
    // Проверяем, есть ли подходящие компоненты
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
      // Здесь можно добавить обработку каждого выбранного узла, если потребуется
    }
    
    if (Object.keys(componentData).length > 0) {
      figma.ui.postMessage({ 
        type: 'component-data-result', 
        data: componentData 
      });
    } else {
      figma.ui.postMessage({ 
        type: 'component-data-result', 
        message: 'Данные компонентов не найдены в выбранных элементах.' 
      });
    }
  }
  
  // Обработка запроса на установку данных компонента
  else if (msg.type === 'set-component-data') {
    try {
      console.log('Получен запрос на установку данных компонента:', msg);
      
      // Проверяем параметры сообщения
      if (!msg.key || !msg.version) {
        console.warn('Ошибка: ключ или версия отсутствуют в сообщении', msg);
        figma.ui.postMessage({ 
          type: 'component-data-set', 
          message: 'Ключ и версия не могут быть пустыми.', 
          isError: true 
        });
        return;
      }
      
      const selection = figma.currentPage.selection;
      const { key, version } = msg;
      
      if (!selection || selection.length === 0) {
        console.warn('Нет выбранных элементов для установки данных');
        figma.ui.postMessage({ 
          type: 'component-data-set', 
          message: 'Выберите компоненты для установки данных.', 
          isError: true 
        });
        return;
      }
      
      let dataSet = false;
      let updatedComponents = 0;
      
      // Считаем количество подходящих компонентов в выделении
      let validComponentsCount = 0;
      for (const node of selection) {
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          validComponentsCount++;
        }
      }
      
      // Проверяем, есть ли подходящие компоненты
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
          // Проверяем, является ли нод компонентом или набором компонентов
          if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
            node.setPluginData('customKey', key);
            node.setPluginData('customVersion', version);
            console.log(`Установлены данные компонента ${node.id} (${node.type}) (${node.name}): key = ${key}, version = ${version}`);
            dataSet = true;
            updatedComponents++;
          } else {
            console.log(`Пропускаем нод ${node.id} (${node.name}), так как он не является компонентом или набором компонентов`);
          }
        } catch (error) {
          console.error(`Ошибка при установке данных компонента ${node.id} (${node.name}):`, error);
        }
      }
      
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
      console.error('Ошибка при обработке запроса на установку данных компонента:', error);
      figma.ui.postMessage({ 
        type: 'component-data-set', 
        message: `Ошибка: ${error.message}`, 
        isError: true 
      });
    }
  }
  
  // Обработка запроса на очистку данных компонента
  else if (msg.type === 'clear-component-data') {
    console.log('Получен запрос на очистку данных компонента');
    const selection = figma.currentPage.selection;
    
    if (!selection || selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'component-data-cleared', 
        message: 'Выберите компоненты для очистки данных.', 
        isError: true 
      });
      return;
    }

    let dataCleared = false;
    let clearedComponents = 0;
    
    // Считаем количество подходящих компонентов в выделении
    let validComponentsCount = 0;
    for (const node of selection) {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        validComponentsCount++;
      }
    }
    
    // Проверяем, есть ли подходящие компоненты
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
        // Проверяем, является ли нод компонентом или набором компонентов
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          node.setPluginData('customKey', '');
          node.setPluginData('customVersion', '');
          console.log(`Очищены данные компонента ${node.id} (${node.type}) (${node.name})`);
          dataCleared = true;
          clearedComponents++;
        } else {
          //console.log(`Пропускаем нод ${node.id} (${node.name}), так как он не является компонентом или набором компонентов`);
        }
      } catch (error) {
        console.error(`Ошибка при очистке данных компонента ${node.id} (${node.name}):`, error);
      }
    }

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
};



/**
 * Проверяет наличие заливки или обводки у узла
 * Анализирует свойства fills и strokes на наличие видимых
 * сплошных цветов (SOLID)
 * @param {SceneNode} node - Узел для проверки
 * @returns {boolean} true если узел имеет заливку или обводку
 */
function hasFillOrStroke(node) {
  return (Array.isArray(node.fills) && node.fills.length > 0) ||
         (Array.isArray(node.strokes) && node.strokes.length > 0);
}

/**
 * Преобразует RGB цвет в HEX формат
 * Обрабатывает особые случаи:
 * - figma.mixed значения
 * - Некорректные значения
 * - Масштабирование из диапазона 0-1 в 0-255
 * @param {number} r - Красный компонент (0-1)
 * @param {number} g - Зеленый компонент (0-1)
 * @param {number} b - Синий компонент (0-1)
 * @returns {string} Цвет в формате HEX (#RRGGBB)
 */
function rgbToHex({ r, g, b }) {
  try {
    // Проверяем, что все значения определены
    if (r === undefined || g === undefined || b === undefined) {
      //console.error('Неверные значения RGB:', { r, g, b });
      return '#000000';
    }

    // Проверяем, что значения являются числами
    if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') {
      //console.error('Значения RGB не являются числами:', { r, g, b });
      return '#000000';
    }

    const toHex = (n) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    const hex = '#' + toHex(r) + toHex(g) + toHex(b);
    //console.log('Преобразовано в HEX:', hex);
    return hex;
  } catch (error) {
    //console.error('Ошибка при конвертации RGB в HEX:', error);
    return '#000000';
  }
}



/**
 * Обрабатывает цвета для отдельного узла
 * @param {SceneNode} node - Узел для обработки
 * @returns {Promise<Object|null>} Данные о цветах узла или null
 */
async function processNodeColors(node, colorsResult, colorsResultStroke) {
  //console.log(`\n=== Начало обработки цветов для узла "${node.name}" (ID: ${node.id}) ===`);
  
  const nodeData = {
    name: node.name,
    nodeId: node.id,
    key: node.key,
    modifiedName: node.name,
    color: true,
    hidden: isNodeOrParentHidden(node),
    type: node.type
  };
  
  //console.log('Базовые данные узла:', {
  //  name: nodeData.name,
  //  id: nodeData.nodeId,
  //  type: nodeData.type,
  //  hidden: nodeData.hidden
  //});

  // Находим родительский компонент
  //console.log('Поиск родительского компонента...');
  let parentComponentName = null;
  let parentNode = node.parent;
  
  while (parentNode && !parentComponentName) {
    //console.log(`Проверка родителя: ${parentNode.type} (${parentNode.name})`);
    if (parentNode.type === 'INSTANCE') {
      try {
        // Используем асинхронный метод для получения mainComponent
        const parentMainComponent = await parentNode.getMainComponentAsync();
        if (parentMainComponent) {
          parentComponentName = parentMainComponent.name;
          if (parentMainComponent.parent && parentMainComponent.parent.type === 'COMPONENT_SET') {
            parentComponentName = parentMainComponent.parent.name;
        //console.warn(`Найден родительский компонент в наборе: ${parentComponentName}`);
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

  if (parentComponentName) {
    nodeData.parentComponentName = parentComponentName;
    //console.log(`Установлено имя родительского компонента: ${parentComponentName}`);
  } else {
    //console.log('Родительский компонент не найден');
  }

  // Обрабатываем заливку
  //console.log('\nОбработка заливки...');
  if (node.fills && node.fills.length > 0) {
    //console.log(`Найдено ${node.fills.length} заливок`);
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.visible !== false) {
        //console.log('Найдена видимая сплошная заливка');
        try {
          if (fill.color && typeof fill.color === 'object') {
            const color = {
              r: typeof fill.color.r === 'number' ? fill.color.r : 0,
              g: typeof fill.color.g === 'number' ? fill.color.g : 0,
              b: typeof fill.color.b === 'number' ? fill.color.b : 0
            };
            nodeData.fill = rgbToHex(color);
            //console.log(`Цвет заливки преобразован в HEX: ${nodeData.fill}`);
            break;
          }
        } catch (error) {
          //console.log('Ошибка при обработке цвета заливки:', error);
          nodeData.fill = '#MIXED';
        }
      }
    }
  }

  // Обрабатываем обводку
  //console.log('\nОбработка обводки...');
  if (node.strokes && node.strokes.length > 0) {
    //console.log(`Найдено ${node.strokes.length} обводок`);
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        //console.log('Найдена видимая сплошная обводка');
        try {
          if (stroke.color && typeof stroke.color === 'object') {
            const color = {
              r: typeof stroke.color.r === 'number' ? stroke.color.r : 0,
              g: typeof stroke.color.g === 'number' ? stroke.color.g : 0,
              b: typeof stroke.color.b === 'number' ? stroke.color.b : 0
            };
            nodeData.stroke = rgbToHex(color);
            //console.log(`Цвет обводки преобразован в HEX: ${nodeData.stroke}`);
            break;
          }
        } catch (error) {
          //console.log('Ошибка при обработке цвета обводки:', error);
          nodeData.stroke = '#MIXED';
        }
      }
    }
  }

  // Обрабатываем переменные
  //console.log('\nОбработка привязок переменных...');
  if (node.boundVariables) {
    //console.log('Найдены привязки переменных');
    await processVariableBindings(node, nodeData, 'fills', 'fill');
    await processVariableBindings(node, nodeData, 'strokes', 'stroke');
  } else {
    //console.log('Привязки переменных не найдены');
  }

  // Проверяем условия фильтрации
  let parent = node.parent;
  
  // КОСТЫЛЬ не обрабатываем ноды с цветом черного цвета у которых родитель называется source (исходники иконок)
  if ((nodeData.fill === '#000000' || nodeData.stroke === '#000000' || nodeData.fill === '#FFFFFF' || nodeData.stroke === '#FFFFFF') && parent.name && parent.name.toLowerCase() =='source' && node.parent.type == 'GROUP') {
    return null;
  }
  // КОСТЫЛЬ не обрабатываем ноды с цветом исходники продуктовых логотипов
  if ((nodeData.fill === '#FF33BB' || nodeData.stroke === '#FF33BB') && parent.name && parent.name.toLowerCase() =='group' && node.parent.type == 'GROUP') {
    return null;
  }
  
 

  if (nodeData.fill) {
    if (Array.isArray(colorsResult.instances)) {
        colorsResult.instances.push(nodeData);
       // console.log('Added fill to colorsResult.instances:', nodeData);
    } else {
        console.error('colorsResult.instances is not an array:', colorsResult.instances);
    }
}
if (nodeData.stroke) {
  if (Array.isArray(colorsResultStroke.instances)) {
      colorsResultStroke.instances.push(nodeData);
     // console.log('Added fill to colorsResult.instances:', nodeData);
  } else {
      console.error('colorsResult.instances is not an array:', colorsResultStroke.instances);
  }
}


return nodeData;
}

/**
 * Обрабатывает компонент для отдельного узла
 * @param {InstanceNode} node - Узел компонента для обработки
 * @returns {Promise<Object|null>} Данные о компоненте или null
 */
/**
 * Обрабатывает компонент для отдельного узла
 * @param {InstanceNode} node - Узел компонента для обработки
 * @param {Object} componentsResult - Объект для хранения результатов компонентов
 * @returns {Promise<Object|null>} Данные о компоненте или null
 */
async function processNodeComponent(node, componentsResult) {
      /*console.log(`[processNodeComponent] Начало обработки узла:`, {
        id: node.id,
        type: node.type,
        name: node.name,
        hasParent: !!node.parent
      });*/
      
      let mainComponent = null;
      if (node.type === 'INSTANCE') {
        try {
          //console.log(`[processNodeComponent] Получаем mainComponent для инстанса:`, node.name);
          mainComponent = await node.getMainComponentAsync();
          //console.log(`[processNodeComponent] Получен mainComponent:`, mainComponent ? `${mainComponent.name} (${mainComponent.id})` : 'null');
        } catch (error) {
          console.error(`[processNodeComponent] Ошибка при получении mainComponent для ${node.name}:`, error);
          throw error; // Пробрасываем ошибку выше для корректной обработки
        }
      } else if (node.type === 'COMPONENT') {
        //console.log(`[processNodeComponent] Узел является компонентом:`, node.name);
        mainComponent = node; // Если это сам компонент, а не инстанс
      }
  
      let parentNode = node.parent;
      let name = node.name;

      // Получаем описание и версию только через mainComponent, если он есть
      const descriptionDataMain = await getDescription(node, mainComponent);
      let parentComponentName = null;
      let mainComponentName = mainComponent ? mainComponent.name : null;
      
      // Если это COMPONENT_SET, обрабатываем все его дочерние узлы рекурсивно
      if (node.type === 'COMPONENT_SET') {
        const results = [];
        // Обрабатываем сам COMPONENT_SET
        const setData = await processComponentSetNode(node);
        if (setData) {
          // Не добавляем сам COMPONENT_SET в список компонентов, только его дочерние элементы
          // results.push(setData);
        }
        
        // Обрабатываем все дочерние узлы рекурсивно
        if (node.children) {
          for (const child of node.children) {
            const childResults = await processNodeComponent(child);
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
        return results;
      }

      // Проверяем, находится ли инстанс внутри другого инстанса
      let isNested = false;
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'INSTANCE') {
          isNested = true;
          break;
        }
        parent = parent.parent;
      }

      // Определяем имя и ключ главного компонента или родительского ComponentSet
      let componentKeyToUse = mainComponent ? mainComponent.key : null;

      if (mainComponent && mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
        mainComponentName = mainComponent.parent.name;
        componentKeyToUse = mainComponent.parent.key; // Используем ключ родительского ComponentSet
      } else if (mainComponent) {
         mainComponentName = mainComponent.name; // Для одиночных компонентов/инстансов
      }

      // Используем await, так как getDescription теперь асинхронная
      const descriptionDataSingle = await getDescription(node);

      while (parentNode && !parentComponentName) {
        if (parentNode.type === 'INSTANCE') {
          try {
            // Используем асинхронный метод для получения mainComponent
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

      // Обрабатываем только INSTANCE и COMPONENT (не COMPONENT_SET, так как он обрабатывается выше)
      if ((node.type === 'INSTANCE' || node.type === 'COMPONENT') && typeof name === 'string' && name.trim() !== "") {
        const width = Math.round(node.width);
        const height = Math.round(node.height);

        const dimensionsMatch = width === height;
        const nameStartsWithNumber = /^\d+/.test(name);
        const hasSlashAfterNumber = /^\d+\s\//.test(name);
        const hasNumberTextSlashPattern = /^\d+\s.+\s\/\s/.test(name);
    
        const isIcon = dimensionsMatch && 
                    (nameStartsWithNumber && hasSlashAfterNumber || hasNumberTextSlashPattern);
        

        // Получаем данные из PluginData
        let pluginDataKey = '';
        let pluginDataVersion = '';
        
        try {
          // Пробуем получить данные из разных возможных ключей
          // Проверяем сначала сам компонент
          pluginDataKey = node.getPluginData('customKey') || '';
          pluginDataVersion = node.getPluginData('customVersion') || '';
          
          // Если это инстанс, проверяем также главный компонент
          if (node.type === 'INSTANCE' && mainComponent && (!pluginDataKey || !pluginDataVersion)) {
            const mainComponentKey = mainComponent.getPluginData('customKey') || '';
            const mainComponentVersion = mainComponent.getPluginData('customVersion') || '';
            
            // Используем данные из главного компонента, если у инстанса нет своих
            if (mainComponentKey && !pluginDataKey) pluginDataKey = mainComponentKey;
            if (mainComponentVersion && !pluginDataVersion) pluginDataVersion = mainComponentVersion;
          }
          
          //console.log(`Получены данные из PluginData для ${node.name}:`, { ключ: pluginDataKey, версия: pluginDataVersion });
        } catch (error) {
          console.error(`Ошибка при получении PluginData для ${node.name}:`, error);
        }

        let parent = node.parent;
        const componentData = {
          type: node.type,
          name: name.trim(),
          nodeId: node.id,
          key: node.key,
          modifiedName: name.trim().replace(' (new)', ''),
          description: descriptionDataMain ? descriptionDataMain.description : (descriptionDataSingle ? descriptionDataSingle.description : undefined),
          nodeVersion: descriptionDataMain ? descriptionDataMain.nodeVersion : (descriptionDataSingle ? descriptionDataSingle.nodeVersion : undefined),
          hidden: isNodeOrParentHidden(node),
          isLocal: mainComponent ? !mainComponent.key : false,
          parentName: parentComponentName ? parentComponentName : null,
          parentId: parent.id ? parent.id : null,
          mainComponentName: mainComponentName, // Имя главного компонента или набора
          mainComponentKey: componentKeyToUse, // Используем ключ главного компонента или набора
          mainComponentId: mainComponent ? mainComponent.id : null, // ID самого компонента
          fileKey: figma.fileKey,
          isIcon: isIcon,
          size: isIcon ? width : `${width}x${height}`,
          isNested: isNested,
          skipUpdate: isNested,
          pluginDataKey: pluginDataKey,
          pluginDataVersion: pluginDataVersion
        };
        if (componentData && (node.type === 'INSTANCE' || node.type === 'COMPONENT')) {
            if (Array.isArray(componentsResult.instances)) {
            componentsResult.instances.push(componentData);
        componentsResult.counts.components = (componentsResult.counts.components || 0) + 1;
        if (componentData.isIcon) {
            componentsResult.counts.icons = (componentsResult.counts.icons || 0) + 1;
        }
        //console.log('Added to componentsResult.instances:', componentData);
    } else {
        console.error('componentsResult.instances is not an array:', componentsResult.instances);
    }
}
        return componentData;
      }
}

// Вспомогательная функция для обработки узлов COMPONENT_SET и их дочерних компонентов (теперь используется только для самого COMPONENT_SET, если нужно)
async function processComponentSetNode(node, parentSet = null) {
  // Эта функция теперь в основном используется для получения данных о самом COMPONENT_SET, если это необходимо.
  // Рекурсивный обход дочерних элементов перенесен в processNodeComponent.
  
  const name = node.name;
  // Используем await, так как getDescription теперь асинхронная
  const descriptionDataSet = await getDescription(node);
  
  // Возвращаем данные только для самого COMPONENT_SET, если это необходимо
  // Если node.type === 'COMPONENT', это дочерний компонент, который будет обработан в processNodeComponent
  if (node.type === 'COMPONENT_SET' && typeof name === 'string' && name.trim() !== "") {
    return {
      type: node.type,
      name: name.trim(),
      nodeId: node.id,
      key: node.key,
      modifiedName: name.trim().replace(' (new)', ''),
      description: descriptionDataSet ? descriptionDataSet.description : undefined,
      nodeVersion: descriptionDataSet ? descriptionDataSet.nodeVersion : undefined,
      hidden: isNodeOrParentHidden(node),
      isLocal: !node.key,
      parentName: parentSet ? parentSet.name : null,
      parentId: parentSet ? parentSet.id : null,
      mainComponentName: name,
      mainComponentKey: node.key, // Для COMPONENT_SET используем его собственный ключ
      mainComponentId: node.id,
      fileKey: figma.fileKey,
      isIcon: false, // COMPONENT_SET сам по себе не является иконкой
      size: `${Math.round(node.width)}x${Math.round(node.height)}`, // Размеры COMPONENT_SET
      isNested: false, // COMPONENT_SET не может быть вложенным в инстанс
      skipUpdate: false // COMPONENT_SET не обновляется как инстанс
    };
  }
  
  return null; // Не обрабатываем дочерние компоненты здесь
}

async function checkComponentUpdates(componentsResult) {
  //console.log('\n=== Начинаем проверку обновлений компонентов ===');
  
  // Используем сохраненные данные о цветах из глобальной переменной
  const colorsData = lastColorsData || { instances: [], counts: { colors: 0 } };
  
  for (let i = 0; i < componentsResult.instances.length; i++) {
    const instance = componentsResult.instances[i];
    
    try {
      if (!instance.mainComponentId) {
        //console.log(`\nПропускаем компонент "${instance.name}" - отсутствует mainComponentId`);
        continue;
      }

      // Пропускаем вложенные компоненты
      if (instance.skipUpdate) {
        //console.log(`\nПропускаем вложенный компонент "${instance.name}"`);
        continue;
      }

      //console.log(`\nПроверяем компонент: "${instance.name}" (mainComponentId: ${instance.mainComponentId})`);
      const mainComponent = figma.getNodeById(instance.mainComponentId);
      
      if (!mainComponent) {
        //console.log(`Не удалось найти компонент по ID: ${instance.mainComponentId}`);
        continue;
      }

      const updateInfo = await checkComponentUpdate(mainComponent);

      //console.log('ПРОВЕРКА:',updateInfo);
      
      // Обновляем информацию в массиве результатов
      componentsResult.instances[i] = Object.assign({}, instance, {
        isOutdated: updateInfo.isOutdated,
        libraryComponentId: updateInfo.libraryComponentId,
        libraryComponentVersion: updateInfo.libraryComponentVersion,
        mainComponentId: updateInfo.mainComponentId
      });

      // Отправляем обновление в UI с сохранением данных о цветах
      figma.ui.postMessage({ 
        type: 'all-results',
        components: {
          instances: componentsResult.instances,
          counts: componentsResult.counts
        },
        colors: colorsData // Используем сохраненные данные о цветах
      });

      //console.log('Результат проверки:', {
      //  componentName: instance.name,
      //  isOutdated: updateInfo.isOutdated,
      //  importedId: updateInfo.importedId,
      //  mainComponentId: updateInfo.mainComponentId,
      //  importedMainComponentId: updateInfo.importedMainComponentId,
      //  version: updateInfo.version
      //});
    } catch (componentError) {
      //console.error(`Ошибка при проверке компонента "${instance.name}":`, componentError);
      continue;
    }
  }
  
  //console.log('\n=== Проверка обновлений компонентов завершена ===');
}

/**
 * Обрабатывает привязки переменных для узла
 * @param {SceneNode} node - Узел для обработки
 * @param {Object} nodeData - Объект с данными узла
 * @param {string} propertyType - Тип свойства ('fills' или 'strokes')
 * @param {string} prefix - Префикс для имени свойства ('fill' или 'stroke')
 */
async function processVariableBindings(node, nodeData, propertyType, prefix) {
  //console.log(`\n--- Обработка привязок для ${propertyType} (префикс: ${prefix}) ---`);
  
  if (node.boundVariables && node.boundVariables[propertyType]) {
    //console.log(`Найдены привязки для ${propertyType}`);
    const binding = node.boundVariables[propertyType][0];
    
    if (binding) {
      //console.log(`Обработка привязки: ${binding.id}`);
      try {
        const variable = await figma.variables.getVariableByIdAsync(binding.id);
        if (variable) {
          nodeData[`${prefix}_variable_name`] = variable.name;
          
          // Получаем коллекцию переменной
          try {
            const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
            if (collection) {
              nodeData[`${prefix}_collection_name`] = collection.name;
              nodeData[`${prefix}_collection_id`] = collection.id;
              //console.log('Успешно получены данные переменной:', {
              //  variableName: variable.name,
              //  collectionName: collection.name,
              //  collectionId: collection.id
              //});
            } else {
              //console.log('Коллекция не найдена');
              nodeData[`${prefix}_collection_name`] = 'Коллекция не найдена';
            }
          } catch (collectionError) {
            //console.error(`Ошибка при получении коллекции: ${collectionError}`);
            nodeData[`${prefix}_collection_name`] = 'Ошибка получения коллекции';
          }
        } else {
          //console.log('Переменная не найдена по ID');
        }
      } catch (error) {
        //console.error(`Ошибка при обработке переменной для ${propertyType}:`, error);
        nodeData[`${prefix}_variable_name`] = false;
        //console.log(`Установлено ${prefix}_variable_name = false из-за ошибки`);
      }
    } else {
      //console.log('Привязка не содержит данных');
    }
  } else {
    //console.log(`Привязки для ${propertyType} не найдены`);
  }
  
  //console.log(`--- Завершена обработка привязок для ${propertyType} ---\n`);
}
