/**
 * 限制并发数的任务执行器 (SOTA Implementation)
 * 类似于 p-limit 或 p-map，但无外部依赖
 *
 * @param {Array<() => Promise<any>>} tasks - 任务工厂函数数组
 * @param {number} limit - 并发限制数
 * @returns {Promise<any[]>} - 所有任务结果 (Promise.all 行为：遇错即止)
 * @throws {Error} - 如果任意任务失败
 */
export async function runConcurrent(tasks, limit = 3) {
    if (!tasks || tasks.length === 0) return [];
    
    const results = new Array(tasks.length);
    let index = 0;

    // SOTA 迭代器模式实现:
    // 创建指定数量的 "worker" 协程，每个 worker 负责不断从任务池中提取任务并执行
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
        while (index < tasks.length) {
            const i = index++;
            const task = tasks[i];
            results[i] = await task(); // 执行并存储结果
        }
    });

    await Promise.all(workers);
    return results;
}

/**
 * 限制并发数并允许部分失败 (Promise.allSettled 行为)
 * @param {Array<() => Promise<any>>} tasks 
 * @param {number} limit 
 * @returns {Promise<PromiseSettledResult<any>[]>}
 */
export async function runConcurrentSettled(tasks, limit = 3) {
    const wrappedTasks = tasks.map(task => async () => {
        try {
            const value = await task();
            return { status: 'fulfilled', value };
        } catch (reason) {
            return { status: 'rejected', reason };
        }
    });

    return runConcurrent(wrappedTasks, limit);
}
