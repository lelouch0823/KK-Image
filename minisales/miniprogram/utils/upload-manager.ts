/**
 * Wait-And-Notify (WANT) Upload Manager
 * 用于在后台处理上传任务并在任务完成时发出通知
 */

interface UploadTask {
    id: string;
    orderId?: string;
    fileName: string;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'failed';
    error?: string;
    result?: any;
}

class UploadManager {
    private tasks: Map<string, UploadTask> = new Map();
    private listeners: Set<(tasks: UploadTask[]) => void> = new Set();

    /**
     * 添加上传任务
     */
    addTask(id: string, fileName: string, orderId?: string) {
        this.tasks.set(id, {
            id,
            orderId,
            fileName,
            progress: 0,
            status: 'pending'
        });
        this.notify();
    }

    /**
     * 更新任务进度
     */
    updateProgress(id: string, progress: number) {
        const task = this.tasks.get(id);
        if (task) {
            task.progress = progress;
            task.status = 'uploading';
            this.notify();
        }
    }

    /**
     * 任务完成
     */
    setSuccess(id: string, result: any) {
        const task = this.tasks.get(id);
        if (task) {
            task.status = 'success';
            task.result = result;
            task.progress = 100;
            this.notify();
            this.checkAndNotifyFinished(task.orderId);
        }
    }

    /**
     * 任务失败
     */
    setFailed(id: string, error: string) {
        const task = this.tasks.get(id);
        if (task) {
            task.status = 'failed';
            task.error = error;
            this.notify();
            this.checkAndNotifyFinished(task.orderId);
        }
    }

    /**
     * 检查订单关联的所有任务是否完成
     */
    private checkAndNotifyFinished(orderId?: string) {
        if (!orderId) return;

        const orderTasks = Array.from(this.tasks.values()).filter(t => t.orderId === orderId);
        const allFinished = orderTasks.every(t => t.status === 'success' || t.status === 'failed');

        if (allFinished) {
            const hasFailed = orderTasks.some(t => t.status === 'failed');
            const message = hasFailed
                ? `订单 ${orderId} 有部分图片上传失败`
                : `订单 ${orderId} 的所有图片已上传完成`;

            // 如果在后台，可以尝试用 wx.showModal (虽然有限制) 
            // 或者在用户回到前台时提示
            wx.showToast({
                title: message,
                icon: hasFailed ? 'none' : 'success',
                duration: 3000
            });
        }
    }

    /**
     * 获取所有任务
     */
    getTasks() {
        return Array.from(this.tasks.values());
    }

    clearTasksByOrder(orderId?: string) {
        if (!orderId) {
            this.tasks.clear();
            this.notify();
            return;
        }

        for (const [id, task] of this.tasks.entries()) {
            if (task.orderId === orderId) {
                this.tasks.delete(id);
            }
        }
        this.notify();
    }

    /**
     * 监听任务变化
     */
    subscribe(listener: (tasks: UploadTask[]) => void) {
        this.listeners.add(listener);
        listener(this.getTasks());
        return () => this.listeners.delete(listener);
    }

    private notify() {
        const currentTasks = this.getTasks();
        this.listeners.forEach(l => l(currentTasks));
    }
}

export const uploadManager = new UploadManager();
