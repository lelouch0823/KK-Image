import { describe, it, expect, vi } from 'vitest';
import { runConcurrent, runConcurrentSettled } from '../concurrency';

describe('Concurrency Utils', () => {
  it('should run tasks in sequence if limit is 1', async () => {
    const sequence = [];
    const tasks = [
      () => new Promise(res => setTimeout(() => { sequence.push(1); res(1); }, 30)),
      () => new Promise(res => setTimeout(() => { sequence.push(2); res(2); }, 10))
    ];
    
    await runConcurrent(tasks, 1);
    expect(sequence).toEqual([1, 2]);
  });

  it('should run tasks concurrently within limit', async () => {
    const started = [];
    const tasks = [
      () => { started.push(1); return Promise.resolve(1); },
      () => { started.push(2); return Promise.resolve(2); },
      () => { started.push(3); return Promise.resolve(3); }
    ];
    
    // With limit 2, 3 should not start immediately if others were slow (though they are fast here)
    const results = await runConcurrent(tasks, 2);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle errors in runConcurrent (stop immediately)', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('Fail')),
      () => Promise.resolve(3)
    ];
    
    await expect(runConcurrent(tasks, 1)).rejects.toThrow('Fail');
  });

  it('should handle settled results in runConcurrentSettled', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject('error'),
      () => Promise.resolve(3)
    ];
    
    const results = await runConcurrentSettled(tasks, 2);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1]).toEqual({ status: 'rejected', reason: 'error' });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });
});
