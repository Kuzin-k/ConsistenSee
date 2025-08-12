/**
 * Извлекает описание и версию из описания узла или его главного компонента.
 * Если узел является INSTANCE, пытается получить описание из его mainComponent или родительского mainComponentSet.
 * @param {SceneNode | ComponentNode | ComponentSetNode} node - Узел (может быть INSTANCE, COMPONENT, или COMPONENT_SET) для получения описания.
 * @returns {Promise<Object>} Объект с описанием (`description`) и найденной версией (`nodeVersion`).
 */
export async function getDescription(node: SceneNode | ComponentNode | ComponentSetNode): Promise<{ description: string, nodeVersion: string | null }> {
  let description = '';
  // let nodeToParse = node; // Эта переменная менее критична, если description правильно каскадируется.

  if (!node) {
    console.warn('getDescription: получен пустой узел.');
    return { description: '', nodeVersion: null };
  }

  try {
    // 1. Сначала пытаемся получить описание непосредственно с самого узла.
    description = node.description || '';

    // 2. Если узел - КОМПОНЕНТ и у него нет своего описания,
    //    а его родитель - НАБОР КОМПОНЕНТОВ, берем описание из набора.
    if (node.type === 'COMPONENT' && !description && node.parent && node.parent.type === 'COMPONENT_SET') {
      description = node.parent.description || '';
    }
    // 3. Если узел - ЭКЗЕМПЛЯР и у него нет своего описания (или у его mainComponent нет описания).
    else if (node.type === 'INSTANCE') {
      // description = node.description || ''; // Это уже было сделано в п.1
      if (!description) { // Если у инстанса нет описания, идем к главному компоненту
        const mainComponent = await node.getMainComponentAsync();
        if (mainComponent) {
          // nodeToParse = mainComponent; // Обновляем узел, из которого берем описание
          description = mainComponent.description || '';
          // Если у mainComponent нет описания, и он часть COMPONENT_SET, берем описание из SET
          if (!description && mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
            // nodeToParse = mainComponent.parent; // Обновляем узел
            description = mainComponent.parent.description || '';
          }
        }
      }
    }
    // 4. Если узел - КОМПОНЕНТ (это может быть mainComponent, переданный в функцию)
    //    и у него все еще нет описания, проверяем его родительский COMPONENT_SET.
    //    Этот блок дублирует логику из пункта 2, но обеспечивает покрытие, если getDescription вызвана с COMPONENT.
    else if (node.type === 'COMPONENT' && !description && node.parent && node.parent.type === 'COMPONENT_SET') {
      description = node.parent.description || '';
    }
  } catch (error) {
    console.error(`Ошибка в getDescription для узла "${node.name}" (ID: ${node.id}):`, error);
    // Не отправляем сообщение в UI отсюда, чтобы не дублировать ошибки из checkComponentUpdate
    // figma.ui.postMessage({
    //   type: 'error',
    //   message: `Ошибка при получении описания для ${node.name}: ${error.message}`
    // });
    // В случае ошибки, description останется пустым, и версия не будет найдена.
  }

  // Извлекаем версию из полученного описания с помощью регулярного выражения
  let nodeVersion = null;
  if (description) { // Убедимся, что description это строка
    const versionPattern = /v\s*(\d+\.\d+\.\d+)/i; // Паттерн для поиска "v X.Y.Z"
    const match = String(description).match(versionPattern); // Приводим description к строке на всякий случай
    nodeVersion = match ? match[1] : null; // Если найдено совпадение, берем первую группу (версию)
  }

  return { description: description || '', nodeVersion };
}
