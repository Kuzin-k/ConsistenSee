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
  /** Минимальная версия компонента из библиотеки, извлеченная из его описания. */
  libraryComponentVersionMinimal?: string | null;
  /** ID компонента в библиотеке. Может отличаться от `importedId` для компонентов в наборах. */
  libraryComponentId?: string | null;
  /** Имя компонента в библиотеке. */
  libraryComponentName?: string | null;
  /** Указывает, был ли компонент "потерян" (true), т.е. не удалось импортировать его из библиотеки. */
  isLost: boolean;
  /** Указывает, что компонент соответствует minimal, но не latest (version >= minimal && version < latest). */
  isNotLatest: boolean;
  checkVersion: string | null;
}

// Кэш хранит версии из библиотеки и признак потери компонента для уникального ключа компонента
const componentUpdateCache = new Map<string, { latest: string | null; minimal: string | null; lost: boolean }>();
/**
 * Проверяет, требует ли компонент обновления, сравнивая ВЕРСИЮ КОНКРЕТНОГО ИНСТАНСА
 * с версией из библиотеки (latest/minimal), которые кэшируются по ключу компонента.
 * Функция обрабатывает как одиночные компоненты, так и компоненты внутри наборов (Component Sets).
 *
 * @param {ComponentNode} mainComponent - Узел главного компонента, к которому относится инстанс.
 * @param {string | null | undefined} instanceVersion - Версия конкретного инстанса (берётся из его описания).
 * @returns {Promise<UpdateInfo>} Объект с информацией об актуальности инстанса.
 */
