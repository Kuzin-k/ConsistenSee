import { ComponentData, ComponentsResult } from "../../shared/types";
import { getUpdateQueue } from "./updateQueue";

/**
 * Configuration for parallel update processor
 */
interface ParallelProcessorConfig {
  maxConcurrent: number;
  batchSize: number;
  progressUpdateInterval: number;
}

/**
 * Parallel update processor for handling component update checks
 */
export class ParallelUpdateProcessor {
  private config: ParallelProcessorConfig;
  private isProcessing: boolean = false;
  private processedCount: number = 0;
  private totalCount: number = 0;
  private onProgressCallback?: (
    processed: number,
    total: number,
    componentName?: string
  ) => Promise<void>;
  private onCompleteCallback?: (results: ComponentsResult) => void;

  constructor(config: Partial<ParallelProcessorConfig> = {}) {
    this.config = {
      maxConcurrent: 10,
      batchSize: 5,
      progressUpdateInterval: 500,
      ...config,
    };
  }

  /**
   * Set progress callback
   */
  public onProgress(
    callback: (
      processed: number,
      total: number,
      componentName?: string
    ) => Promise<void>
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
   * Process all components in the update queue
   */
  public async processAll(): Promise<ComponentsResult> {
    if (this.isProcessing) {
      throw new Error("Processor is already running");
    }

    this.isProcessing = true;
    this.processedCount = 0;

    try {
      const updateQueue = getUpdateQueue();

      const status = updateQueue.getStatus();
      this.totalCount = status.total;

      // Не выходим, даже если totalCount === 0 — ждём наполнение очереди и автостарт
      return new Promise<ComponentsResult>((resolve, reject) => {
        updateQueue.onProgress(
          async (
            processed: number,
            total: number,
            component?: ComponentData
          ) => {
            this.processedCount = processed;
            this.totalCount = total;
            if (this.onProgressCallback) {
              await this.onProgressCallback(processed, total, component?.name);
            }
          }
        );

        updateQueue.onComplete((results: ComponentsResult) => {
          this.isProcessing = false;
          try {
            if (this.onCompleteCallback) {
              if (typeof this.onCompleteCallback !== "function") {
                console.warn(
                  "[ParallelUpdateProcessor] onCompleteCallback задан, но это не функция"
                );
              } else {
                this.onCompleteCallback(results);
              }
            } else {
              console.warn(
                "[ParallelUpdateProcessor] onCompleteCallback не установлен"
              );
            }
          } catch (err) {
            console.error(
              "[ParallelUpdateProcessor] Ошибка внутри onCompleteCallback:",
              err
            );
          } finally {
            resolve(results);
          }
        });

        // Не запускаем вручную — автостарт произойдёт при первом добавлении элемента
        // updateQueue.startProcessingManually();
      });
    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }

  /**
   * Stop processing
   */
  public async stop(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    const updateQueue = getUpdateQueue();
    await updateQueue.stop();
    this.isProcessing = false;
  }

  /**
   * Get current processing status
   */
  public getStatus(): {
    isProcessing: boolean;
    processed: number;
    total: number;
    progress: number;
  } {
    return {
      isProcessing: this.isProcessing,
      processed: this.processedCount,
      total: this.totalCount,
      progress:
        this.totalCount > 0 ? (this.processedCount / this.totalCount) * 100 : 0,
    };
  }
}

// Global instance
let globalProcessor: ParallelUpdateProcessor | null = null;

/**
 * Get or create global parallel update processor
 */
export const getParallelUpdateProcessor = (): ParallelUpdateProcessor => {
  if (!globalProcessor) {
    globalProcessor = new ParallelUpdateProcessor({
      maxConcurrent: 3,
      batchSize: 5,
      progressUpdateInterval: 1000,
    });
  }
  return globalProcessor;
};

/**
 * Reset global parallel update processor
 */
export const resetParallelUpdateProcessor = (): void => {
  if (globalProcessor) {
    globalProcessor.stop();
    globalProcessor = null;
  }
};
