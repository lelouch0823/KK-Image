#!/usr/bin/env node

/**
 * SDK 生成脚本
 * 从 OpenAPI 规范生成 TypeScript SDK 客户端代码
 *
 * 用法:
 *   node scripts/generate-sdk.js                     # 从本地服务器获取规范
 *   node scripts/generate-sdk.js --spec path/to/spec.json  # 从文件读取规范
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const SDK_DIR = path.join(ROOT, 'sdk');

// ─── 颜色输出 ────────────────────────────────────────────────────────────────

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  process.stdout.write(`${colors[color] || colors.reset}${msg}${colors.reset}\n`);
}

// ─── 获取 OpenAPI 规范 ────────────────────────────────────────────────────────

async function fetchSpec(source) {
  if (source) {
    // 从文件读取
    log(`📄 从文件读取规范: ${source}`, 'cyan');
    const content = fs.readFileSync(source, 'utf-8');
    return JSON.parse(content);
  }

  // 从本地服务器获取
  const baseUrl = process.env.SDK_SPEC_URL || 'http://localhost:8080/api/v1/api-docs/openapi.json';
  log(`🌐 从服务器获取规范: ${baseUrl}`, 'cyan');

  try {
    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    log(`❌ 无法获取 OpenAPI 规范: ${error.message}`, 'red');
    log('💡 确保开发服务器正在运行 (pnpm dev:all)', 'yellow');
    process.exit(1);
  }
}

// ─── 类型生成 ─────────────────────────────────────────────────────────────────

/**
 * 将 OpenAPI schema 转换为 TypeScript 类型字符串
 */
