/**
 * Обновляет отображение статистики в UI
 * @param data - Данные статистики
 */
export function updateStatistics(data: any): void {
  const { overallStats } = data;
  
  // Update overall statistics
  const overallList = document.getElementById('overallStatsList');
  if (!overallList) return;
  
  overallList.innerHTML = '';
  
  // Sort node types by count (descending)
  const sortedTypes = Object.entries(overallStats.nodeTypeCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number));
  
  // Add total count
  const totalLi = document.createElement('li');
  totalLi.innerHTML = `
    <strong class="type-name">TOTAL NODES</strong>
    <strong class="type-count">${overallStats.totalNodes}</strong>
  `;
  overallList.appendChild(totalLi);

  for (const [type, count] of sortedTypes) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="type-name">${type}</span>
      <span class="type-count">${count}</span>
    `;
    overallList.appendChild(li);
  }
  
  // Update the Total tab counter
  const totalTab = document.querySelector('[data-tab="total"]');
  if (totalTab) totalTab.textContent = `Total (${overallStats.totalNodes})`;
}