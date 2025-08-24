export interface VersionDisplayOptions {
  instanceVersion?: string;
  libraryVersion?: string;
  isOutdated?: boolean;
  isGroupHeader?: boolean;
  uniqueVersions?: string[];
  checkVersion?: string;
  groupItems?: any[]; // Массив элементов группы для подсчета статусов
  tabType?: string; // Тип вкладки для определения логики отображения
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
    instanceVersion = "      ",
    libraryVersion = "      ",
    isOutdated = "",
    checkVersion = "",
    isGroupHeader = false,
    uniqueVersions = [],
    groupItems = [],
    tabType = "",
  } = options;

  // Не отображаем теги версий на специальных вкладках
  if (tabType === "deprecated" || tabType === "detached" || tabType === "lost") {
    const emptyContainer = document.createElement("span");
    emptyContainer.classList.add("version-group");
    return emptyContainer;
  }

  let versionText = "";

  // Создаем контейнер для версионного тега
  const versionGroup = document.createElement("span");
  versionGroup.classList.add("version-group");

  // Создаем сам тег с версией
  const versionBadge = document.createElement("span");
  versionBadge.classList.add("version-tag");

  // Обрабатываем заголовки групп - показываем три тега с количеством элементов по статусам
  if (isGroupHeader && groupItems) {
    // Подсчитываем количество элементов для каждого статуса
    const latestCount = groupItems.filter(
      (item: any) => item.checkVersion === "Latest"
    ).length;
    const notLatestCount = groupItems.filter(
      (item: any) => item.checkVersion === "NotLatest"
    ).length;
    const outdatedCount = groupItems.filter(
      (item: any) => item.checkVersion === "Outdated"
    ).length;

    // Если нет элементов с версиями, не показываем теги
    if (latestCount === 0 && notLatestCount === 0 && outdatedCount === 0) {
      return versionGroup;
    }

    // Создаем тег для Outdated (красный)
    if (outdatedCount > 0) {
      const outdatedBadge = document.createElement("span");
      outdatedBadge.classList.add("version-tag", "version-tag-outdated");
      outdatedBadge.textContent = outdatedCount.toString();
      versionGroup.appendChild(outdatedBadge);
    }

    // Создаем тег для NotLatest (желтый)
    if (notLatestCount > 0) {
      const notLatestBadge = document.createElement("span");
      notLatestBadge.classList.add("version-tag", "version-tag-notlatest");
      notLatestBadge.textContent = notLatestCount.toString();
      versionGroup.appendChild(notLatestBadge);
    }

    // Создаем тег для Latest (зеленый)
    if (latestCount > 0) {
      const latestBadge = document.createElement("span");
      latestBadge.classList.add("version-tag", "version-tag-latest");
      latestBadge.textContent = latestCount.toString();
      versionGroup.appendChild(latestBadge);
    }

    return versionGroup;
  } else {
    // Обрабатываем отдельные элементы (не заголовки групп)
    const hasInstanceVersion = instanceVersion && instanceVersion !== "none";
    const hasLibraryVersion = libraryVersion && libraryVersion !== "none";

    // Если у элемента нет версии и у компонента библиотеки нет версии, тег не отображается
    if (!hasInstanceVersion && !hasLibraryVersion) {
      return versionGroup; // Возвращаем пустой контейнер
    }

    // Если присутствует libraryVersion
    if (hasLibraryVersion && checkVersion !== "Latest") {
      versionBadge.textContent = `${
        instanceVersion || "none"
      } → ${libraryVersion}`;
      if (checkVersion === "NotLatest") {
        versionBadge.classList.add("version-tag-notlatest");
      }
      if (checkVersion === "Outdated") {
        versionBadge.classList.add("version-tag-outdated");
      }
    } else if (hasInstanceVersion) {
      // Показываем только версию элемента если она есть
      versionBadge.textContent = instanceVersion;
      // Если есть версия и она не просрочена помечаем зеленым
      if (checkVersion === "Latest") {
        versionBadge.classList.add("version-tag-latest");
      }
    } else {
      // Если нет версии элемента, но есть версия библиотеки (без isOutdated)
      return versionGroup; // Возвращаем пустой контейнер
    }
  }

  // Добавляем тег в контейнер только если есть текст для отображения (только для отдельных элементов)
  if (!isGroupHeader && versionBadge.textContent) {
    versionGroup.appendChild(versionBadge);
  }

  return versionGroup;
}