function schemaToType(schema, indent = 0) {
  if (!schema) return 'unknown';

  const pad = '  '.repeat(indent);
  const pad1 = '  '.repeat(indent + 1);

  switch (schema.type) {
    case 'string':
      if (schema.enum) {
        return schema.enum.map((v) => `'${v}'`).join(' | ');
      }
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${schemaToType(schema.items, indent)}[]`;
    case 'object': {
      if (schema.additionalProperties) {
        return `Record<string, ${schemaToType(schema.additionalProperties, indent)}>`;
      }
      if (!schema.properties) return 'Record<string, unknown>';
      const entries = Object.entries(schema.properties);
      if (entries.length === 0) return 'Record<string, unknown>';
      const required = new Set(schema.required || []);
      const lines = entries.map(([key, prop]) => {
        const opt = required.has(key) ? '' : '?';
        return `${pad1}${escapeKey(key)}${opt}: ${schemaToType(prop, indent + 1)};`;
      });
      return `{\n${lines.join('\n')}\n${pad}}`;
    }
    default:
      return 'unknown';
  }
}

function escapeKey(key) {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return key;
  return `'${key}'`;
}

/**
 * 从路径和方法生成类型名称
 * 例如: POST /manage/files -> CreateFileRequest
 *       GET /manage/files (query params) -> ListFileQuery
 */
function generateTypeName(pathStr, method, location) {
  const segments = pathStr
    .split('/')
    .filter((s) => s && !s.startsWith('{') && s !== 'manage' && s !== 'v1' && s !== 'api');

  const lastSegment = segments[segments.length - 1] || 'resource';
  const singular = singularize(lastSegment);
  const pascalSegment = toPascalCase(singular);
  const pascalPlural = toPascalCase(lastSegment);

  switch (location) {
    case 'body':
      if (method === 'post') return `Create${pascalSegment}Request`;
      if (method === 'patch' || method === 'put') return `Update${pascalSegment}Request`;
      return `${pascalSegment}Request`;
    case 'query':
      return `List${pascalPlural}Query`;
    case 'response':
      if (method === 'get') return `${pascalPlural}Response`;
      return `${pascalSegment}Response`;
    default:
      return `${pascalSegment}Data`;
  }
}

function singularize(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * 从路径中提取操作 ID
 */
function getOperationId(pathStr, method) {
  const segments = pathStr
    .split('/')
    .filter((s) => s && !s.startsWith('{') && s !== 'manage' && s !== 'v1' && s !== 'api');

  const actionMap = {
    get: 'list',
    post: 'create',
    patch: 'update',
    put: 'replace',
    delete: 'delete',
  };
  const action = actionMap[method] || method;
  const resource = segments.join('-');

  return `${action}${toPascalCase(resource)}`;
}

// ─── 代码生成 ─────────────────────────────────────────────────────────────────

/**
 * 收集所有需要生成的类型
 */
function collectTypes(spec) {
  const types = new Map();

  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
      const operation = pathItem[method];
      if (!operation) continue;

      // 请求体类型
      if (operation.requestBody?.content?.['application/json']?.schema) {
        const schema = operation.requestBody.content['application/json'].schema;
        const name = generateTypeName(pathStr, method, 'body');
        if (!types.has(name)) {
          types.set(name, { schema, description: `${method.toUpperCase()} ${pathStr} 请求体` });
        }
      }

      // 查询参数类型
      if (operation.parameters?.length > 0) {
        const queryParams = operation.parameters.filter((p) => p.in === 'query');
        if (queryParams.length > 0) {
          const name = generateTypeName(pathStr, method, 'query');
          if (!types.has(name)) {
            const schema = {
              type: 'object',
              properties: Object.fromEntries(
                queryParams.map((p) => [p.name, p.schema || { type: 'string' }])
              ),
            };
            types.set(name, { schema, description: `${method.toUpperCase()} ${pathStr} 查询参数` });
          }
        }
      }
    }
  }

  return types;
}

/**
 * 生成 types/index.ts
 */
function generateTypesFile(types) {
  const lines = ['// 自动生成的类型定义 - 请勿手动修改', '// 由 scripts/generate-sdk.js 生成', ''];

  for (const [name, { schema, description }] of types) {
    lines.push(`/** ${description} */`);
    const typeStr = schemaToType(schema, 0);
    if (typeStr.startsWith('{')) {
      lines.push(`export interface ${name} ${typeStr}`);
    } else {
      lines.push(`export type ${name} = ${typeStr};`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 生成 API 模块 (按 tag 分组)
 */
function generateApiModules(spec, types) {
  const tagGroups = new Map();

  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tag = operation.tags?.[0] || 'default';
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);
      tagGroups.get(tag).push({ path: pathStr, method, operation });
    }
  }

  const modules = {};

  for (const [tag, operations] of tagGroups) {
    const moduleName = tagToModuleName(tag);
    const lines = [
      `// 自动生成的 ${tag} API 模块 - 请勿手动修改`,
      '// 由 scripts/generate-sdk.js 生成',
      '',
      "import type { ApiClient } from '../client.js';",
    ];

    // 收集此模块使用的类型
    const usedTypes = new Set();
    for (const { path: pathStr, method, operation } of operations) {
      if (operation.requestBody?.content?.['application/json']?.schema) {
        usedTypes.add(generateTypeName(pathStr, method, 'body'));
      }
      if (operation.parameters?.some((p) => p.in === 'query')) {
        usedTypes.add(generateTypeName(pathStr, method, 'query'));
      }
    }

    if (usedTypes.size > 0) {
      const typeImports = [...usedTypes].sort().join(', ');
      lines.push(`import type { ${typeImports} } from '../types/index.js';`);
    }

    lines.push('');
    lines.push(`/** ${tag} API */`);
    lines.push(`export class ${toPascalCase(moduleName)}Api {`);
    lines.push('  constructor(private client: ApiClient) {}');
    lines.push('');

    for (const { path: pathStr, method, operation } of operations) {
      const funcName = getOperationId(pathStr, method);
      const summary = operation.summary || '';

      // 生成方法
      lines.push(`  /** ${summary} */`);

      const params = [];
      const pathParams = (operation.parameters || []).filter((p) => p.in === 'path');
      const hasQuery = operation.parameters?.some((p) => p.in === 'query');
      const hasBody = !!operation.requestBody?.content?.['application/json']?.schema;

      for (const p of pathParams) {
        params.push(`${p.name}: string`);
      }
      if (hasQuery) {
        params.push(`query?: ${generateTypeName(pathStr, method, 'query')}`);
      }
      if (hasBody) {
        params.push(`body: ${generateTypeName(pathStr, method, 'body')}`);
      }

      const paramStr = params.join(', ');

      // 构建 URL
      let urlExpr;
      if (pathParams.length > 0) {
        urlExpr = '`' + pathStr.replace(/\{(\w+)\}/g, '${$1}') + '`';
      } else {
        urlExpr = `'${pathStr}'`;
      }

      lines.push(`  async ${funcName}(${paramStr}): Promise<unknown> {`);

      if (hasQuery && method === 'get') {
        lines.push(
          `    return this.client.request('${method.toUpperCase()}', ${urlExpr}, { query: query as Record<string, unknown> });`
        );
      } else if (hasBody) {
        lines.push(
          `    return this.client.request('${method.toUpperCase()}', ${urlExpr}, { body });`
        );
      } else {
        lines.push(`    return this.client.request('${method.toUpperCase()}', ${urlExpr});`);
      }

      lines.push('  }');
      lines.push('');
    }

    lines.push('}');

    modules[moduleName] = lines.join('\n');
  }

  return modules;
}

