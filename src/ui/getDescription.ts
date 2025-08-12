/**
 * Представляет узел на стороне UI, содержащий информацию об описании.
 */
interface UINodeWithDescription {
  description?: string;
  mainComponent?: {
    description?: string;
    parent?: {
      description?: string;
    };
  };
}

/**
 * Извлекает описание из узла или его главного компонента.
 * @примечание Эта функция, по-видимому, не используется в текущем коде UI.
 * Основная логика получения описания обрабатывается на стороне бэкенда.
 *
 * @param node - Узел, из которого нужно извлечь описание.
 * @returns Строка с описанием или пустая строка, если описание не найдено.
 */
export const getDescription = (node: UINodeWithDescription): string => {
  let description = node.description;

  if (!description && node.mainComponent) {
    description = node.mainComponent.description;
    if (!description && node.mainComponent.parent) {
      description = node.mainComponent.parent.description;
    }
  }
  return description || '';
};