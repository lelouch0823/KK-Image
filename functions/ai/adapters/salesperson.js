export const salespersonActionAdapter = {
  entityType: 'salesperson',
  actionType: 'create_salesperson',
  targetModule: 'salespersons',
  requiredSlots: ['name', 'password'],
  optionalSlots: ['store', 'phone'],
};