/**
 * 标签名转模块名
 */
function tagToModuleName(tag) {
  const map = {
    认证: 'auth',
    文件管理: 'files',
    文件夹管理: 'folders',
    订单管理: 'orders',
    商品管理: 'products',
    用户管理: 'users',
    default: 'misc',
  };
  return map[tag] || tag.toLowerCase().replace(/\s+/g, '-');
}

/**
 * 生成 client.ts
 */
function generateClient() {
  return `// 自动生成的基础 HTTP 客户端 - 请勿手动修改
// 由 scripts/generate-sdk.js 生成

/** 客户端配置 */
export interface ClientConfig {
  /** API 基础 URL (例如: https://api.example.com/api) */
  baseUrl: string;
  /** 认证 Token (JWT 或 API Key) */
  token?: string;
  /** API Key (用于 X-API-Key 头) */
  apiKey?: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 请求超时 (毫秒, 默认 30000) */
  timeout?: number;
}

/** API 错误 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 请求选项 */
interface RequestOptions {
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** API 客户端接口 */
export interface ApiClient {
  request(method: string, path: string, options?: RequestOptions): Promise<unknown>;
}

/** HTTP 客户端实现 */
export class HttpClient implements ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\\/+$/, '');
    this.timeout = config.timeout || 30000;

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (config.token) {
      this.defaultHeaders['Authorization'] = \`Bearer \${config.token}\`;
    }
    if (config.apiKey) {
      this.defaultHeaders['X-API-Key'] = config.apiKey;
    }
  }

  async request(method: string, path: string, options: RequestOptions = {}): Promise<unknown> {
    const url = new URL(\`\${this.baseUrl}\${path}\`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: method.toUpperCase(),
        headers: { ...this.defaultHeaders, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        throw new ApiError(\`API 请求失败: \${response.status} \${response.statusText}\`, response.status, errorBody);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }
      return response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(\`请求超时 (\${this.timeout}ms)\`, 408);
      }
      throw error;
    }
  }

  /** 更新认证 Token */
  setToken(token: string): void {
    this.defaultHeaders['Authorization'] = \`Bearer \${token}\`;
  }

  /** 更新 API Key */
  setApiKey(apiKey: string): void {
    this.defaultHeaders['X-API-Key'] = apiKey;
  }
}
`;
}

/**
 * 生成 index.ts (主入口)
 */
