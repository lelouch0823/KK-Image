export const customerActionAdapter = {
  entityType: 'customer',
  actionType: 'create_customer',
  targetModule: 'customers',
  requiredSlots: ['name'],
  optionalSlots: ['phone', 'company', 'email', 'address', 'tags', 'remark'],
};
