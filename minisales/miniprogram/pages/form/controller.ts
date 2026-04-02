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
  status?: 'loading' | 'reload' | 'failed' | 'done';
}

export interface BoundSalesProductValue {
  productId?: string;
  variantId?: string;
}

interface BuildCreatePayloadInput {
  form: OrderFormValue;
  uploads: OrderFormUpload[];
  boundProduct?: BoundSalesProductValue | null;
}

function toQuantity(value: unknown): number {
  const next = Number(value || 1);
  return Number.isFinite(next) && next > 0 ? next : 1;
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
