import {
  ComponentData,
  ComponentsResult,
  ComponentNode,
} from "../../shared/types";
import { updateAvailabilityCheck } from "./updateAvailabilityCheck";
import { updateProgress } from "../utils/updateProgress";

/**
 * Interface for update queue item
 */
interface UpdateQueueItem {
  component: ComponentData;
  index: number;
  totalCount: number;
}

/**
 * Interface for update queue configuration
 */
interface UpdateQueueConfig {
  batchSize: number;
  maxConcurrent: number;
  progressUpdateInterval: number;
  /** Запускать обработку автоматически при первом добавлении */
  autoStart: boolean;
}

/**
 * Class for managing parallel component update checks
 */
export class UpdateQueue {
  private queue: UpdateQueueItem[] = [];
  private processing: Set<string> = new Set();
  private completed: Map<string, ComponentData> = new Map();
  private seenIds: Set<string> = new Set();
  private config: UpdateQueueConfig;
  private isRunning: boolean = false;
  private totalComponents: number = 0;
  private processedCount: number = 0;
  private activeBatchesCount: number = 0;
  private onProgressCallback?: (
    processed: number,
    total: number,
    component?: ComponentData
  ) => void;
  private onCompleteCallback?: (results: ComponentsResult) => void;
  private producerDone: boolean = false;

  constructor(config: Partial<UpdateQueueConfig> = {}) {
    this.config = {
      batchSize: 5,
      maxConcurrent: 2,
      progressUpdateInterval: 1000,
      autoStart: true,
      ...config,
    };
  }

  /**
   * Запускает обработку, если включён autoStart и очередь ещё не работает
   */
  private maybeStartProcessing(): void {
    if (this.config.autoStart && !this.isRunning) {
      // Не await, чтобы не блокировать поток добавления
      void this.startProcessing();
    }
  }

  /**
   * Add component to the update queue
   */
  public addComponent(component: ComponentData): void {
    if (!component.mainComponentKey) {
      console.warn(
        "[UpdateQueue] Component without mainComponentKey skipped:",
        component.name
      );
      return;
    }

    const dedupeKey = `${component.mainComponentKey || "unknown"}_$$${
      component.nodeId || "no-node"
    }`;
    if (this.seenIds.has(dedupeKey)) {
      console.warn("[UpdateQueue] Duplicate component detected and skipped:", {
        name: component.name,
        nodeId: component.nodeId,
        mainKey: component.mainComponentKey,
      });
      return;
    }
    this.seenIds.add(dedupeKey);

    const queueItem: UpdateQueueItem = {
      component,
      index: this.queue.length,
      totalCount: this.totalComponents,
    };

    this.queue.push(queueItem);
    this.totalComponents++;

    // Авто-запуск обработки
    this.maybeStartProcessing();
  }

  /**
   * Add multiple components to the queue
   */
  public addComponents(components: ComponentData[]): void {
    components.forEach((component) => this.addComponent(component));
    // addComponent уже вызовет maybeStartProcessing
  }

  /**
   * Start processing manually after all components are added
   */
  public startProcessingManually(): void {
    if (!this.isRunning) {
      this.startProcessing();
    }
  }

  /**
   * Set progress callback
   */
  public onProgress(
    callback: (
      processed: number,
      total: number,
      component?: ComponentData
    ) => void
  ): void {
    this.onProgressCallback = callback;
  }

  /**
   * Set completion callback
   */
  public onComplete(callback: (results: ComponentsResult) => void): void {
    this.onCompleteCallback = callback;
  }

  /**
   * Пометить, что продюсер (сканирование) завершён
   */
  public markProducerDone(): void {
    this.producerDone = true;
    console.log("[UpdateQueue] Producer marked as done");
  }

  /**
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isRunning) {
      console.log(
        "[UpdateQueue] startProcessing called but already running, skipping"
      );
      return;
    }

    this.isRunning = true;
    console.log("[UpdateQueue] Starting parallel update check processing");

    const activeBatches: Promise<void>[] = [];

    // Ждём до тех пор, пока либо есть работа, либо продюсер не завершён
    while (true) {
      // Стартуем новые батчи по мере возможности
      while (
        activeBatches.length < this.config.maxConcurrent &&
        this.queue.length > 0
      ) {
        const batch = this.queue.splice(0, this.config.batchSize);
        const batchPromise = this.processBatch(batch);
        activeBatches.push(batchPromise);
        this.activeBatchesCount++;

        // Удаляем завершённые батчи
        batchPromise.finally(() => {
          const index = activeBatches.indexOf(batchPromise);
          if (index > -1) {
            activeBatches.splice(index, 1);
            this.activeBatchesCount--;
          }
        });
      }

      // Если нет очереди и нет активных батчей — возможное завершение
      if (this.queue.length === 0 && activeBatches.length === 0) {
        if (this.producerDone) {
          // Продюсер закончил добавление — выходим и завершаем
          break;
        }
        // Продюсер ещё работает — ждём появления новых задач
        await new Promise((resolve) => setTimeout(resolve, 25));
        continue;
      }

      // Если достигли лимита — ждём первый завершившийся батч
      if (activeBatches.length >= this.config.maxConcurrent) {
        await Promise.race(activeBatches);
      }

      // Маленькая пауза, чтобы не жечь цикл
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.isRunning = false;
    this.notifyCompletion();
  }

  /**
   * Reset queue state
   */
  private reset(): void {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.seenIds.clear();
    this.totalComponents = 0;
    this.processedCount = 0;
    this.activeBatchesCount = 0;
    this.isRunning = false;
    this.producerDone = false;
  }