function generateIndex(modules) {
  const lines = [
    '// 自动生成的 SDK 入口 - 请勿手动修改',
    '// 由 scripts/generate-sdk.js 生成',
    '',
    "export { HttpClient, ApiError } from './client.js';",
    "export type { ClientConfig, ApiClient } from './client.js';",
    "export * from './types/index.js';",
    '',
  ];

  for (const moduleName of Object.keys(modules).sort()) {
    const className = `${toPascalCase(moduleName)}Api`;
    lines.push(`export { ${className} } from './api/${moduleName}.js';`);
  }

  lines.push('');
  lines.push("import { HttpClient } from './client.js';");
  lines.push("import type { ClientConfig } from './client.js';");

  for (const moduleName of Object.keys(modules).sort()) {
    const className = `${toPascalCase(moduleName)}Api`;
    lines.push(`import { ${className} } from './api/${moduleName}.js';`);
  }

  lines.push('');
  lines.push('/** KK-Image SDK 客户端 */');
  lines.push('export class KKImageClient {');
  lines.push('  private client: HttpClient;');
  lines.push('');

  for (const moduleName of Object.keys(modules).sort()) {
    lines.push(`  /** ${moduleName} API */`);
    lines.push(`  readonly ${moduleName}: ${toPascalCase(moduleName)}Api;`);
    lines.push('');
  }

  lines.push('  constructor(config: ClientConfig) {');
  lines.push('    this.client = new HttpClient(config);');
  lines.push('');
  for (const moduleName of Object.keys(modules).sort()) {
    lines.push(`    this.${moduleName} = new ${toPascalCase(moduleName)}Api(this.client);`);
  }
  lines.push('  }');
  lines.push('');
  lines.push('  /** 更新认证 Token */');
  lines.push('  setToken(token: string): void {');
  lines.push('    this.client.setToken(token);');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成 package.json
 */
function generatePackageJson() {
  return JSON.stringify(
    {
      name: '@kk-image/sdk',
      version: '0.1.0',
      description: 'KK-Image API SDK - 自动生成的 TypeScript 客户端',
      type: 'module',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
      },
      files: ['dist'],
      scripts: {
        build: 'tsc',
        clean: 'rm -rf dist',
        prepublish: 'pnpm build',
      },
      devDependencies: {
        typescript: '^6.0.3',
      },
      license: 'MIT',
    },
    null,
    2
  );
}

/**
 * 生成 tsconfig.json
 */
function generateTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM'],
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  );
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let specSource = null;

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spec' && args[i + 1]) {
      specSource = args[i + 1];
      i++;
    }
  }

  log('🚀 KK-Image SDK 生成器', 'bold');
  log('');

  // 1. 获取规范
  const spec = await fetchSpec(specSource);
  log(`✅ 已获取 OpenAPI 规范 (版本: ${spec.openapi})`, 'green');
  log(`   标题: ${spec.info.title}`);
  log(`   端点数: ${Object.keys(spec.paths || {}).length}`);
  log('');

  // 2. 收集类型
  const types = collectTypes(spec);
  log(`📦 收集到 ${types.size} 个类型定义`, 'cyan');

  // 3. 生成文件
  log('📝 生成 SDK 文件...', 'cyan');

  // 确保目录存在
  fs.mkdirSync(path.join(SDK_DIR, 'src', 'api'), { recursive: true });
  fs.mkdirSync(path.join(SDK_DIR, 'src', 'types'), { recursive: true });

  // client.ts
  fs.writeFileSync(path.join(SDK_DIR, 'src', 'client.ts'), generateClient());
  log('   ✓ src/client.ts', 'green');

  // types/index.ts
  fs.writeFileSync(path.join(SDK_DIR, 'src', 'types', 'index.ts'), generateTypesFile(types));
  log('   ✓ src/types/index.ts', 'green');

  // API 模块
  const modules = generateApiModules(spec, types);
  for (const [name, content] of Object.entries(modules)) {
    fs.writeFileSync(path.join(SDK_DIR, 'src', 'api', `${name}.ts`), content);
    log(`   ✓ src/api/${name}.ts`, 'green');
  }

  // index.ts
  fs.writeFileSync(path.join(SDK_DIR, 'src', 'index.ts'), generateIndex(modules));
  log('   ✓ src/index.ts', 'green');

  // package.json
  fs.writeFileSync(path.join(SDK_DIR, 'package.json'), generatePackageJson());
  log('   ✓ package.json', 'green');

  // tsconfig.json
  fs.writeFileSync(path.join(SDK_DIR, 'tsconfig.json'), generateTsConfig());
  log('   ✓ tsconfig.json', 'green');

  log('');
  log('✨ SDK 生成完成!', 'green');
  log('');
  log('后续步骤:', 'cyan');
  log('  1. cd sdk && pnpm install   # 安装依赖');
  log('  2. pnpm sdk:build           # 编译 TypeScript');
  log('  3. 在项目中使用:');
  log("     import { KKImageClient } from '@kk-image/sdk';");
  log("     const client = new KKImageClient({ baseUrl: '...', token: '...' });");
  log('     const files = await client.files.listFiles();');
}

main().catch((error) => {
  log(`❌ 生成失败: ${error.message}`, 'red');
  process.exit(1);
});
