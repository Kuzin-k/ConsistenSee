/**
 * Displays a message in the designated output element.
 * @param message The message to display.
 * @param isError If true, the message will be styled as an error.
 */
export const displayResult = (message: string, isError: boolean = false): void => {
  const outputElement = document.getElementById('componentDataOutput');
  if (!outputElement) {
    console.error('Элемент вывода не найден');
    return;
  }
  
  outputElement.innerHTML = '';
  const resultElement = document.createElement('p');
  resultElement.textContent = message;
  resultElement.style.color = isError ? '#d32f2f' : '#2e7d32';
  resultElement.style.fontWeight = 'bold';
  resultElement.style.padding = '10px';
  resultElement.style.border = `1px solid ${isError ? '#d32f2f' : '#2e7d32'}`;
  resultElement.style.borderRadius = '4px';
  outputElement.appendChild(resultElement);
  
  console.log('Отображен результат:', message);
}

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.displayResult = displayResult;
}