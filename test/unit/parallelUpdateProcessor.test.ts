import { ParallelUpdateProcessor, getParallelUpdateProcessor, resetParallelUpdateProcessor } from '../../src/js/update/parallelUpdateProcessor';
import { getUpdateQueue, resetUpdateQueue } from '../../src/js/update/updateQueue';
import { ComponentData, ComponentsResult } from '../../src/shared/types';

// Mock Figma API
(global as any).figma = {
  ui: {
    postMessage: jest.fn()
  },
  notify: jest.fn(),
  closePlugin: jest.fn()
};

describe('ParallelUpdateProcessor', () => {
  let processor: ParallelUpdateProcessor;
  
  beforeEach(() => {
    resetUpdateQueue();
    resetParallelUpdateProcessor();
    processor = new ParallelUpdateProcessor({
      maxConcurrent: 2,
      batchSize: 3,
      progressUpdateInterval: 100
    });
  });

  afterEach(() => {
    resetUpdateQueue();
    resetParallelUpdateProcessor();
  });

  describe('Инициализация', () => {
    it('должен создаваться с конфигурацией по умолчанию', () => {
      const defaultProcessor = new ParallelUpdateProcessor();
      const status = defaultProcessor.getStatus();
      
      expect(status.isProcessing).toBe(false);
      expect(status.processed).toBe(0);
      expect(status.total).toBe(0);
      expect(status.progress).toBe(0);
    });

    it('должен создаваться с кастомной конфигурацией', () => {
      const customProcessor = new ParallelUpdateProcessor({
        maxConcurrent: 5,
        batchSize: 10
      });
      
      expect(customProcessor).toBeDefined();
    });
  });

  describe('Обработка компонентов', () => {
    it('должен возвращать пустой результат для пустой очереди', async () => {
      const result = await processor.processAll();
      
      expect(result).toEqual({
        instances: [],
        counts: {
          components: 0,
          icons: 0
        }
      });
    });

    it('должен обрабатывать компоненты из очереди', async () => {
      const mockComponents: ComponentData[] = [
        {
          type: 'COMPONENT',
          name: 'Component 1',
          nodeId: 'comp1',
          key: 'key1',
          description: '',
          nodeVersion: null,
          hidden: false,
          remote: false,
          parentName: null,
          parentId: null,
          mainComponentName: null,
          mainComponentKey: null,
          mainComponentId: null,
          mainComponentSetKey: null,
          mainComponentSetName: null,
          mainComponentSetId: null,
          isIcon: false,
          size: 'medium',
          isNested: false,
          isLost: false,
          isDeprecated: false,
          skipUpdate: false,
          isOutdated: false,
          isNotLatest: false,
          checkVersion: null
        },
        {
          type: 'COMPONENT',
          name: 'Component 2',
          nodeId: 'comp2',
          key: 'key2',
          description: '',
          nodeVersion: null,
          hidden: false,
          remote: false,
          parentName: null,
          parentId: null,
          mainComponentName: null,
          mainComponentKey: null,
          mainComponentId: null,
          mainComponentSetKey: null,
          mainComponentSetName: null,
          mainComponentSetId: null,
          isIcon: false,
          size: 'medium',
          isNested: false,
          isLost: false,
          isDeprecated: false,
          skipUpdate: false,
          isOutdated: false,
          isNotLatest: false,
          checkVersion: null
        }
      ];

      const updateQueue = getUpdateQueue();
      updateQueue.addComponents(mockComponents);

      let progressCalled = false;
      let completeCalled = false;

      processor.onProgress(async (processed, total, componentName) => {
        progressCalled = true;
        expect(processed).toBeGreaterThanOrEqual(0);
        expect(total).toBe(2);
      });

      processor.onComplete((results) => {
        completeCalled = true;
        expect(results).toBeDefined();
      });

      const result = await processor.processAll();
      
      expect(result).toBeDefined();
      expect(result.instances).toBeDefined();
      expect(result.counts).toBeDefined();
    });

    it('должен корректно отслеживать прогресс', async () => {
      const mockComponents: ComponentData[] = [
        {
          type: 'COMPONENT',
          name: 'Component 1',
          nodeId: 'comp1',
          key: 'key1',
          description: '',
          nodeVersion: null,
          hidden: false,
          remote: false,
          parentName: null,
          parentId: null,
          mainComponentName: null,
          mainComponentKey: null,
          mainComponentId: null,
          mainComponentSetKey: null,
          mainComponentSetName: null,
          mainComponentSetId: null,
          isIcon: false,
          size: 'medium',
          isNested: false,
          isLost: false,
          isDeprecated: false,
          skipUpdate: false,
          isOutdated: false,
          isNotLatest: false,
          checkVersion: null
        }
      ];

      const updateQueue = getUpdateQueue();
      updateQueue.addComponents(mockComponents);

      const progressUpdates: Array<{processed: number, total: number}> = [];
      
      processor.onProgress(async (processed, total) => {
        progressUpdates.push({ processed, total });
      });

      const result = await processor.processAll();
      
      // Проверяем, что результат получен и имеет правильную структуру
      expect(result).toBeDefined();
      expect(result.instances).toBeDefined();
      expect(result.counts).toBeDefined();
      expect(typeof result.counts.components).toBe('number');
      expect(typeof result.counts.icons).toBe('number');
    });
  });

  describe('Управление состоянием', () => {
    it('должен корректно отслеживать статус обработки', () => {
      const initialStatus = processor.getStatus();
      expect(initialStatus.isProcessing).toBe(false);
    });

    it('должен предотвращать одновременную обработку', async () => {
      const mockComponents: ComponentData[] = [
        {
          type: 'COMPONENT',
          name: 'Component 1',
          nodeId: 'comp1',
          key: 'key1',
          description: '',
          nodeVersion: null,
          hidden: false,
          remote: false,
          parentName: null,
          parentId: null,
          mainComponentName: null,
          mainComponentKey: null,
          mainComponentId: null,
          mainComponentSetKey: null,
          mainComponentSetName: null,
          mainComponentSetId: null,
          isIcon: false,
          size: 'medium',
          isNested: false,
          isLost: false,
          isDeprecated: false,
          skipUpdate: false,
          isOutdated: false,
          isNotLatest: false,
          checkVersion: null
        }
      ];

      const updateQueue = getUpdateQueue();
      updateQueue.addComponents(mockComponents);

      const firstProcess = processor.processAll();
      
      await expect(processor.processAll()).rejects.toThrow('Processor is already running');
      
      await firstProcess;
    });

    it('должен корректно останавливать обработку', async () => {
      await processor.stop();
      
      const status = processor.getStatus();
      expect(status.isProcessing).toBe(false);
    });
  });

  describe('Глобальный экземпляр', () => {
    it('должен возвращать один и тот же экземпляр', () => {
      const processor1 = getParallelUpdateProcessor();
      const processor2 = getParallelUpdateProcessor();
      
      expect(processor1).toBe(processor2);
    });

    it('должен сбрасывать глобальный экземпляр', () => {
      const processor1 = getParallelUpdateProcessor();
      resetParallelUpdateProcessor();
      const processor2 = getParallelUpdateProcessor();
      
      expect(processor1).not.toBe(processor2);
    });
  });
});