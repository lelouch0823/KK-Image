import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/order/OrderFilters.vue'),
  'utf8'
);

const getSlotBlock = (slotName) => {
  const match = source.match(
    new RegExp(`<template\\s+#${slotName}>([\\s\\S]*?)<\\/template>`, 'm')
  );

  return match?.[1] ?? '';
};

describe('OrderFilters desktop layout', () => {
  it('renders desktop actions inline with filters after the search input', () => {
    const filtersBlock = getSlotBlock('filters');

    expect(filtersBlock).toContain('SearchInput');
    expect(filtersBlock).toContain('hidden shrink-0 items-center gap-2 lg:flex');
    expect(filtersBlock.indexOf('SearchInput')).toBeLessThan(
      filtersBlock.indexOf('hidden shrink-0 items-center gap-2 lg:flex')
    );
  });

  it('keeps the top actions slot reserved for mobile-only controls', () => {
    const actionsBlock = getSlotBlock('actions');

    expect(actionsBlock).toContain('lg:hidden');
    expect(actionsBlock).not.toContain('sm:flex');
  });
});
