import { ComponentData, ComponentsResult, ComponentNode } from '../../shared/types';
import { updateProgress } from '../utils/updateProgress';
import { updateAvailabilityCheck } from './updateAvailabilityCheck';

/**
 * Асинхронно проверяет обновления для списка компонентов.
 *
 * @param componentsResult - Результаты анализа компонентов для проверки.
 */
export const checkComponentUpdates = async (componentsResult: ComponentsResult): Promise<void> => {
  console.log('=== Начало проверки обновлений компонентов ===');
  const totalComponentsToCheck = componentsResult.instances.length;
  const updatedInstances: ComponentData[] = [];

  await updateProgress('check-updates', 0, totalComponentsToCheck, 'Проверка обновлений...');

  for (let i = 0; i < totalComponentsToCheck; i++) {
    const instance = componentsResult.instances[i];
    try {
      if (!instance.mainComponentId || instance.remote === false) {
        updatedInstances.push(instance);
        continue;
      }

      const mainComponent = (await figma.getNodeByIdAsync(instance.mainComponentId)) as ComponentNode | null;
      if (!mainComponent) {
        console.warn(`Не удалось найти компонент с ID: ${instance.mainComponentId}`);
        updatedInstances.push(instance);
        continue;
      }

      // Передаём версию текущего инстанса для корректной проверки относительно кэшированных версий библиотеки
      const updateInfo = await updateAvailabilityCheck(mainComponent, instance.nodeVersion);

      console.log('DEBUG: Результат updateAvailabilityCheck для', instance.name, {
        isOutdated: updateInfo.isOutdated,
        checkVersion: updateInfo.checkVersion,
        version: updateInfo.version,
        isNotLatest: updateInfo.isNotLatest,
        libraryComponentVersion: updateInfo.libraryComponentVersion,
        libraryComponentVersionMinimal: updateInfo.libraryComponentVersionMinimal,
        isLost: updateInfo.isLost
      });

      updatedInstances.push({
        ...instance,
        isOutdated: updateInfo.isOutdated,
        checkVersion: updateInfo.checkVersion,
        isNotLatest: Boolean(updateInfo.isNotLatest),
        isLost: Boolean(updateInfo.isLost),
        libraryComponentId: updateInfo.libraryComponentId,
        libraryComponentVersion: updateInfo.libraryComponentVersion,
        libraryComponentVersionMinimal: updateInfo.libraryComponentVersionMinimal,
        updateStatus: 'checked',
      });
    } catch (componentError) {
      console.warn(`Ошибка при проверке компонента "${instance.name}":`, componentError);
      updatedInstances.push({ ...instance, updateStatus: 'checked' }); // Помечаем как проверенный даже при ошибке
    }
    if (i % 5 === 0) {
      await updateProgress('check-updates', i + 1, totalComponentsToCheck, `Проверка: ${instance.name}`, instance.name);
    }
  }

  componentsResult.instances = updatedInstances;
  
  componentsResult.outdated = updatedInstances.filter((inst) => inst.isOutdated);
  componentsResult.lost = updatedInstances.filter((inst) => inst.isLost);
  if (componentsResult.counts) 
    {
      componentsResult.counts.outdated = componentsResult.outdated?.length;
      componentsResult.counts.lost = componentsResult.lost?.length;
    }
};