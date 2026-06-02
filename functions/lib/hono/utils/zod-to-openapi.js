/**
 * Zod Schema -> OpenAPI JSON Schema 转换器
 * 轻量级实现，覆盖项目中使用的常见 Zod 类型
 */

/**
 * 将 Zod schema 转换为 OpenAPI JSON Schema 对象
 * @param {import('zod').ZodType} schema
 * @returns {object} OpenAPI JSON Schema
 */
export function zodSchemaToOpenAPI(schema) {
  if (!schema || !schema._def) return {};

  const def = schema._def;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodObject':
      return convertObject(def);
    case 'ZodString':
      return convertString(def);
    case 'ZodNumber':
      return convertNumber(def);
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return convertArray(def);
    case 'ZodOptional':
      return zodSchemaToOpenAPI(def.innerType);
    case 'ZodNullable': {
      const inner = zodSchemaToOpenAPI(def.innerType);
      return { ...inner, nullable: true };
    }
    case 'ZodDefault': {
      const inner = zodSchemaToOpenAPI(def.innerType);
      return { ...inner, default: def.defaultValue() };
    }
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodNativeEnum':
      return { type: 'string', enum: Object.values(def.values) };
    case 'ZodUnion':
      return { oneOf: def.options.map((opt) => zodSchemaToOpenAPI(opt)) };
    case 'ZodRecord':
      return {
        type: 'object',
        additionalProperties: zodSchemaToOpenAPI(def.valueType),
      };
    case 'ZodUnknown':
      return {};
    case 'ZodLazy':
      return { type: 'object', description: 'lazy-ref' };
    default:
      return {};
  }
}

function convertObject(def) {
  const shape = def.shape();
  const properties = {};
  const required = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodSchemaToOpenAPI(value);
    if (!isOptional(value)) {
      required.push(key);
    }
  }

  const result = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

function convertString(def) {
  const result = { type: 'string' };
  const checks = def.checks || [];
  for (const check of checks) {
    if (check.kind === 'min') result.minLength = check.value;
    if (check.kind === 'max') result.maxLength = check.value;
    if (check.kind === 'email') result.format = 'email';
    if (check.kind === 'datetime') result.format = 'date-time';
    if (check.kind === 'regex') result.pattern = check.regex.source;
  }
  return result;
}

function convertNumber(def) {
  const result = { type: 'number' };
  const checks = def.checks || [];
  for (const check of checks) {
    if (check.kind === 'min') result.minimum = check.value;
    if (check.kind === 'max') result.maximum = check.value;
    if (check.kind === 'int') result.type = 'integer';
    if (check.kind === 'nonnegative') result.minimum = 0;
    if (check.kind === 'positive') result.minimum = 1;
  }
  return result;
}

function convertArray(def) {
  const result = {
    type: 'array',
    items: zodSchemaToOpenAPI(def.type),
  };
  const checks = def.minLength;
  if (checks) result.minItems = checks.value;
  const maxLen = def.maxLength;
  if (maxLen) result.maxItems = maxLen.value;
  return result;
}

function isOptional(schema) {
  if (!schema || !schema._def) return false;
  const typeName = schema._def.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}
