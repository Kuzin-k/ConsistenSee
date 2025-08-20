// Импорты
import {
  PluginMessage,
  UIMessage,
  SplashScreenData,
  ComponentData,
  ColorData,
  ComponentsResult,
  ColorsResult,
  NodeStatistics,
  ComponentTreeNode,
  PublishStatus, // PublishStatus is not used in the current implementation, but we keep it for future use.
  SceneNode
} from '../shared/types';

import { updateProgress }         from './utils/updateProgress';
import { checkFigmaConnection, waitForConnection } from './utils/retryWithBackoff';

import { processNodeColors }      from './color/processNodeColors';
import { hasFillOrStroke }        from './color/checkFillOrStroke';
import { clearRgbToHexCache }     from './color/clearRgbToHexCache';

import { processNodeComponent }   from './component/processNodeComponent';
import { processNodeStatistics }  from './component/processNodeStatistics';

import { checkComponentUpdates }  from './update/checkComponentUpdates';
import { clearUpdateCache }       from './update/updateAvailabilityCheck';



// Глобальный обработчик ошибок для wasm/memory/out of bounds
if (typeof window !== 'undefined') {
  // Обработчик для необработанных промисов (unhandledrejection)
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const err = event.reason;
    console.error('Global unhandledrejection:', err);
    // Безопасно извлекаем сообщение ошибки как строку
      const errMessage = err instanceof Error ? err.message : String(err);
    // Проверяем, связана ли ошибка с WebAssembly или памятью
    if (/wasm|memory|out of bounds|null function|function signature mismatch/i.test(errMessage)) {
      // Уведомляем пользователя о критической ошибке
      figma.notify('Критическая ошибка памяти Figma API. Плагин будет перезапущен.');
      // Закрываем плагин через 3 секунды с сообщением об ошибке
      setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 15000);
    } else {
      figma.ui.postMessage({
        type: 'error',
        message: `Unhandled Rejection: ${errMessage}`
      });
    }
  });
  // Обработчик для общих ошибок (error)
  window.addEventListener('error', (event: ErrorEvent) => {
    const err = event.error;
    console.error('Global error:', err);
    // Безопасно извлекаем сообщение ошибки как строку
    const errMessage = err instanceof Error ? err.message : String(err);
    // Проверяем, связана ли ошибка с WebAssembly или памятью
    if (/wasm|memory|out of bounds|null function|function signature mismatch/i.test(errMessage)) {
      // Уведомляем пользователя о критической ошибке
      figma.notify('Критическая ошибка памяти Figma API. Плагин будет перезапущен.');
      // Закрываем плагин через 3 секунды с сообщением об ошибке
      setTimeout(() => figma.closePlugin('Произошла критическая ошибка WebAssembly. Перезапустите плагин.'), 15000);
    } else {
      figma.ui.postMessage({
        type: 'error',
        message: `Error: ${errMessage}`
      });
    }
  });
}
// Показываем пользовательский интерфейс плагина
figma.showUI(__html__, { width: 500, height: 800 });

// Отправляем информацию о текущем пользователе в UI
const currentUser = figma.currentUser;
if (currentUser) {
  figma.ui.postMessage({
    type: 'user-info',
    user: {
      name: currentUser.name ?? '',
      id: currentUser.id,
    }
  } as PluginMessage);
}

