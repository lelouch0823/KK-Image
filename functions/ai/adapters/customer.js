export const customerActionAdapter = {
  entityType: 'customer',
  actionType: 'create_customer',
  targetModule: 'customers',
  requiredPermission: 'orders:manage',
  requiredSlots: ['name'],
  optionalSlots: ['phone', 'company', 'email', 'address', 'tags', 'remark'],
  fieldLabels: {
    name: '客户姓名',
    phone: '手机号',
    company: '公司',
    email: '邮箱',
    address: '地址',
    tags: '标签',
    remark: '备注',
  },
};
