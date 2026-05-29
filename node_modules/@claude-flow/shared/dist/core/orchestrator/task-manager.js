/**
 * V3 Task Manager
 * Decomposed from orchestrator.ts - Task lifecycle management
 * ~200 lines (target achieved)
 */
import { SystemEventTypes } from '../interfaces/event.interface.js';
import { randomBytes } from 'crypto';
// Secure task ID generation
function generateSecureTaskId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(12).toString('hex');
    return `task_${timestamp}_${random}`;
}
/**
 * Priority queue implementation for tasks
 */
export class TaskQueue {
    tasks = [];
    async enqueue(task) {
        this.tasks.push(task);
        this.tasks.sort((a, b) => b.priority - a.priority);
    }
    async dequeue() {
        return this.tasks.shift();
    }
    async peek() {
        return this.tasks[0];
    }
    size() {
        return this.tasks.length;
    }
    isEmpty() {
        return this.tasks.length === 0;
    }
    async clear() {
        this.tasks = [];
    }
    async getAll() {
        return [...this.tasks];
    }
    async remove(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            return true;
        }
        return false;
    }
    async updatePriority(taskId, priority) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.priority = priority;
            this.tasks.sort((a, b) => b.priority - a.priority);
            return true;
        }
        return false;
    }
}
/**
 * Task manager implementation
 */
export class TaskManager {
    eventBus;
    tasks = new Map();
    queue;
    metrics = {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0,
        totalDuration: 0,
        totalWaitTime: 0,
    };
    constructor(eventBus, queue) {
        this.eventBus = eventBus;
        this.queue = queue ?? new TaskQueue();
    }
    async createTask(params) {
        const task = {
            id: generateSecureTaskId(),
            type: params.type,
            description: params.description,
            priority: params.priority ?? 50,
            createdAt: new Date(),
            status: 'pending',
            timeout: params.timeout,
            assignedAgent: params.assignedAgent,
            input: params.input,
            metadata: params.metadata,
        };
        this.tasks.set(task.id, task);
        this.metrics.totalTasks++;
        this.eventBus.emit(SystemEventTypes.TASK_CREATED, { task });
        return task;
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    getTasks(filter) {
        let tasks = Array.from(this.tasks.values());
        if (filter) {
            if (filter.status) {
                tasks = tasks.filter(t => t.status === filter.status);
            }
            if (filter.type) {
                tasks = tasks.filter(t => t.type === filter.type);
            }
            if (filter.assignedAgent) {
                tasks = tasks.filter(t => t.assignedAgent === filter.assignedAgent);
            }
        }
        return tasks;
    }
    async assignTask(taskId, agentId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.assignedAgent = agentId;
        task.status = 'assigned';
        this.eventBus.emit(SystemEventTypes.TASK_ASSIGNED, {
            taskId,
            agentId,
        });
    }
    async startTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.status = 'running';
        task.startedAt = new Date();
        // Calculate wait time
        const waitTime = task.startedAt.getTime() - task.createdAt.getTime();
        this.metrics.totalWaitTime += waitTime;
        this.eventBus.emit(SystemEventTypes.TASK_STARTED, {
            taskId,
            agentId: task.assignedAgent,
            startTime: task.startedAt,
        });
    }
    async completeTask(taskId, result) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.status = 'completed';
        task.completedAt = new Date();
        task.output = result.output;
        this.metrics.completedTasks++;
        this.metrics.totalDuration += result.duration;
        this.eventBus.emit(SystemEventTypes.TASK_COMPLETED, {
            taskId,
            result,
        });
    }
    async failTask(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error;
        this.metrics.failedTasks++;
        this.eventBus.emit(SystemEventTypes.TASK_FAILED, {
            taskId,
            error,
            retryable: this.isRetryable(task),
        });
    }
    async cancelTask(taskId, reason) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.status = 'cancelled';
        task.completedAt = new Date();
        this.metrics.cancelledTasks++;
        this.eventBus.emit(SystemEventTypes.TASK_CANCELLED, {
            taskId,
            reason: reason ?? 'User requested',
        });
    }
    async retryTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        const retryCount = task.metadata?.retryCount ?? 0;
        const maxRetries = task.metadata?.maxRetries ?? 3;
        if (retryCount >= maxRetries) {
            throw new Error(`Task ${taskId} has exceeded max retries`);
        }
        task.status = 'pending';
        task.assignedAgent = undefined;
        task.startedAt = undefined;
        task.completedAt = undefined;
        task.error = undefined;
        task.metadata = {
            ...task.metadata,
            retryCount: retryCount + 1,
        };
        await this.queue.enqueue(task);
        this.eventBus.emit(SystemEventTypes.TASK_RETRY, {
            taskId,
            attempt: retryCount + 1,
            maxAttempts: maxRetries,
            error: task.error,
        });
    }
    getMetrics() {
        const pendingTasks = this.getTasks({ status: 'pending' }).length;
        const runningTasks = this.getTasks({ status: 'running' }).length;
        return {
            totalTasks: this.metrics.totalTasks,
            pendingTasks,
            runningTasks,
            completedTasks: this.metrics.completedTasks,
            failedTasks: this.metrics.failedTasks,
            cancelledTasks: this.metrics.cancelledTasks,
            avgDuration: this.metrics.completedTasks > 0
                ? this.metrics.totalDuration / this.metrics.completedTasks
                : 0,
            avgWaitTime: this.metrics.completedTasks > 0
                ? this.metrics.totalWaitTime / this.metrics.completedTasks
                : 0,
        };
    }
    async cleanup(olderThan) {
        let cleaned = 0;
        const cutoffTime = olderThan.getTime();
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.completedAt && task.completedAt.getTime() < cutoffTime) {
                this.tasks.delete(taskId);
                cleaned++;
            }
        }
        return cleaned;
    }
    isRetryable(task) {
        const retryCount = task.metadata?.retryCount ?? 0;
        const maxRetries = task.metadata?.maxRetries ?? 3;
        return retryCount < maxRetries;
    }
    /**
     * Get the task queue
     */
    getQueue() {
        return this.queue;
    }
}
//# sourceMappingURL=task-manager.js.map