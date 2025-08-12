/**
 * Создает дерево отладки для отображения данных
 * @param data - Данные для отображения
 * @param searchTerm - Термин для поиска
 * @returns HTMLElement
 */
export function createDebugTree(data: any, searchTerm: string = ''): HTMLElement {
  try {
    let hasMatchingChild = false;
    
    // Если это примитивное значение, возвращаем простой элемент
    if (data === null || typeof data !== 'object') {
      return createValueElement(data, searchTerm);
    }

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const container = document.createElement('div');
    container.style.paddingLeft = '20px'; // Добавляем отступ для вложенных элементов

    // Создаем заголовок
    const isArray = Array.isArray(data);
    summary.textContent = isArray ? `Array [${data.length}]` : 'Object';
    details.appendChild(summary);

    // Обрабатываем элементы объекта/массива
    Object.entries(data).forEach(([key, value]) => {
      const line = document.createElement('div');
      line.style.marginBottom = '5px';
    
      // Создаем элемент ключа
      const keySpan = document.createElement('span');
      keySpan.className = 'key';
      keySpan.textContent = `${key}: `;
      keySpan.style.color = '#905';
      line.appendChild(keySpan);

      // Создаем элемент значения
      const valueContainer = createDebugTree(value, searchTerm);
    
      // Проверяем совпадение с поиском
      const matchesSearch = searchTerm && (
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (typeof value === 'number' && String(value).includes(searchTerm))
      );

      if (matchesSearch || (valueContainer as any).hasMatch) {
        hasMatchingChild = true;
        details.open = true;
      }

      line.appendChild(valueContainer);
      container.appendChild(line);
    });

    details.appendChild(container);
    (details as any).hasMatch = hasMatchingChild;

    return details;
  } catch (error) {
    console.error('Ошибка при создании дерева отладки:', error);
    const errorElement = document.createElement('div');
    errorElement.style.color = 'red';
    errorElement.textContent = `Error creating debug tree: ${(error as Error).message}`;
    return errorElement;
  }
}

/**
 * Создает элемент для отображения значения
 * @param value - Значение для отображения
 * @param searchTerm - Термин для поиска
 * @returns HTMLElement
 */
export function createValueElement(value: any, searchTerm: string = ''): HTMLElement {
  const span = document.createElement('span');
  const stringValue = String(value);

  // Устанавливаем соответствующий класс и содержимое
  if (typeof value === 'string') {
    span.className = 'string';
    span.textContent = `"${value}"`;
    span.style.color = '#690';
  } else if (typeof value === 'number') {
    span.className = 'number';
    span.textContent = String(value);
    span.style.color = '#2f6f9f';
  } else if (typeof value === 'boolean') {
    span.className = 'boolean';
    span.textContent = String(value);
    span.style.color = '#2f6f9f';
  } else {
    span.textContent = stringValue;
  }

  // Проверяем совпадение с поиском
  if (searchTerm && stringValue.toLowerCase().includes(searchTerm.toLowerCase())) {
    span.className += ' match';
    span.style.backgroundColor = 'yellow';
    (span as any).hasMatch = true;
  } else {
    (span as any).hasMatch = false;
  }

  return span;
}

/**
 * Отображает результаты поиска
 * @param results - Результаты поиска
 * @param searchTerm - Термин поиска
 */
export function displaySearchResults(results: any[], searchTerm: string): void {
  const searchResults = document.getElementById('searchResults');
  if (!searchResults) {
    console.error('Элемент searchResults не найден');
    return;
  }

  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<p>No matches found</p>';
    return;
  }

  const resultList = document.createElement('ul');
  results.forEach(instance => {
    const li = document.createElement('li');
    
    // Highlight matching text in name
    const nameText = instance.name;
    const highlightedName = highlightText(nameText, searchTerm);
    
    // Create result item
    const resultItem = document.createElement('div');
    resultItem.classList.add('search-result-item');
    resultItem.innerHTML = highlightedName;
    
    // Add description if exists
    if (instance.description) {
      const description = document.createElement('span');
      description.classList.add('description-tag');
      description.innerHTML = ' - ' + highlightText(instance.description, searchTerm);
      resultItem.appendChild(description);
    }
    
    li.appendChild(resultItem);
    resultList.appendChild(li);
  });
  
  searchResults.appendChild(resultList);
}

/**
 * Подсвечивает совпадающий текст
 * @param text - Исходный текст
 * @param searchTerm - Термин для поиска
 * @returns Текст с подсветкой
 */
export function highlightText(text: string, searchTerm: string): string {
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

// Добавляем функции к глобальному объекту UIModules
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.createDebugTree = createDebugTree;
  (window as any).UIModules.createValueElement = createValueElement;
  (window as any).UIModules.displaySearchResults = displaySearchResults;
  (window as any).UIModules.highlightText = highlightText;
}