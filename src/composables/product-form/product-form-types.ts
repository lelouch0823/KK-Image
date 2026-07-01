import type { Ref } from 'vue';

export interface ProductOption {
  id: string | null;
  name: string;
  values: string[];
  inputValue: string;
  archivedValues: Array<{ id: string; value: string; status: string }>;
  metaMap?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProductVariant {
  id?: string;
  sku: string;
  barcode?: string;
  supplier_sku?: string;
  price?: number;
  cost_price?: number;
  stock_quantity?: number;
  alert_threshold?: number;
  status: string;
  options_values: Record<string, string>;
  images?: string[];
  _clientKey?: string;
  _incomplete?: boolean;
  [key: string]: unknown;
}

export interface ProductForm {
  name: string;
  description: string;
  brand: string;
  series: string;
  category: string;
  currency: string;
  spu: string;
  slug: string;
  images: string[];
  options: ProductOption[];
  variants: ProductVariant[];
  [key: string]: unknown;
}

export interface DimensionArchiveWizard {
  open: boolean;
  step: number;
  optionIndex: number;
  optionId: string;
  affectedVariantsCount: number;
  sampleVariants: unknown[];
  mode: string;
  loading: boolean;
}

export interface ValueArchiveWizard {
  open: boolean;
  optionIndex: number;
  valueIndex: number;
  valueId: string;
  valueLabel: string;
  affectedVariantsCount: number;
  sampleVariants: unknown[];
  loading: boolean;
}

export interface ImageObject {
  id: string;
  url: string;
}

export interface TrackedDimension {
  id: string;
  name?: string;
  status?: string;
  values?: Array<{ id?: string; value: string; status?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface UseProductFormOptions {
  editMode: Ref<boolean>;
  initialData: Ref<Record<string, unknown> | null>;
  modelValue?: Ref<boolean> | null;
  emit: (event: string, ...args: unknown[]) => void;
}
