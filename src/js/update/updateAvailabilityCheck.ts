import { getDescription } from '../component/getDescription';
import { ComponentNode, ComponentSetNode } from '../../shared/types';
import { getComponentCacheKey } from '../component/getComponentCacheKey';
import { compareVersions } from './compareVersions';

/**
 * Содержит подробную информацию об актуальности компонента.
 * Эта структура данных хранит результаты проверки версии компонента.
 */
export interface UpdateInfo {
  /** Указывает, является ли компонент устаревшим (true) или актуальным (false). */
  isOutdated: boolean;
  /** ID импортированного из библиотеки компонента (если это одиночный компонент). */
  importedId: string | null;
  /** Версия, извлеченная из описания локального компонента в файле. */
  version: string | null;
  /** Описание компонента, извлеченное из его данных. */
  description: string | null;
  /** ID основного компонента (mainComponent) в текущем файле. */
  mainComponentId: string | null;
  /** ID основного компонента, импортированного из библиотеки. */
  importedMainComponentId: string | null;
  /** Версия компонента из библиотеки, извлеченная из его описания. */
  libraryComponentVersion?: string | null;
  /** ID компонента в библиотеке. Может отличаться от `importedId` для компонентов в наборах. */
  libraryComponentId?: string | null;
  /** Указывает, был ли компонент "потерян" (true), т.е. не удалось импортировать его из библиотеки. */
  isLost?: boolean;
}

const componentUpdateCache = new Map<string, UpdateInfo>();
/**
 * Проверяет, требует ли компонент обновления, сравнивая его локальную версию с версией из библиотеки.
 * Функция обрабатывает как одиночные компоненты, так и компоненты внутри наборов (Component Sets).
 * Для оптимизации производительности используется кэширование результатов.
 *
 * @param {ComponentNode} mainComponent - Узел компонента (`ComponentNode`), который необходимо проверить.
 * @returns {Promise<UpdateInfo>} Promise, который разрешается объектом `UpdateInfo` с информацией об обновлении.
 */

