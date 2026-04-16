import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PermissionDeniedState from '../PermissionDeniedState.vue';

describe('PermissionDeniedState', () => {
  it('uses shared button primitives for retry actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/ui/PermissionDeniedState.vue'),
      'utf8'
    );

    expect(source).toContain('AppButton');
    expect(source).not.toContain('<button');
  });

  it('falls back to requiredPermission when reason is absent', () => {
    const wrapper = mount(PermissionDeniedState, {
      props: {
        requiredPermission: 'orders:manage',
      },
      global: {
        stubs: {
          AppButton: true,
          AppIcon: true,
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('需要权限：orders:manage');
  });

  it('prefers explicit reason over requiredPermission fallback copy', () => {
    const wrapper = mount(PermissionDeniedState, {
      props: {
        requiredPermission: 'orders:manage',
        reason: '管理员已禁用此入口',
      },
      global: {
        stubs: {
          AppButton: true,
          AppIcon: true,
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('管理员已禁用此入口');
    expect(wrapper.text()).not.toContain('需要权限：orders:manage');
  });
});