export const updateAvailabilityCheck = async (
  mainComponent: ComponentNode,
  instanceVersion?: string | null
): Promise<UpdateInfo> => {
  // --- 1. Проверка входных данных ---
  if (!mainComponent) {
    console.error('updateAvailabilityCheck: получен пустой компонент');
    return {
      isOutdated: false,
      importedId: null,
      version: instanceVersion ?? null,
      checkVersion: null,
      description: null,
      mainComponentId: null,
      importedMainComponentId: null,
      isLost: false,
      isNotLatest: false,
    };
  }

  try {
    // --- 2. Ключ кэша ---
    const cacheKey = getComponentCacheKey(mainComponent);

    const isPartOfSet = mainComponent.parent?.type === 'COMPONENT_SET';
    let libraryVersionSourceNode: ComponentNode | ComponentSetNode | null = null;
    let importedComponentIdForComparison: string | null = null;

    // Значения версий из библиотеки (latest/minimal)
    let libraryVersion: string | null = null;
    let libraryVersionMinimal: string | null = null;

    // --- 3. Попытка взять из кэша ---
    const cached = componentUpdateCache.get(cacheKey);
    if (cached) {
      libraryVersion = cached.latest;
      libraryVersionMinimal = cached.minimal;
      console.warn('DEBUG: Взяли из кэша для', cacheKey, { name: mainComponent.name, latest: libraryVersion, minimal: libraryVersionMinimal, lost: cached.lost });

      // Если ранее компонент не удалось найти в библиотеке — сразу возвращаем isLost=true
      if (cached.lost) {
        const cachedLostResult: UpdateInfo = {
          isOutdated: false,
          isNotLatest: false,
          checkVersion: null,
          isLost: true,
          mainComponentId: mainComponent.id,
          importedId: null,
          importedMainComponentId: null,
          libraryComponentName: null,
          libraryComponentId: null,
          libraryComponentVersion: null,
          libraryComponentVersionMinimal: null,
          version: instanceVersion ?? null,
          description: null,
        };
        console.warn('DEBUG: Компонент помечен как потерянный (из кэша)', { cacheKey, name: mainComponent.name });
        return cachedLostResult;
      }
    } else {
      // --- 4. Если в кэше нет — импортируем из библиотеки и читаем версии ---
      if (!mainComponent.key) {
        console.error('У компонента отсутствует ключ:', mainComponent.name);
        // Без ключа невозможно получить версии из библиотеки
      } else if (isPartOfSet && mainComponent.parent?.key) {
        try {
          const importedSet = await figma.importComponentSetByKeyAsync(mainComponent.parent.key);
          if (importedSet) {
            libraryVersionSourceNode = importedSet;
            const importedComponentInSet = importedSet.findChild(
              (comp): comp is ComponentNode => comp.type === 'COMPONENT' && comp.key === mainComponent.key
            );
            if (importedComponentInSet) {
              if (!importedComponentInSet.id) {
                console.error(`Ошибка: Импортированный компонент "${importedComponentInSet.name}" в наборе "${importedSet.name}" не имеет ID.`);
              } else {
                importedComponentIdForComparison = importedComponentInSet.id;
              }
            } else {
              console.error(`Компонент "${mainComponent.name}" (key: ${mainComponent.key}) не найден в импортированном наборе "${importedSet.name}"`);
            }
          } else {
            console.error(`Не удалось импортировать набор компонентов для "${mainComponent.name}" (parent key: ${mainComponent.parent.key})`);
          }
        } catch (setError) {
          console.error(`Ошибка при импорте набора компонентов для "${mainComponent.name}":`, setError);
        }
      } else {
        try {
          const importedComponent = await figma.importComponentByKeyAsync(mainComponent.key);
          if (importedComponent) {
            if (!importedComponent.id) {
              console.error(`Ошибка: Импортированный одиночный компонент "${importedComponent.name}" не имеет ID.`);
            } else {
              libraryVersionSourceNode = importedComponent;
              importedComponentIdForComparison = importedComponent.id;
            }
          }
        } catch (componentError) {
          console.error(`Ошибка при импорте одиночного компонента "${mainComponent.name}":`, componentError);
        }
      }

      // Если удалось получить источник версий — читаем latest/minimal и кладём в кэш
      if (libraryVersionSourceNode) {
        const libraryDescData = await getDescription(libraryVersionSourceNode);
        libraryVersion = libraryDescData.nodeVersion;
        libraryVersionMinimal = libraryDescData.nodeVersionMinimal;
        // Кладём в кэш версии и помечаем, что компонент найден (lost=false)
        componentUpdateCache.set(cacheKey, { latest: libraryVersion, minimal: libraryVersionMinimal, lost: false });
      } else {
        // Ничего не импортировано — считаем, что компонент потерян и кэшируем это состояние
        componentUpdateCache.set(cacheKey, { latest: null, minimal: null, lost: true });
      }
    }

    // --- 5. Формируем результат и сравниваем версии ---
    const result: UpdateInfo = {
      isOutdated: false,
      isNotLatest: false,
      checkVersion: null,
      isLost: false,
      mainComponentId: mainComponent.id,
      importedId: importedComponentIdForComparison,
      importedMainComponentId: importedComponentIdForComparison,
      libraryComponentName: mainComponent.name,
      libraryComponentId: importedComponentIdForComparison,
      libraryComponentVersion: libraryVersion,
      libraryComponentVersionMinimal: libraryVersionMinimal,
      version: instanceVersion ?? null,
      description: null,
    };

    if (libraryVersion || libraryVersionMinimal) {
      const compareResult = compareVersions(instanceVersion, libraryVersion, libraryVersionMinimal);
      result.isOutdated = compareResult === 'Outdated';
      result.isNotLatest = compareResult === 'NotLatest';
      result.checkVersion = compareResult;
    } else if (importedComponentIdForComparison) {
      // Если версии отсутствуют, но компонент из библиотеки найден — считаем актуальным
      result.isOutdated = false;
      result.checkVersion = 'Latest';
    } else {
      // Не удалось получить данные из библиотеки
      result.isLost = true;
    }

    // Логируем итоговый результат для отладки.
    console.log('Результат проверки компонента:', {
      name: mainComponent.name,
      isOutdated: result.isOutdated,
      isNotLatest: result.isNotLatest,
      isLost: result.isLost,
      instanceVersion,
      libraryVersion: result.libraryComponentVersion,
      libraryVersionMinimal: result.libraryComponentVersionMinimal,
      cacheKey,
    });

    return result;
  } catch (error: any) {
    console.error(`Критическая ошибка при проверке компонента "${mainComponent ? mainComponent.name : 'N/A'}":`, {
      componentName: mainComponent ? mainComponent.name : 'неизвестно',
      error: error.message,
      stack: error.stack,
    });

    const safeResult: UpdateInfo = {
      isOutdated: false,
      isNotLatest: false,
      mainComponentId: mainComponent ? mainComponent.id : null,
      importedMainComponentId: null,
      importedId: null,
      libraryComponentName: mainComponent ? mainComponent.name : null,
      libraryComponentId: null,
      checkVersion: null,
      version: instanceVersion ?? null,
      description: null,
      libraryComponentVersion: null,
      libraryComponentVersionMinimal: null,
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