export const updateAvailabilityCheck = async (mainComponent: ComponentNode): Promise<UpdateInfo> => {
  //console.log('Update check for component:', mainComponent.name);

  // --- 1. Проверка входных данных ---
  // Если на вход подан невалидный компонент, прекращаем выполнение и возвращаем пустой результат.
  if (!mainComponent) {
    console.error('updateAvailabilityCheck: получен пустой компонент');
    return {
      isOutdated: false,
      importedId: null,
      version: null,
      description: null,
      mainComponentId: null,
      importedMainComponentId: null,
    };
  }

  // --- 2. Основной блок try...catch для перехвата критических ошибок ---
  try {
    // --- 3. Проверка кэша ---
    // Формируем уникальный ключ для кэширования на основе ID и имени компонента.
    const cacheKey = getComponentCacheKey(mainComponent);
    // Если результат для этого компонента уже есть в кэше, возвращаем его, избегая повторных вычислений.
    // if (componentUpdateCache.has(cacheKey)) {
    //   console.log(`[Cache HIT] для updateAvailabilityCheck: ${cacheKey}`);
    //   return componentUpdateCache.get(cacheKey)!;
    // }

    // --- 4. Получение данных локального компонента ---
    // Асинхронно извлекаем версию и описание из данных локального компонента.
    const mainComponentDescData = await getDescription(mainComponent);
    const mainComponentVersion = mainComponentDescData.nodeVersion;

    // --- 5. Инициализация объекта с результатами ---
    // Создаем объект, который будет хранить всю информацию о проверке.
    const result: UpdateInfo = {
      isOutdated: false,
      isLost: false, // Флаг, указывающий, что компонент не найден в библиотеке
      mainComponentId: mainComponent.id,
      importedId: null,
      importedMainComponentId: null,
      libraryComponentId: null,
      libraryComponentVersion: null, // Версия из библиотеки (пока неизвестна)
      version: mainComponentVersion, // Версия локального компонента
      description: mainComponentDescData.description,
    };

    // --- 6. Проверка наличия ключа компонента ---
    // Ключ (`key`) необходим для импорта компонента из библиотеки. Если его нет, дальнейшая проверка невозможна.
    if (!mainComponent.key) {
      console.error('У компонента отсутствует ключ:', mainComponent.name);
      // Сохраняем результат в кэш и возвращаем его.
      componentUpdateCache.set(cacheKey, result);
      return result;
    }

    const isPartOfSet = mainComponent.parent?.type === 'COMPONENT_SET';
    let libraryVersionSourceNode: ComponentNode | ComponentSetNode | null = null;
    let importedComponentIdForComparison: string | null = null;

    // --- 7a. Если компонент является частью набора (Component Set) ---
    if (isPartOfSet && mainComponent.parent?.key) {
      try {
        // Пытаемся импортировать весь набор компонентов по ключу его родителя.
        const importedSet = await figma.importComponentSetByKeyAsync(mainComponent.parent.key);
        if (importedSet) {
          // Если набор успешно импортирован, он становится источником для получения версии.
          libraryVersionSourceNode = importedSet;
          // Ищем внутри импортированного набора нужный нам компонент по его уникальному ключу.
          const importedComponentInSet = importedSet.findChild((comp): comp is ComponentNode => comp.type === 'COMPONENT' && comp.key === mainComponent.key);

          if (importedComponentInSet) {
            // Если компонент найден в наборе, проверяем наличие у него ID.
            if (!importedComponentInSet.id) {
              // Это аномальная ситуация, компонент должен иметь ID.
              console.error(`Ошибка: Импортированный компонент "${importedComponentInSet.name}" в наборе "${importedSet.name}" не имеет ID.`);
              result.isOutdated = false; // Считаем устаревшим из-за ошибки.
              result.isLost = true; // Считаем потерянным.
              result.description = (result.description || '') + ' [Error: Imported component in set has no ID]';
            } else {
              // Сохраняем ID для последующего сравнения.
              importedComponentIdForComparison = importedComponentInSet.id;
              result.libraryComponentId = importedComponentInSet.id;
            }
          } else {
            // Если компонент не найден в наборе, это может означать, что он был удален из библиотеки.
            console.error(`Компонент "${mainComponent.name}" (key: ${mainComponent.key}) не найден в импортированном наборе "${importedSet.name}"`);
          }
        } else {
          // Если не удалось импортировать набор, логируем ошибку.
          console.error(`Не удалось импортировать набор компонентов для "${mainComponent.name}" (parent key: ${mainComponent.parent.key})`);
        }
      } catch (setError) {
        // Обрабатываем ошибки, которые могут возникнуть при импорте набора (например, удален или нет доступа).
        console.error(`Ошибка при импорте набора компонентов для "${mainComponent.name}":`, setError);
        result.isOutdated = false; // Считаем компонент устаревшим, так как не можем проверить его актуальность.
        result.isLost = true;
        result.description = (result.description || '') + ' [Error: Failed to import component set]';
      }
    } else {
      // --- 7b. Если компонент является одиночным (не в наборе) ---
      try {
        // Пытаемся импортировать компонент напрямую по его ключу.
        const importedComponent = await figma.importComponentByKeyAsync(mainComponent.key);
        if (importedComponent) {
          // Проверяем наличие ID у импортированного компонента.
          if (!importedComponent.id) {
            console.error(`Ошибка: Импортированный одиночный компонент "${importedComponent.name}" не имеет ID.`);
            result.isOutdated = false;
            result.isLost = true;
            result.description = (result.description || '') + ' [Error: Imported component has no ID]';
          } else {
            // Если все в порядке, импортированный компонент становится источником для получения версии.
            libraryVersionSourceNode = importedComponent;
            importedComponentIdForComparison = importedComponent.id;
            result.importedId = importedComponent.id;
            result.importedMainComponentId = importedComponent.id;
          }
        }
      } catch (componentError) {
        // Обрабатываем ошибки при импорте одиночного компонента.
        console.error(`Ошибка при импорте одиночного компонента "${mainComponent.name}":`, componentError);
        result.isOutdated = false;
        result.isLost = true;
        result.description = (result.description || '') + ' [Error: Failed to import component]';
      }
    }

    // --- 8. Сравнение версий ---
    // Этот блок выполняется, только если удалось успешно импортировать компонент или набор из библиотеки.
    if (libraryVersionSourceNode) {
      // Получаем версию и описание из импортированного (библиотечного) компонента/набора.
      const libraryDescData = await getDescription(libraryVersionSourceNode);
      const libraryVersion = libraryDescData.nodeVersion;

      result.libraryComponentVersion = libraryVersion;
      // Если у локального компонента не было описания, используем описание из библиотеки.
      if (!result.description) {
        result.description = libraryDescData.description;
      }

      // --- 8a. Сравнение по строкам версий ---
      // Если и у локального, и у библиотечного компонента есть версии, сравниваем их.
      if (mainComponentVersion && libraryVersion) {
        console.log('Сравнение версий:', {
          componentName: mainComponent.name,
          mainComponentVersion,
          libraryVersion,
          compareResult: compareVersions(mainComponentVersion, libraryVersion)
        });
        result.isOutdated = compareVersions(mainComponentVersion, libraryVersion) < 0;
      } else if (importedComponentIdForComparison) {
        // Если версии отсутствуют, сравниваем ID
        result.isOutdated = false; // Эта строка закомментирована выше
      }
    }

    // --- 9. Кэширование и возврат результата ---
    // Сохраняем итоговый результат в кэш для последующего использования.
    componentUpdateCache.set(cacheKey, result);

    // Логируем финальный результат для отладки.
    console.log('Результат проверки компонента:', {
      name: mainComponent.name,
      isOutdated: result.isOutdated,
      isLost: result.isLost,
      instanceVersion: mainComponentVersion,
      libraryVersion: result.libraryComponentVersion,
      cacheKey,
    });
    // Возвращаем собранные данные.
    return result;
  } catch (error: any) {
    // --- 10. Обработка критических ошибок ---
    // Если в процессе выполнения функции произошла непредвиденная ошибка, логируем ее.
    console.error(`Критическая ошибка при проверке компонента "${mainComponent ? mainComponent.name : 'N/A'}":`, {
      componentName: mainComponent ? mainComponent.name : 'неизвестно',
      error: error.message,
      stack: error.stack,
    });

    // Возвращаем "безопасный" пустой результат, чтобы не нарушать работу плагина.
    const safeResult: UpdateInfo = {
      isOutdated: false,
      mainComponentId: mainComponent ? mainComponent.id : null,
      importedMainComponentId: null,
      importedId: null,
      libraryComponentId: null,
      version: null,
      description: null,
      libraryComponentVersion: null,
      isLost: false,
    };

    return safeResult;
  }
};

/**
 * Очищает кэш обновлений компонентов.
 */
export const clearUpdateCache = (): void => {
  componentUpdateCache.clear();
};