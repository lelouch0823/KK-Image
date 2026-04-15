export const productActionAdapter = {
  entityType: 'product',
  actionType: 'create_product',
  targetModule: 'products',
  requiredPermission: 'products:manage',
  requiredSlots: ['name', 'currency', 'variants'],
  optionalSlots: ['spu', 'brand', 'category', 'description', 'images', 'dimensions'],
  fieldLabels: {
    name: '商品名称',
    currency: '币种',
    variants: '变体',
    spu: 'SPU',
    brand: '品牌',
    category: '分类',
    description: '描述',
    images: '图片',
    dimensions: '规格维度',
  },
};
