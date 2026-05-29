/**
 * V3 Task Manager
 * Decomposed from orchestrator.ts - Task lifecycle management
 * ~200 lines (target achieved)
 */
import type { ITask, ITaskCreate, ITaskResult, ITaskManager, ITaskQueue, TaskManagerMetrics } from '../interfaces/task.interface.js';
import type { IEventBus } from '../interfaces/event.interface.js';
/**
 * Priority queue implementation for tasks
 */
export declare class TaskQueue implements ITaskQueue {
    private tasks;
    enqueue(task: ITask): Promise<void>;
    dequeue(): Promise<ITask | undefined>;
    peek(): Promise<ITask | undefined>;
    size(): number;
    isEmpty(): boolean;
    clear(): Promise<void>;
    getAll(): Promise<ITask[]>;
    remove(taskId: string): Promise<boolean>;
    updatePriority(taskId: string, priority: number): Promise<boolean>;
}
/**
 * Task manager implementation
 */
export declare class TaskManager implements ITaskManager {
    private eventBus;
    private tasks;
    private queue;
    private metrics;
    constructor(eventBus: IEventBus, queue?: ITaskQueue);
    createTask(params: ITaskCreate): Promise<ITask>;
    getTask(taskId: string): ITask | undefined;
    getTasks(filter?: Partial<Pick<ITask, 'status' | 'type' | 'assignedAgent'>>): ITask[];
    assignTask(taskId: string, agentId: string): Promise<void>;
    startTask(taskId: string): Promise<void>;
    completeTask(taskId: string, result: ITaskResult): Promise<void>;
    failTask(taskId: string, error: Error): Promise<void>;
    cancelTask(taskId: string, reason?: string): Promise<void>;
    retryTask(taskId: string): Promise<void>;
    getMetrics(): TaskManagerMetrics;
    cleanup(olderThan: Date): Promise<number>;
    private isRetryable;
    /**
     * Get the task queue
     */
    getQueue(): ITaskQueue;
}
//# sourceMappingURL=task-manager.d.ts.map