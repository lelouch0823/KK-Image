import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useToast } from '../useToast';

describe('useToast Composable', () => {
  beforeEach(() => {
    const { toasts } = useToast();
    toasts.value = [];
    vi.useFakeTimers();
  });

  it('should add a toast message', () => {
    const { addToast, toasts } = useToast();
    addToast('Hello World');

    expect(toasts.value.length).toBe(1);
    expect(toasts.value[0].message).toBe('Hello World');
    expect(toasts.value[0].type).toBe('success');
    expect(toasts.value[0].id).toBeDefined();
  });

  it('should allow object as first argument', () => {
    const { addToast, toasts } = useToast();
    addToast({ message: 'Error occurred', type: 'error', duration: 5000 });

    expect(toasts.value[0].message).toBe('Error occurred');
    expect(toasts.value[0].type).toBe('error');
  });

  it('should remove toast after duration', () => {
    const { addToast, toasts } = useToast();
    addToast('Temporary', 'success', 1000);

    expect(toasts.value.length).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(toasts.value.length).toBe(0);
  });

  it('should provide helper methods for different types', () => {
    const { success, error, warning, toasts } = useToast();

    success('Success msg');
    error('Error msg');
    warning('Warning msg');

    expect(toasts.value.length).toBe(3);
    expect(toasts.value[0].type).toBe('success');
    expect(toasts.value[1].type).toBe('error');
    expect(toasts.value[2].type).toBe('warning');
  });

  it('should remove toast manually', () => {
    const { addToast, removeToast, toasts } = useToast();
    const id = addToast('Manual');

    expect(toasts.value.length).toBe(1);
    removeToast(id);
    expect(toasts.value.length).toBe(0);
  });
});
