export const salespersonActionAdapter = {
  entityType: 'salesperson',
  actionType: 'create_salesperson',
  targetModule: 'salespersons',
  requiredSlots: ['name', 'password'],
  optionalSlots: ['store', 'phone'],
  fieldLabels: {
    name: '销售员姓名',
    password: '初始密码',
    store: '门店',
    phone: '手机号',
  },
};
