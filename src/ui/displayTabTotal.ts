/**
 * Обновляет отображение статистики в пользовательском интерфейсе
 * Функция получает данные о статистике узлов и отображает их на странице в удобном формате
 * @param data - Объект с данными статистики, должен содержать поле overallStats
 *                с объектом типа { totalNodes: number, nodeTypeCounts: Record<string, number> }
 */
export function displayTabTotal(data: Record<string, unknown>): void {
  // Извлекаем общую статистику из переданного объекта данных
  const { overallStats } = data;
  const stats = overallStats as { totalNodes: number; nodeTypeCounts: Record<string, number> };
  console.log("displayTabTotalStats:", overallStats);

  // Проверяем наличие необходимых данных для корректной работы
  if (!overallStats || !stats.nodeTypeCounts) {
    console.log("No nodeTypeCounts found");
    return;
  }

  // Обновляем вкладку "Total", добавляя к ней общее количество узлов в скобках
  const totalTab = document.querySelector('[data-tab="total"]');
  if (totalTab) {
    totalTab.textContent = `Total (${stats.totalNodes})`;
    console.log("Updated total tab with count:", stats.totalNodes);
  }

  // Находим элемент списка для отображения общей статистики
  const overallStatsList = document.getElementById("overallStatsList");
  if (overallStatsList) {
    // Очищаем содержимое списка перед заполнением новыми данными
    overallStatsList.innerHTML = "";

    // Создаем и добавляем элемент с общим количеством узлов (первый пункт в списке)
    const totalLi = document.createElement("li");
    totalLi.className = "stats-item";
    totalLi.innerHTML = `<span class="stats-type"><strong>TOTAL NODES</strong></span><span class="stats-count"><strong>${stats.totalNodes}</strong></span>`;
    overallStatsList.appendChild(totalLi);

    // Сортируем типы узлов по количеству в порядке убывания (от большего к меньшему)
    const sortedTypes = Object.entries(stats.nodeTypeCounts).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    );

    // Проходит через отсортированныанны типы узлов и создаем элементы для каждого типа
    for (const [type, count] of sortedTypes) {
      if ((count as number) > 0) {
        // Создаем элемент списка для текущего типа узла
        const li = document.createElement("li");
        li.className = "stats-item";
        // Заполняем элемент содержимым: тип узла и его количество
        li.innerHTML = `<span class="stats-type">${type}</span><span class="stats-count">${count}</span>`;
        overallStatsList.appendChild(li);
      }
    }
  }
}

// Добавляем функцию к глобальному объекту UIModules для доступа из других модулей
// Это позволяет вызывать функцию из других частях приложения, например, при приении сообщений
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).UIModules = (window as unknown as Record<string, unknown>).UIModules || {};
  ((window as unknown as Record<string, unknown>).UIModules as Record<string, unknown>).displayTabTotal = displayTabTotal;
}
