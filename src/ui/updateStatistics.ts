/**
 * Обновляет отображение статистики в UI
 * @param data - Данные статистики
 */
export function updateStatistics(data: any): void {
  console.log('updateStatistics called with data:', data);
  
  const { overallStats } = data;
  console.log('overallStats:', overallStats);
  
  if (!overallStats || !overallStats.nodeTypeCounts) {
    console.log('No nodeTypeCounts found');
    return;
  }
  
  // Update the Total tab counter
  const totalTab = document.querySelector('[data-tab="total"]');
  if (totalTab) {
    totalTab.textContent = `Total (${overallStats.totalNodes})`;
    console.log('Updated total tab with count:', overallStats.totalNodes);
  }
  
  // Update overall statistics list
  const overallStatsList = document.getElementById('overallStatsList');
  if (overallStatsList) {
    overallStatsList.innerHTML = '';
    
    // Add total count first
    const totalLi = document.createElement('li');
    totalLi.className = 'stats-item';
    totalLi.innerHTML = `<span class="stats-type"><strong>TOTAL NODES</strong></span><span class="stats-count"><strong>${overallStats.totalNodes}</strong></span>`;
    overallStatsList.appendChild(totalLi);
    
    // Add individual node types
    for (const [type, count] of Object.entries(overallStats.nodeTypeCounts)) {
      if ((count as number) > 0) {
        const li = document.createElement('li');
        li.className = 'stats-item';
        li.innerHTML = `<span class="stats-type">${type}</span><span class="stats-count">${count}</span>`;
        overallStatsList.appendChild(li);
      }
    }
    console.log('Updated statistics list');
  }
}

// Добавляем функцию к глобальному объекту UIModules
if (typeof window !== 'undefined') {
  (window as any).UIModules = (window as any).UIModules || {};
  (window as any).UIModules.updateStatistics = updateStatistics;
}