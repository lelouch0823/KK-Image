export const productActionAdapter = {
  entityType: 'product',
  actionType: 'create_product',
  targetModule: 'products',
  requiredSlots: ['name', 'currency', 'variants'],
  optionalSlots: ['spu', 'brand', 'category', 'description', 'images', 'dimensions'],
};
