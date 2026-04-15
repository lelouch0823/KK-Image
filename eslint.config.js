import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import prettier from "eslint-config-prettier";

const browserGlobals = {
    window: "readonly",
    document: "readonly",
    console: "readonly",
    localStorage: "readonly",
    sessionStorage: "readonly",
    navigator: "readonly",
    fetch: "readonly",
    URL: "readonly",
    FormData: "readonly",
    File: "readonly",
    Blob: "readonly",
    FileReader: "readonly",
    Image: "readonly",
    setTimeout: "readonly",
    setInterval: "readonly",
    clearTimeout: "readonly",
    clearInterval: "readonly",
    requestAnimationFrame: "readonly",
    cancelAnimationFrame: "readonly",
    alert: "readonly",
    confirm: "readonly",
    performance: "readonly",
    IntersectionObserver: "readonly",
    ResizeObserver: "readonly",
    MutationObserver: "readonly",
    CustomEvent: "readonly",
    Event: "readonly",
    AbortController: "readonly",
    Headers: "readonly",
    Request: "readonly",
    Response: "readonly",
    URLSearchParams: "readonly",
    Notification: "readonly",
    XMLHttpRequest: "readonly",
    getComputedStyle: "readonly",
    crypto: "readonly"
};

const nodeGlobals = {
    process: "readonly",
    Buffer: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
    global: "readonly",
    require: "readonly",
    module: "readonly",
    console: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    setInterval: "readonly",
    clearInterval: "readonly",
    URLSearchParams: "readonly",
    WebSocket: "readonly"
};

const testGlobals = {
    describe: "readonly",
    it: "readonly",
    test: "readonly",
    expect: "readonly",
    beforeAll: "readonly",
    beforeEach: "readonly",
    before: "readonly",
    afterAll: "readonly",
    afterEach: "readonly",
    after: "readonly",
    vi: "readonly"
};

// Cloudflare Workers 全局变量（Web Platform APIs）
const workersGlobals = {
    // URL/Fetch APIs
    URL: "readonly",
    Response: "readonly",
    Request: "readonly",
    Headers: "readonly",
    fetch: "readonly",
    FormData: "readonly",
    File: "readonly",
    Blob: "readonly",
    ReadableStream: "readonly",
    WritableStream: "readonly",
    TransformStream: "readonly",
    AbortSignal: "readonly",
    AbortController: "readonly",
    // Crypto & Encoding
    crypto: "readonly",
    TextEncoder: "readonly",
    TextDecoder: "readonly",
    atob: "readonly",
    btoa: "readonly",
    // Timers
    setTimeout: "readonly",
    setInterval: "readonly",
    clearTimeout: "readonly",
    clearInterval: "readonly",
    // Console & Performance
    console: "readonly",
    performance: "readonly",
    // Workers-specific
    caches: "readonly",
    CompressionStream: "readonly",
    DecompressionStream: "readonly",
    // Node compat (Cloudflare Workers node_compat)
    process: "readonly"
};

export default [
    // 基础配置
    js.configs.recommended,

    // Vue 3 推荐配置
    ...vue.configs["flat/recommended"].map((config) => {
        if (config.files || !config.rules) {
            return config;
        }
        return {
            ...config,
            files: ["**/*.vue"]
        };
    }),

    // Tailwind CSS v4 配置 (ESLint 9 Flat Config format)
    {
        settings: {
            "better-tailwindcss": {
                entryPoint: "src/styles/main.css"
            }
        },
        plugins: {
            "better-tailwindcss": betterTailwindcss
        },
        rules: {
            "better-tailwindcss/sort-classes": "off",
            "better-tailwindcss/no-duplicate-classes": "off",
            "better-tailwindcss/enforce-shorthand-classes": "off"
        }
    },


    // Vue 特定规则
    {
        files: ["**/*.vue"],
        rules: {
            // 确保 v-for 有 :key
            "vue/require-v-for-key": "error",
            // 组件名多词
            "vue/multi-word-component-names": "off",
            // 禁止未使用的变量
            "vue/no-unused-vars": "warn",
            // 属性顺序
            "vue/attributes-order": "warn",
            // 允许 v-html（图床项目需要）
            "vue/no-v-html": "off"
        }
    },

    // JavaScript 规则（前端）
    {
        files: ["src/**/*.js", "src/**/*.vue"],
        languageOptions: {
            globals: {
                ...browserGlobals
            }
        },
        rules: {
            // 禁止未使用变量
            "no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }],
            "no-restricted-syntax": [
                "warn",
                {
                    selector: "Literal[value='material-symbols-outlined']",
                    message: "Use AppIcon instead of Material Symbols in production UI."
                },
                {
                    selector: "Literal[value='varinfo']",
                    message: "Use semantic tokens instead of pseudo token values."
                },
                {
                    selector: "Literal[value='varsuccess']",
                    message: "Use semantic tokens instead of pseudo token values."
                },
                {
                    selector: "Literal[value='vardanger']",
                    message: "Use semantic tokens instead of pseudo token values."
                },
                {
                    selector: "Literal[value='varwarning']",
                    message: "Use semantic tokens instead of pseudo token values."
                }
            ],
            // 禁止 console（生产代码）
            "no-console": ["warn", { allow: ["warn", "error"] }],
            // 禁止 debugger
            "no-debugger": "warn"
        }
    },

    {
        files: ["src/**/__tests__/**/*.js", "src/**/*.test.js", "src/**/*.spec.js"],
        languageOptions: {
            globals: {
                ...browserGlobals,
                ...nodeGlobals,
                ...testGlobals
            }
        }
    },

    {
        files: [
            "functions/**/__tests__/**/*.js",
            "functions/**/*.test.js",
            "functions/**/*.spec.js",
            "scripts/**/*.js",
            "scripts/**/*.mjs",
            "scripts/**/*.cjs",
            "test/**/*.js"
        ],
        languageOptions: {
            globals: {
                ...nodeGlobals,
                ...testGlobals,
                ...browserGlobals,
                ...workersGlobals
            }
        },
        rules: {
            "no-console": "off",
            "no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }],
            "no-constant-condition": ["error", { checkLoops: false }]
        }
    },

    // Cloudflare Workers 后端规则
    {
        files: ["functions/**/*.js"],
        languageOptions: {
            globals: workersGlobals
        },
        rules: {
            // 禁止未使用变量
            "no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }],
            // 允许 console（后端调试需要）
            "no-console": "off",
            // 禁止 debugger
            "no-debugger": "warn",
            // 禁用针对 JS 文件的 vue 误报规则
            "vue/one-component-per-file": "off",
            "vue/component-definition-name-casing": "off"
        }
    },

    // Prettier 兼容（禁用与 Prettier 冲突的规则）
    prettier,

    // 忽略模式
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "*.min.js",
            "public/**"
        ]
    }
];
