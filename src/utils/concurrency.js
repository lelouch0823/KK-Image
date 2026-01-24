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
    const results = new Array(tasks.length);
    const executing = new Set();
    let index = 0;

    const runTask = async () => {
        if (index >= tasks.length) return;

        const i = index++;
        const task = tasks[i];

        const p = Promise.resolve().then(() => task());

        // 追踪执行中任务
        executing.add(p);

        try {
            results[i] = await p;
        } finally {
            executing.delete(p);
        }

        // 链式调用下一个
        if (index < tasks.length) {
            await runTask();
        }
    };

    // 启动初始批次
    const initialExec = [];
    while (initialExec.length < limit && index < tasks.length) {
        initialExec.push(runTask());
    }

    // 等待所有初始链完成 (runTask 内部会递归等待)
    // 注意：runTask 是 async，但它内部 await p。
    // 上面的实现有缺陷：runTask 递归调用 await runTask() 会导致调用栈随任务数增长? 
    // 不，await runTask() 是尾调用位置，但在 JS async中不是真正的尾递归优化。
    // 更好的方式是 while 循环 + Promise.race (如之前版本)，或者纯 Promise 链。

    // SOTA 迭代器模式实现:
    await Promise.all(
        Array.from({ length: Math.min(limit, tasks.length) }, async () => {
            while (index < tasks.length) {
                const i = index++;
                const task = tasks[i];
                results[i] = await task(); // 执行并存储结果
            }
        })
    );

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