// --- Splash Screen Data ---
const splashScreenCombinations: SplashScreenData[] = [
  {
    imageUrl: "https://downloader.disk.yandex.ru/preview/9f312e965a5cb62de3b834fbdbec01be8981c981359610a3e7c562f55be0f4ee/68686aa6/6M6Ljd-rK85c-sAIgPYzKWBKgOuPSPDx-IDf2mqBKp1t-o7e2PHljEgnQMWzjYVuTVsd2JaL-44X0Lx4c19FNw%3D%3D?uid=0&filename=pionerka.jpeg&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&size=2048x2048",
    titleText: "Дизайнер, к борьбе за победу всеобщей консистентности будь готов!",
    buttonText: "Всегда готов!"
  },
  {
    imageUrl: "https://downloader.disk.yandex.ru/preview/97f205f91c4e6f96d4f1e89a90d47d476150b4d42ca3cbae2d3c326fb55ab3d0/68686a3d/se5BT60CXEEZWaCAmUtuG9a9f1ieqLEJ2CEJi7gCW4vo8WdCc-b_a2j9gNNYpsGainQW_fPnHiz5W9XoI-cRwQ%3D%3D?uid=0&filename=gagarin.jpg&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&size=2048x2048", // Example 2 image
    titleText: "Ну как вы там потомки, теперь вам AI макеты рисует?",
    buttonText: "Юра, мы всё раздетачили"
  },
  {
    imageUrl: "https://downloader.disk.yandex.ru/preview/654e2ed50e413289aebd69772e5bf9004956b4ede643f359899c953a6f95cb12/68686adc/DSpXFN1MCoNBFH847La1OcdcOcVWJOdVaM8ulDYd8ldqIYYRgpZNiCjFmG_dfAH83IWKf2Y5r7NSiKBmC1y1SQ%3D%3D?uid=0&filename=rocket.jpg&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&size=2048x2048", // Example 3 image
    titleText: "Люди ракеты на Марс запускают, а вы компоненты обновить не можете",
    buttonText: "Можем!"
  },
];

// User-specific splash screen settings (example structure)
// Key: Figma User ID, Value: Index of the combination in splashScreenCombinations
const userSplashSettings: { [key: string]: number } = {
  // 'USER_ID_EXAMPLE_1': 0, // Assign first combination to this user
  // 'USER_ID_EXAMPLE_2': 1, // Assign second combination to this user
};

// Select splash screen data based on user or randomly
let selectedSplashData: SplashScreenData | undefined;
if (currentUser?.id) {
  const userSettingIndex = userSplashSettings[currentUser.id];
  if (typeof userSettingIndex === 'number' && splashScreenCombinations[userSettingIndex]) {
    selectedSplashData = splashScreenCombinations[userSettingIndex];
  } else {
    const randomIndex = Math.floor(Math.random() * splashScreenCombinations.length); // Fallback to random
    selectedSplashData = splashScreenCombinations[randomIndex];
  }
}


// Send splash screen data to UI
if (selectedSplashData) {
  figma.ui.postMessage({
    type: 'splash-data',
    data: selectedSplashData
  } as PluginMessage);
}

/**
 * @fileoverview This file contains the main logic for the ConsistenSee Figma plugin.
 * It handles communication between the UI and the Figma API, processes nodes,
 * and manages data caching.
 */

/**
 * Global variable to store the results of the last color scan.
 * @type {ColorsResult | null}
 */
let lastColorsData: ColorsResult | null = null; // To hold color data between checks

/**
 * Array to store statistics for all processed nodes.
 * @type {NodeStatistics[]}
 */
let totalStatsList: NodeStatistics[] = [];

/**
 * Timestamp for the start of the analysis process.
 * @type {number}
 */
let startTime: number = 0;

/**
 * The current selection of nodes in the Figma document.
 * @type {readonly SceneNode[]}
 */
let selection: readonly SceneNode[] = [];

// Кэши
/**
 * Cache for storing the update status of components.
 * @type {Map<string, boolean>}
 */
const componentUpdateCache: Map<string, boolean> = new Map();

/**
 * Cache for storing the publish status of main components.
 * @type {Map<string, PublishStatus>}
 */
const publishStatusCache: Map<string, PublishStatus> = new Map();

// Локальная функция clearUpdateCache удалена - используем импортированную из updateAvailabilityCheck.ts

// Результаты (инициализируются перед каждым запуском)
/**
 * Object to store the results of the component analysis.
 * @type {ComponentsResult}
 */
let componentsResult: ComponentsResult = {
  instances: [],
  counts: {
    components: 0,
    icons: 0
  }
};

let colorsResult: ColorsResult = {
  instances: [],
  uniqueColors: new Set<string>(),
  totalUsage: 0
};

let colorsResultStroke: ColorsResult = {
  instances: [],
  uniqueColors: new Set<string>(),
  totalUsage: 0
};