  /**
   * Clear queue state without stopping processing
   */
  public clear(): void {
    console.log("[UpdateQueue] Clearing queue state");
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.seenIds.clear();
    this.totalComponents = 0;
    this.processedCount = 0;
    this.activeBatchesCount = 0;
    this.isRunning = false;
    this.producerDone = false;
  }

  // Возвращает текущий статус очереди
  public getStatus(): {
    queueLength: number;
    total: number;
    processing: number;
    completed: number;
    isRunning: boolean;
  } {
    return {
      queueLength: this.queue.length,
      total: this.totalComponents,
      processing: this.processing.size,
      completed: this.completed.size,
      isRunning: this.isRunning,
    };
  }

  // Обработка батча компонентов
  private async processBatch(batch: UpdateQueueItem[]): Promise<void> {
    for (const item of batch) {
      const component = item.component;
      const dedupeKey = `${component.mainComponentKey || "unknown"}_$$$${component.nodeId || "no-node"}`;
      this.processing.add(dedupeKey);

      let updated: ComponentData = component;

      try {
        if (!component.mainComponentId || component.remote === false) {
          // Нет mainComponentId или локальный — просто помечаем как проверенный
          updated = { ...component, updateStatus: "checked" };
        } else {
          // Пропуск иконок и имён, начинающихся с '_' или '.'
          const trimmedName = (component.name || "").trim();
          const skipByName = component.type === "INSTANCE" && (trimmedName.startsWith("_") || trimmedName.startsWith("."));
          if (component.isIcon === true || skipByName) {
            updated = { ...component, updateStatus: "checked" };
          } else {
            const mainComponent = (await figma.getNodeByIdAsync(component.mainComponentId)) as ComponentNode | null;
            if (!mainComponent) {
              console.warn(`[UpdateQueue] Main component not found by id: ${component.mainComponentId}`);
              updated = { ...component, updateStatus: "checked" };
            } else {
              const info = await updateAvailabilityCheck(mainComponent, component.nodeVersion);
              updated = {
                ...component,
                isOutdated: info.isOutdated,
                checkVersion: info.checkVersion,
                isNotLatest: Boolean(info.isNotLatest),
                isLost: Boolean(info.isLost),
                isDeprecated: Boolean(info.isDeprecated),
                libraryComponentName: info.libraryComponentName,
                libraryComponentSetName: info.libraryComponentSetName,
                libraryComponentId: info.libraryComponentId,
                libraryComponentVersion: info.libraryComponentVersion,
                libraryComponentVersionMinimal: info.libraryComponentVersionMinimal,
                updateStatus: "checked",
              };
            }
          }
        }
      } catch (err) {
        console.warn(`[UpdateQueue] Error processing component "${component.name}":`, err);
        updated = { ...component, updateStatus: "checked" };
      } finally {
        this.completed.set(dedupeKey, updated);
        this.processing.delete(dedupeKey);
        this.processedCount++;

        if (this.onProgressCallback) {
          try {
            this.onProgressCallback(this.processedCount, this.totalComponents, updated);
          } catch (cbErr) {
            console.error("[UpdateQueue] onProgress callback error:", cbErr);
          }
        }
      }
    }
  }

  // Финализирует и отдает результаты
  private notifyCompletion(): void {
    const instances = Array.from(this.completed.values());
    const outdated = instances.filter((i) => i.isOutdated);
    const lost = instances.filter((i) => i.isLost);
    const deprecated = instances.filter((i) => i.isDeprecated);
    const iconsCount = instances.filter((i) => i.isIcon).length;
    const componentsCount = instances.length - iconsCount;

    const results: ComponentsResult = {
      instances,
      outdated,
      lost,
      deprecated,
      counts: {
        components: componentsCount,
        icons: iconsCount,
        outdated: outdated.length,
        lost: lost.length,
        deprecated: deprecated.length,
      },
    };

    if (this.onCompleteCallback) {
      try {
        this.onCompleteCallback(results);
      } catch (err) {
        console.error("[UpdateQueue] onComplete callback error:", err);
      }
    }
  }

  // Мягкая остановка: помечаем как завершение продюсера и ждем активные батчи
  public async stop(): Promise<void> {
    this.producerDone = true;
    const deadline = Date.now() + 2000;
    while (this.activeBatchesCount > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    this.isRunning = false;
  }
}

// Global instance for the update queue
let globalUpdateQueue: UpdateQueue | null = null;

/**
 * Get or create global update queue instance
 */
export const getUpdateQueue = (): UpdateQueue => {
  if (!globalUpdateQueue) {
    globalUpdateQueue = new UpdateQueue({
      batchSize: 5,
      maxConcurrent: 3,
      progressUpdateInterval: 1000,
      autoStart: true, // запускаем обработку автоматически при добавлении первого элемента
    });
  }
  return globalUpdateQueue;
};

/**
 * Reset global update queue
 */
export const resetUpdateQueue = (): void => {
  if (globalUpdateQueue) {
    globalUpdateQueue.stop();
    globalUpdateQueue = null;
  }
};
