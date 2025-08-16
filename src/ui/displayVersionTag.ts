export interface VersionDisplayOptions {
  instanceVersion?: string;
  libraryVersion?: string;
  isOutdated?: boolean;
  isGroupHeader?: boolean;
  uniqueVersions?: string[];
  checkVersion?: string;
}

/**
 * Создает и возвращает HTML-элемент с информацией о версии компонента
 * 
 * Функция поддерживает два режима работы:
 * 1. Для заголовков групп - единая логика на всех вкладках
 * 2. Для отдельных элементов - различная логика в зависимости от вкладки
 * 
 * @param options - Объект с параметрами отображения версии
 * @returns HTML-элемент (span или div) с информацией о версии
 */
export function displayVersionTag(options: VersionDisplayOptions): HTMLElement {
  const {
    instanceVersion = 'none',
    libraryVersion = 'none', 
    isOutdated = '',
    checkVersion = '',
    isGroupHeader = false,
    uniqueVersions = []
  } = options;

  let versionText = '';
  console.log(libraryVersion, checkVersion);

  // Создаем контейнер для версионного тега
  const versionGroup = document.createElement('span');
  versionGroup.classList.add('version-group');

  // Создаем сам тег с версией
  const versionBadge = document.createElement('span');
  versionBadge.classList.add('version-tag');

  // Обрабатываем заголовки групп - единая логика для всех вкладок
  if (isGroupHeader) {
    // Проверяем, есть ли версии у элементов группы
    const hasVersions = uniqueVersions.some(version => version && version !== 'none');
    const hasLibraryVersion = libraryVersion && libraryVersion !== 'none';
    
    // Если у всех элементов группы нет версии и у библиотеки нет версии, тег не отображается
    if (!hasVersions && !hasLibraryVersion) {return versionGroup;} // Возвращаем пустой контейнер
    
    // Определяем текст версии
    if (uniqueVersions.length === 1 && uniqueVersions[0] && uniqueVersions[0] !== 'none') {
      // Если у всех элементов группы номер версии одинаковый
      versionText = uniqueVersions[0];
    } else if (hasVersions) {
      // Если у элементов группы номер версии разный
      versionText = '* * *';
      versionBadge.classList.add("version-tag-notlatest");
    }
    
    // Если присутствует libraryVersion и isOutdated=true
    if (hasLibraryVersion && isOutdated) {
      versionBadge.textContent = `${versionText || '* * *'} → ${libraryVersion}`;
      versionBadge.classList.add('version-tag-outdated');
    } else if (versionText) {
      versionBadge.textContent = versionText;
    } else {
      return versionGroup; // Возвращаем пустой контейнер если нет текста
    }
  } else {
    // Обрабатываем отдельные элементы (не заголовки групп)
    const hasInstanceVersion = instanceVersion && instanceVersion !== 'none';
    const hasLibraryVersion = libraryVersion && libraryVersion !== 'none';
    
    // Если у элемента нет версии и у компонента библиотеки нет версии, тег не отображается
    if (!hasInstanceVersion && !hasLibraryVersion) {
      return versionGroup; // Возвращаем пустой контейнер
    }
    
    // Если присутствует libraryVersion
    if (hasLibraryVersion && checkVersion !=="Latest") {
      versionBadge.textContent = `${instanceVersion || 'none'} → ${libraryVersion}`;
      if (checkVersion==="NotLatest") {versionBadge.classList.add('version-tag-notlatest');}
      if (checkVersion==="Outdated") {versionBadge.classList.add('version-tag-outdated');}
    } else if (hasInstanceVersion) {
      // Показываем только версию элемента если она есть
      versionBadge.textContent = instanceVersion;
      // Если есть версия и она не просрочена помечаем зеленым
      if (checkVersion==="Latest") {versionBadge.classList.add('version-tag-latest');}
    } else {
      // Если нет версии элемента, но есть версия библиотеки (без isOutdated)
      return versionGroup; // Возвращаем пустой контейнер
    }
  }

  // Добавляем тег в контейнер только если есть текст для отображения
  if (versionBadge.textContent) {versionGroup.appendChild(versionBadge);}

  return versionGroup;
}