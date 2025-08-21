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

  constructor(config: Partial<UpdateQueueConfig> = {}) {
    this.config = {
      batchSize: 5,
      maxConcurrent: 3,
      progressUpdateInterval: 1000,
      ...config,
    };
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

    const dedupeKey = `${component.mainComponentKey || "unknown"}_$$${component.nodeId || "no-node"}`;
    if (this.seenIds.has(dedupeKey)) {
      console.warn(
        "[UpdateQueue] Duplicate component detected and skipped:",
        { name: component.name, nodeId: component.nodeId, mainKey: component.mainComponentKey }
      );
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

    console.log(
      "[UpdateQueue] Added component to queue:",
      { name: component.name, nodeId: component.nodeId, mainKey: component.mainComponentKey, totalComponents: this.totalComponents, queueLength: this.queue.length }
    );

    // Убираем автоматический запуск startProcessing - он будет вызван вручную
    // if (!this.isRunning) {
    //   this.startProcessing();
    // }
  }

  /**
   * Add multiple components to the queue
   */
  public addComponents(components: ComponentData[]): void {
    components.forEach((component) => this.addComponent(component));
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
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isRunning) {
      console.log("[UpdateQueue] startProcessing called but already running, skipping");
      return;
    }

    this.isRunning = true;
    console.log("[UpdateQueue] Starting parallel update check processing");
    console.log(
      "[UpdateQueue] Initial status:",
      {
        queueLength: this.queue.length,
        totalComponents: this.totalComponents,
        batchSize: this.config.batchSize,
        maxConcurrent: this.config.maxConcurrent,
      }
    );

    const activeBatches: Promise<void>[] = [];

    // Process items in batches
    while (this.queue.length > 0 || activeBatches.length > 0) {
      // Start new batch if we have capacity
      while (
        activeBatches.length < this.config.maxConcurrent &&
        this.queue.length > 0
      ) {
        const batch = this.queue.splice(0, this.config.batchSize);
        const batchPromise = this.processBatch(batch);
        activeBatches.push(batchPromise);
        this.activeBatchesCount++;

        // Remove completed batches
        batchPromise.finally(() => {
          const index = activeBatches.indexOf(batchPromise);
          if (index > -1) {
            activeBatches.splice(index, 1);
            this.activeBatchesCount--;
          }
        });
      }

      // Wait for at least one batch to complete if we're at capacity
      if (activeBatches.length >= this.config.maxConcurrent) {
        await Promise.race(activeBatches);
      }

      // Small delay to prevent busy waiting
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.isRunning = false;
    console.log("[UpdateQueue] Processing completed, calling notifyCompletion");
    this.notifyCompletion();
  }

  /**
   * Process a batch of components
   */
  private async processBatch(batch: UpdateQueueItem[]): Promise<void> {
    try {
      // Process all items in the batch concurrently
      const promises = batch.map((item) => this.processComponent(item));
      await Promise.all(promises);
    } catch (error) {
      console.error("[UpdateQueue] Error processing batch:", error);
    }
  }

  /**
   * Process a single component
   */
  private async processComponent(item: UpdateQueueItem): Promise<void> {
    const { component } = item;
    // Create unique component ID to avoid collisions - используем тот же формат, что и в index.ts
    const componentId = `${component.mainComponentKey || "unknown"}_$${component.nodeId || "no-node"}`;

    // Track in-flight processing for graceful stop and diagnostics
    this.processing.add(componentId);
    console.log(
      `[UpdateQueue] Enqueued for processing: ${component.name}. In-flight now: ${this.processing.size}`
    );

    try {
      console.log(`[UpdateQueue] Processing component: ${component.name}`);

      // Get main component node for update check
      const mainComponent = component.mainComponentId
        ? ((await figma.getNodeByIdAsync(
            component.mainComponentId
          )) as ComponentNode | null)
        : null;

      if (!mainComponent) {
        console.warn(`Main component not found for: ${component.name}`);
        // Mark as completed without changes
        let finalId = componentId;
        if (this.completed.has(finalId)) {
          console.warn(
            `[UpdateQueue] Duplicate componentId detected (no main): ${finalId}. Resolving with suffix`
          );
          let counter = 1;
          while (this.completed.has(`${componentId}__dup_${counter}`)) {
            counter++;
          }
          finalId = `${componentId}__dup_${counter}`;
        }
        const fallbackComponent: ComponentData = { ...component, updateStatus: "checked" } as ComponentData;
        this.completed.set(finalId, fallbackComponent);
        this.processedCount++;
        return;
      }

      // Check for updates using the correct function signature
      const updateInfo = await updateAvailabilityCheck(
        mainComponent,
        component.nodeVersion
      );

      // Debug: Log what updateAvailabilityCheck returns
      console.log(
        `[UpdateQueue] updateAvailabilityCheck result for ${component.name}:`,
        {
          checkVersion: updateInfo.checkVersion,
          libraryComponentVersion: updateInfo.libraryComponentVersion,
          libraryComponentVersionMinimal:
            updateInfo.libraryComponentVersionMinimal,
          libraryComponentId: updateInfo.libraryComponentId,
          libraryComponentName: updateInfo.libraryComponentName,
          libraryComponentSetName: updateInfo.libraryComponentSetName,
          hasVersionData: !!(
            updateInfo.libraryComponentVersion ||
            updateInfo.libraryComponentVersionMinimal
          ),
        }
      );

      // Update component with new information
      const updatedComponent: ComponentData = {
        ...component,
        isOutdated: updateInfo.isOutdated,
        isLost: Boolean(updateInfo.isLost),
        isDeprecated: Boolean(updateInfo.isDeprecated),
        isNotLatest: Boolean(updateInfo.isNotLatest),
        checkVersion: updateInfo.checkVersion,
        libraryComponentVersion: updateInfo.libraryComponentVersion,
        libraryComponentVersionMinimal:
          updateInfo.libraryComponentVersionMinimal,
        libraryComponentName: updateInfo.libraryComponentName,
        libraryComponentSetName: updateInfo.libraryComponentSetName,
        libraryComponentId: updateInfo.libraryComponentId,
        updateStatus: "checked" as const,
      };

      // Debug: Log the final updatedComponent
      console.log(
        `[UpdateQueue] Final updatedComponent for ${component.name}:`,
        {
          libraryComponentVersion: updatedComponent.libraryComponentVersion,
          libraryComponentVersionMinimal:
            updatedComponent.libraryComponentVersionMinimal,
          libraryComponentId: updatedComponent.libraryComponentId,
          libraryComponentName: updatedComponent.libraryComponentName,
          libraryComponentSetName: updatedComponent.libraryComponentSetName,
          hasVersionData: !!(
            updatedComponent.libraryComponentVersion ||
            updatedComponent.libraryComponentVersionMinimal
          ),
        }
      );

      // Store completed result (with collision-safe key)
      let finalId = componentId;
      if (this.completed.has(finalId)) {
        console.warn(
          `[UpdateQueue] Duplicate componentId detected: ${finalId}. Resolving with suffix`
        );
        console.warn(`[UpdateQueue] Existing component: ${this.completed.get(finalId)?.name}, New component: ${updatedComponent.name}`);
        let counter = 1;
        while (this.completed.has(`${componentId}__dup_${counter}`)) {
          counter++;
        }
        finalId = `${componentId}__dup_${counter}`;
        console.log(`[UpdateQueue] Resolved duplicate with key: ${finalId}`);
      }
      this.completed.set(finalId, updatedComponent);
      this.processedCount++;

      console.log(
        `[UpdateQueue] Component ${updatedComponent.name} processed successfully. ComponentId: ${finalId}`
      );
      console.log(
        `[UpdateQueue] Completed map size: ${this.completed.size}, keys:`, 
        Array.from(this.completed.keys())
      );
      console.log(
        `[UpdateQueue] Component ${updatedComponent.name} stored in completed map:`,
        this.completed.has(finalId)
      );
      
      // Детальная отладка: выводим все компоненты в completed Map
      console.log(`[UpdateQueue] ALL COMPLETED COMPONENTS (${this.completed.size}):`);
      Array.from(this.completed.entries()).forEach(([key, comp]) => {
        console.log(`  [${key}]: ${comp.name} - hasLibraryVersion: ${!!comp.libraryComponentVersion}`);
      });

      // Notify progress
      if (this.onProgressCallback) {
        this.onProgressCallback(
          this.processedCount,
          this.totalComponents,
          updatedComponent
        );
      }

      // Update UI progress
      /*
      if (this.processedCount % 3 === 0) {
        await updateProgress(
          'check-updates',
          this.processedCount,
          this.totalComponents,
          `Проверка обновлений: ${component.name}`,
          component.name
        );
      }
*/
    } catch (error) {
      console.error(
        `[UpdateQueue] Error processing component ${component.name}:`,
        error
      );

      // Store component without update info on error (with collision-safe key)
      let finalId = componentId;
      if (this.completed.has(finalId)) {
        console.warn(
          `[UpdateQueue] Duplicate componentId detected (error path): ${finalId}. Resolving with suffix`
        );
        let counter = 1;
        while (this.completed.has(`${componentId}__dup_${counter}`)) {
          counter++;
        }
        finalId = `${componentId}__dup_${counter}`;
      }
      const fallbackComponent: ComponentData = { ...component, updateStatus: "checked" } as ComponentData;
      this.completed.set(finalId, fallbackComponent);
      this.processedCount++;

      console.error(
        `[UpdateQueue] Component ${component.name} processed with error. Progress: ${this.processedCount}/${this.totalComponents}`
      );
    } finally {
      // Always remove from in-flight set
      this.processing.delete(componentId);
      
    }
  }

  /**
   * Notify completion and return results
   */
  private notifyCompletion(): void {
    
    
    
    const buttonCount = Array.from(this.completed.values()).filter(c => (c.name || '').toLowerCase().includes('button')).length;
    
    // Integrity checks before forming results
    
    if (
      this.completed.size !== this.totalComponents ||
      this.processedCount !== this.totalComponents
    ) {
      console.error(
        `[UpdateQueue] INTEGRITY MISMATCH: completed (${this.completed.size}) or processed (${this.processedCount}) != total (${this.totalComponents})`
      );
    } else {
      console.log("[UpdateQueue] INTEGRITY OK: counts are consistent");
    }

    // Create deep copy of completed components to avoid reference issues
    const completedComponents = Array.from(this.completed.values()).map(
      (component) => ({
        ...component,
        // Ensure all properties are copied explicitly
        libraryComponentVersion: component.libraryComponentVersion,
        libraryComponentVersionMinimal:
          component.libraryComponentVersionMinimal,
        libraryComponentId: component.libraryComponentId,
        libraryComponentName: component.libraryComponentName,
        libraryComponentSetName: component.libraryComponentSetName,
        isOutdated: component.isOutdated,
        isNotLatest: component.isNotLatest,
        isLost: component.isLost,
        isDeprecated: component.isDeprecated,
      })
    );

    console.log(`[UpdateQueue] COMPLETED COMPONENTS BEFORE CALLBACK (${completedComponents.length}):`);
    completedComponents.forEach((comp, index) => {
      console.log(`  [${index}]: ${comp.name} - hasLibraryVersion: ${!!comp.libraryComponentVersion}, libraryVersion: ${comp.libraryComponentVersion}`);
    });

    // Create results object with deep copied data
    const results: ComponentsResult = {
      instances: completedComponents,
      counts: {
        components: completedComponents.length,
        icons: completedComponents.filter((c) => c.isIcon).length,
      },
    };

    // Debug: Check if libraryComponentVersion data is present
    const componentsWithVersions = results.instances.filter(
      (c) => c.libraryComponentVersion || c.libraryComponentVersionMinimal
    );
    
    if (componentsWithVersions.length > 0) {
      console.log(`[UpdateQueue] Sample component with versions:`, {
        name: componentsWithVersions[0].name,
        libraryComponentVersion:
          componentsWithVersions[0].libraryComponentVersion,
        libraryComponentVersionMinimal:
          componentsWithVersions[0].libraryComponentVersionMinimal,
      });
    }

    

    // Reset state BEFORE calling callback to avoid any interference
    const callbackToCall = this.onCompleteCallback;
    this.reset();

    // Notify completion with safe data
    if (callbackToCall) {
      callbackToCall(results);
    }
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
  }

  /**
   * Get current queue status
   */
  public getStatus(): {
    queueLength: number;
    processing: number;
    completed: number;
    total: number;
    isRunning: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      total: this.totalComponents,
      isRunning: this.isRunning,
    };
  }

  /**
   * Stop processing (graceful shutdown)
   */
  public async stop(): Promise<void> {
    
    this.isRunning = false;

    // Wait for current processing to complete
    while (this.processing.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.reset();
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
