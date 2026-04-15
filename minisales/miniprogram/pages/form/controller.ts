export interface OrderFormValue {
  name?: string;
  brand?: string;
  series?: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  remark?: string;
  deadline?: string;
  quantity?: number | string;
}

export interface OrderFormUpload {
  id?: string;
  url?: string;
  name?: string;
  type?: 'image' | 'video';
  status?: 'loading' | 'reload' | 'failed' | 'done';
  isLocal?: boolean;
}

export interface BoundSalesProductValue {
  productId?: string;
  variantId?: string;
}

export interface OrderFormState {
  name: string;
  brand: string;
  series: string;
  sku: string;
  size: string;
  color: string;
  material: string;
  remark: string;
  deadline: string;
  quantity: number;
}

interface BuildCreatePayloadInput {
  form: OrderFormState;
  uploads: OrderFormUpload[];
  boundProduct?: BoundSalesProductValue | null;
}

interface FormPrefillInput extends OrderFormValue, BoundSalesProductValue {
  files?: OrderFormUpload[];
  variantLabel?: string;
  primaryImage?: string;
}

function toQuantity(value: unknown): number {
  const next = Number(value || 1);
  return Number.isFinite(next) && next > 0 ? next : 1;
}

function toFormText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function buildCreatePayload({ form, uploads, boundProduct }: BuildCreatePayloadInput) {
  return {
    name: String(form.name || '').trim(),
    brand: String(form.brand || '').trim(),
    series: String(form.series || '').trim(),
    sku: String(form.sku || '').trim(),
    size: String(form.size || '').trim(),
    color: String(form.color || '').trim(),
    material: String(form.material || '').trim(),
    remark: String(form.remark || '').trim(),
    deadline: String(form.deadline || '').trim(),
    quantity: toQuantity(form.quantity),
    fileIds: (uploads || [])
      .filter((item) => item.status === 'done' && item.id)
      .map((item) => String(item.id)),
    ...(boundProduct?.productId ? { productId: boundProduct.productId } : {}),
    ...(boundProduct?.variantId ? { variantId: boundProduct.variantId } : {}),
  };
}

export function canSubmitOrderForm(uploads: OrderFormUpload[]): boolean {
  return !(uploads || []).some((item) => item.status === 'loading');
}

export function buildFormPrefillState(form: OrderFormState, prefill: FormPrefillInput) {
  const nextForm = {
    name: toFormText(prefill.name ?? form.name),
    brand: toFormText(prefill.brand ?? form.brand),
    series: toFormText(prefill.series ?? form.series),
    sku: toFormText(prefill.sku ?? form.sku),
    size: toFormText(prefill.size ?? form.size),
    color: toFormText(prefill.color ?? form.color),
    material: toFormText(prefill.material ?? form.material),
    remark: toFormText(prefill.remark ?? form.remark),
    deadline: toFormText(prefill.deadline ?? form.deadline),
    quantity: toQuantity(prefill.quantity ?? form.quantity),
  };

  const boundProduct = prefill.productId
    ? {
        productId: prefill.productId,
        variantId: prefill.variantId || '',
        name: prefill.name || '',
        brand: prefill.brand || '',
        series: prefill.series || '',
        sku: prefill.sku || '',
        variantLabel: prefill.variantLabel || '',
        primaryImage: prefill.primaryImage || '',
      }
    : null;

  const fileList = (prefill.files || [])
    .filter((item) => item && item.url)
    .map((item) => ({
      id: item.id,
      url: String(item.url || ''),
      name: item.name,
      type: item.type || 'image',
      status: 'done' as const,
      isLocal: false as const,
    }));

  return {
    form: nextForm,
    boundProduct,
    fileList,
  };
}