/**
 * Main message handler for messages from the plugin's UI.
 * Handles various commands coming from the user interface.
 * @param {UIMessage} msg The message object from the UI.
 */
figma.ui.onmessage = async (msg: UIMessage) => {
  console.log('Получено сообщение от UI:', msg.type);
  
  // Обработка сообщения для изменения размера окна плагина
  if (msg.type === 'resize') {figma.ui.resize(msg.width, msg.height);}

  // Обработчики для работы с данными компонента (get-component-data, clear-component-data)
  // Логика этих обработчиков находится ниже в этом же блоке onmessage

  /**
   * Handles the 'check-all' command from the UI.
   * This command initiates a full analysis of the selected nodes.
   */
  if (msg.type === 'check-all') {
      // Проверяем соединение с Figma перед началом анализа
      console.log('[check-all] Проверка соединения с Figma...');
      
      if (!(await checkFigmaConnection())) {
        console.warn('[check-all] Соединение с Figma недоступно, ожидание восстановления...');
        figma.ui.postMessage({
          type: 'error',
          message: 'Соединение с Figma недоступно. Ожидание восстановления...'
        });
        
        // Ждем восстановления соединения до 30 секунд
        const connectionRestored = await waitForConnection(30000);
        
        if (!connectionRestored) {
          figma.ui.postMessage({
            type: 'error',
            message: 'Не удалось восстановить соединение с Figma. Попробуйте позже.'
          });
          return;
        }
        
        console.log('[check-all] Соединение с Figma восстановлено.');
        figma.ui.postMessage({
          type: 'error',
          message: 'Соединение с Figma восстановлено. Начинаем анализ...'
        });
      }
      
      // Очищаем все кэши перед новым поиском
      clearUpdateCache();
      clearRgbToHexCache();
      publishStatusCache.clear();
      console.log('Все кэши очищены перед новым поиском.');

      const startTime = Date.now();
      
      // Записываем время начала выполнения
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
    const uniqueNodesToProcess = new Set<SceneNode>();
    
    // Очищаем и используем глобальный массив для хранения статистики
    totalStatsList.length = 0;

    // Проходим по каждому выделенному элементу
    for (const selectedNode of selection) {
      // Добавляем сам выделенный узел
      uniqueNodesToProcess.add(selectedNode);

      // Если узел является контейнером (имеет метод findAll), собираем все его потомки
      if ('findAll' in selectedNode && typeof (selectedNode as any).findAll === 'function') {
        // Собираем статистику для текущего выделенного элемента и всех его потомков
        const nodeStats = processNodeStatistics(selectedNode as SceneNode, selectedNode.name);
        totalStatsList.push(nodeStats);

        // Собираем всех потомков для последующей обработки
        try {
          const allDescendants = (selectedNode as any).findAll() as SceneNode[];
          allDescendants.forEach((descendant: BaseNode) => {
             if (descendant && descendant.type !== 'PAGE' && 'visible' in descendant) {
               uniqueNodesToProcess.add(descendant as SceneNode);
             }
           });
        } catch (err) {
          console.error('Ошибка при вызове findAll:', err, selectedNode);
        }
      }
    }

    // Преобразуем Set уникальных узлов в массив для удобной итерации
    const nodesToProcess = Array.from(uniqueNodesToProcess);

    // Если после сбора нет узлов для обработки, отправляем сообщение об ошибке и выходим
    if (nodesToProcess.length === 0) {
       figma.ui.postMessage({
         type: 'error',
         message: 'В выделенной области нет элементов для анализа.'
       });
       return;
    }

    // Инициализация/сброс результатов перед новым анализом
    componentsResult = {
      instances: [], // Массив для данных инстансов/компонентов
      counts: { // Счетчики по типам
        components: 0,
        icons: 0
      }
    };
    colorsResult = {
      instances: [], // Массив для данных цветов заливки
      uniqueColors: new Set<string>(),
      totalUsage: 0
    };
    colorsResultStroke = {
      instances: [], // Массив для данных цветов обводки
      uniqueColors: new Set<string>(),
      totalUsage: 0
    };

    //let executionTime = Date.now() - startTime;
    //console.log(`Первый этап выполнен: ${executionTime}ms`);
    //console.log(`Результат: ${nodesToProcess}`);

    try {
      // Отправляем начальное сообщение о прогрессе в UI
      await updateProgress('processing', 0, nodesToProcess.length, 'Обработка элементов');

      // Асинхронно обрабатываем каждый узел из списка
      const processNodeSafely = async (node: SceneNode, index: number) => {
        // Пропускаем невалидные узлы
        if (!node || !node.type) {
          console.warn(`[${index + 1}] Пропущен невалидный узел:`, node);
          return;
        }

        try {
          // Проверяем, имеет ли узел заливки или обводки
          let hasColor = false;
          try {hasColor = hasFillOrStroke(node);} catch (err) {
          console.error(`[${index + 1}] ERROR in hasFillOrStroke:`, err instanceof Error ? err.message : String(err));
          }

          // Если узел имеет цвет, обрабатываем его цвета
          if (hasColor) {
            try {await processNodeColors(node, colorsResult, colorsResultStroke);
            } catch (err) {
              console.error(`[${index + 1}] ERROR in processNodeColors:`, err instanceof Error ? err.message : String(err));
            }
          }

          // Если узел является инстансом, обрабатываем его как компонент
          if (node.type === 'INSTANCE') {
            try {
              await processNodeComponent(node as InstanceNode, componentsResult);
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
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          await updateProgress('processing', i + 1, nodesToProcess.length, 'Обработка элементов', (nodesToProcess[i] as InstanceNode).name);
        }
      }

      // Сортируем результаты компонентов по имени (с учетом специальных символов и эмодзи)
      componentsResult.instances.sort((a, b) => {
        const aName = a.mainComponentName || a.name;
        const bName = b.mainComponentName || b.name;

        // Функция для удаления эмодзи из строки
        const removeEmoji = (str: string) => str.replace(/([\u0023-\u0039]\uFE0F?\u20E3|\u00A9|\u00AE|[\u2000-\u3300]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])/gu, '').trim();

        // Функция для проверки специальных символов в начале имени
        const startsWithSpecial = (str: string) => /^[._]/.test(str);

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

      // Сохраняем данные о цветах в глобальную переменную
      lastColorsData = colorsResult;

      // Отправляем все собранные результаты в UI
      // Формируем дерево только для выбранных элементов (для отладки)
      function buildComponentTree(node: SceneNode): ComponentTreeNode {
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          children: 'children' in node ? (node.children as SceneNode[]).map(buildComponentTree) : []
        };
      }
      let componentTree: ComponentTreeNode[] = [];
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
      
      // Подготавливаем общую статистику для всех выделенных элементов
      // Используем selection вместо uniqueNodesToProcess для полной статистики
      const totalStats = processNodeStatistics(selection, 'Total');

      // Отправляем статистику в UI
      figma.ui.postMessage({
        type: 'display-total',
        data: {
          overallStats: totalStats,
          totalCount: totalStats.totalNodes // Добавляем общее количество явно
        }
      });

      // Затем отправляем остальные результаты
      figma.ui.postMessage({
        type: 'all-results',
        components: componentsResult,
        colors: colorsResult,
        colorsStroke: colorsResultStroke,
        componentTree: componentTree,
        totalStats: totalStats // Включаем статистику и в этом сообщении для синхронизации
      });

    } catch (error) {
      // Обработка ошибок в процессе анализа
      console.error('Ошибка при проверке:', error);
      // Безопасно извлекаем сообщение ошибки как строку (error может быть unknown)
      const errMessage = error instanceof Error ? error.message : String(error);
      figma.notify(`Ошибка при проверке: ${errMessage}`);
      // Отправляем сообщение об ошибке в UI
      figma.ui.postMessage({ type: 'error', message: `Ошибка при проверке: ${errMessage}` });
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
          const errorMessage = err instanceof Error ? err.message : String(err);
          figma.notify('Ошибка доступа к элементу: ' + errorMessage);
          return;
        }
        console.log('[PLUGIN] Node found:', !!node, node);
        // Проверяем, что узел найден и является SceneNode (имеет тип и свойство visible)
        if (node && 'type' in node && node.type !== 'PAGE' && 'visible' in node) {
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
            figma.currentPage.selection = [node as SceneNode];
          } catch (err) {
            // Обработка ошибок при прокрутке и выделении
            console.error('Ошибка scrollAndZoomIntoView:', err, node);
            figma.notify('Ошибка позиционирования: ' + (err instanceof Error ? err.message : String(err)));
            // Если ошибка связана с WebAssembly/памятью, уведомляем и перезапускаем плагин
            if (err && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(err instanceof Error ? err.message : String(err))) {
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
        figma.notify('Критическая ошибка работы с элементом: ' + (criticalErr instanceof Error ? criticalErr.message : String(criticalErr)));
        // Если ошибка связана с WebAssembly/памятью, уведомляем и перезапускаем плагин
        if (criticalErr && /wasm|memory|out of bounds|null function|function signature mismatch/i.test(criticalErr instanceof Error ? criticalErr.message : String(criticalErr))) {
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
      const nodeIds: string[] = msg.nodeIds; // Получаем массив ID узлов из сообщения
      // console.log('Выбираем группу узлов:', nodeIds);
      // Проверяем корректность входных данных: массив ID не должен быть пустым
      if (!nodeIds || nodeIds.length === 0) {
        figma.notify('Не указаны ID узлов для выбора');
        return;
      }
      let nodes: SceneNode[] = []; // Массив для хранения найденных узлов
      try {
        // Асинхронно ищем все узлы по их ID параллельно
        const foundNodes = await Promise.all(
          nodeIds.map(async id => {
            try {
              // Получаем узел по ID
              const n = await figma.getNodeByIdAsync(id);
              // Возвращаем узел, только если он найден и является валидным SceneNode
              return n && 'type' in n && n.type !== 'PAGE' && 'visible' in n ? n : null;
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
        // Безопасно извлекаем сообщение ошибки как строку (err может быть unknown)
        const errMessage = err instanceof Error ? err.message : String(err);
        figma.notify('Ошибка при поиске группы узлов: ' + errMessage);
        return;
      }
      // Проверяем, найдены ли какие-либо узлы
      if (nodes.length === 0) {
        figma.notify('Не удалось найти ни один из указанных узлов');
        return;
      }
      // Жёстко фильтруем только SceneNode (повторная проверка, хотя уже была в map)
      const validNodes: SceneNode[] = nodes.filter((n): n is SceneNode => n && 'type' in n && typeof n.visible === 'boolean');
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

    const componentData: Record<string, any> = {};

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
            error: `Ошибка чтения данных: ${error instanceof Error ? error.message : String(error)}`
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
      const { key, version }: { key: string; version: string } = msg; // Извлекаем ключ и версию из сообщения

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
        message: `Ошибка: ${error instanceof Error ? error.message : String(error)}`,
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
    // Очищаем кеш перед проверкой обновлений
    clearUpdateCache();
    console.log('Кеш очищен перед проверкой обновлений.');
    
    let componentsToCheck: ComponentsResult | null = null;

    // Use the component data sent from UI
    if (msg.components && msg.components.instances) {
      componentsToCheck = msg.components;
    }

    if (!componentsToCheck || !componentsToCheck.instances || !componentsToCheck.instances.length) {
      figma.ui.postMessage({
        type: 'error',
        message: 'No components to check for updates. Please run a search first.'
      });
      return;
    }
    try {
      await checkComponentUpdates(componentsToCheck);
      // После обновления отправляем результаты обратно в UI
      figma.ui.postMessage({ type: 'all-results', components: componentsToCheck, colors: lastColorsData || colorsResult, colorsStroke: colorsResultStroke, componentTree: [], totalStats: { nodeTypeCounts: {}, totalNodes: 0, nodeName: '' } });
    } catch (error) {
      console.error('Error during update check:', error);
      figma.ui.postMessage({
        type: 'error', 
        message: `Error checking for updates: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
};

