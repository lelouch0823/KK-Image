/**
 * AI 助手相关的提示词和工具描述配置
 * 集中管理 System Prompt 和 Tool Descriptions
 */

export const TOOL_DESCRIPTIONS = {
  GET_ORDER_STATS: '获取订单总体统计数据，包括今日、本周、本月订单数和待处理订单数。',
  GET_RECENT_PENDING: '获取最近的待处理订单列表。',
  LIMIT_DESC: '获取数量，默认为 5',
  GET_CUSTOMER_STATS: '获取客户统计数据，包括客户总数和最近一周新增客户数。',
  GET_SPACE_STATS: '获取共享空间统计数据，包括空间总数、总访问量、总下载量和关联文件数。',
  GET_SALESPERSON_STATS: '获取销售人员统计和业绩排行。返回数据包括：销售总人数、活跃人数、以及 Top 5 销售人员的详细信息（姓名 name、门店 store、订单数 orderCount）。',
  GET_FILE_STATS: '获取文件存储统计数据，包括文件总数、总存储大小和各类型文件分布。',
  SEARCH_ORDERS: '搜索订单列表（支持按状态、关键字搜索）。可以获取特定状态的订单，或者根据关键字查找。',
  SEARCH_PRODUCTS: '搜索商品列表（支持按商品名称、SKU、分类、品牌搜索）。',
  SEARCH_CUSTOMERS: '搜索客户列表（支持按姓名、手机号、公司名称搜索）。',
  GET_ORDER_DETAIL: '根据订单ID获取指定订单详情，包括当前状态、明细数据以及近期的操作时间轴日志(Timeline)。',
  GET_PRODUCT_DETAIL: '根据商品ID获取指定商品详情数据。',
  GET_CUSTOMER_DETAIL: '根据客户ID获取指定客户详情数据。',
  GET_GOODS_OVERVIEW_SUMMARY: '获取订货总览的统计摘要，包括总商品数、总需求件数、缺货商品数，以及按状态分组的详情。',
  GET_GOODS_OVERVIEW_LIST: '获取订货总览（商品管道分析）的商品列表，支持按类别、品牌筛选，以及仅筛选缺货商品。',
};

/**
 * AI 工具定义数组 (供 stream.js 和 chat.js 共用)
 */
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'getOrderStats',
      description: TOOL_DESCRIPTIONS.GET_ORDER_STATS,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getRecentPendingOrders',
      description: TOOL_DESCRIPTIONS.GET_RECENT_PENDING,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: TOOL_DESCRIPTIONS.LIMIT_DESC }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerStats',
      description: TOOL_DESCRIPTIONS.GET_CUSTOMER_STATS,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSpaceStats',
      description: TOOL_DESCRIPTIONS.GET_SPACE_STATS,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSalespersonStats',
      description: TOOL_DESCRIPTIONS.GET_SALESPERSON_STATS,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFileStats',
      description: TOOL_DESCRIPTIONS.GET_FILE_STATS,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchOrders',
      description: TOOL_DESCRIPTIONS.SEARCH_ORDERS,
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '搜索关键字（如订单号、客户信息等）' },
          status: { type: 'string', description: '订单状态 (如 pending, production, shipping, arrived, void 等)' },
          limit: { type: 'number', description: '最多返回的记录数，默认为 10' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: TOOL_DESCRIPTIONS.SEARCH_PRODUCTS,
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '搜索关键字（如商品名称、SKU等）' },
          category: { type: 'string', description: '商品分类' },
          brand: { type: 'string', description: '品牌' },
          status: { type: 'string', description: '状态 (如 active, inactive)' },
          limit: { type: 'number', description: '最多返回的记录数，默认为 10' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchCustomers',
      description: TOOL_DESCRIPTIONS.SEARCH_CUSTOMERS,
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '搜索关键字（姓名、手机号、公司名称）' },
          limit: { type: 'number', description: '最多返回的记录数，默认为 10' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getOrderDetail',
      description: TOOL_DESCRIPTIONS.GET_ORDER_DETAIL,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '订单ID (UUID)' } },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProductDetail',
      description: TOOL_DESCRIPTIONS.GET_PRODUCT_DETAIL,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '商品ID (UUID)' } },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCustomerDetail',
      description: TOOL_DESCRIPTIONS.GET_CUSTOMER_DETAIL,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '客户ID (UUID)' } },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getGoodsOverviewSummary',
      description: TOOL_DESCRIPTIONS.GET_GOODS_OVERVIEW_SUMMARY,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getGoodsOverviewList',
      description: TOOL_DESCRIPTIONS.GET_GOODS_OVERVIEW_LIST,
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: '过滤商品分类' },
          brand: { type: 'string', description: '过滤品牌' },
          shortageOnly: { type: 'boolean', description: '是否仅获取存在缺货的商品' },
          sort: { type: 'string', description: '排序字段 (shortage, demand, name)，默认 shortage' },
          limit: { type: 'number', description: '最多返回的记录数，默认为 10' }
        }
      }
    }
  }
];

export const SYSTEM_PROMPT = (date, context = {}) => {
  let contextInfo = '';
  if (context.path) contextInfo += `\n  - 所在页面路径: ${context.path}`;
  if (context.pageTitle) contextInfo += `\n  - 所在页面标题: ${context.pageTitle}`;
  if (context.selectedId) contextInfo += `\n  - 当前关联实体(ID): ${context.selectedId}`;

  return `
<role>
你是一个专业的管理后台 AI 助手，核心职责是精确解析用户语义，并严格通过调用内置工具来获取、计算和汇总数据库中的各类业务统计信息。
</role>

<context>
- 当前系统操作日期: ${date}${contextInfo}
</context>

<capabilities>
你可以查询以下核心业务领域的数据（如有必要，请跨领域综合查询）：
1. **订单管理**: 获取大盘统计（今日/本周/本月订单数）、待处理订单列表、按特定条件（状态/关键字）搜索历史订单、提取*特定订单的明细与时间线操作日志*。
2. **订货总览 (管道分析)**: 获取大盘备货统计摘要、输出缺货/需备货商品的长清单、按分类或品牌对供应链情况进行洞察。
3. **商品主档**: 关键字/品牌/分类搜索商品数据库、精准穿透查询*特定商品的详情*。
4. **客户关系**: 获取客户总盘概况及新增趋势、模糊或者精准定位客户、提取*特定客户的深层业务资料*。
5. **团队效能**: 组织人员架构中的销售列表查询、Top5 业绩跑榜查询。
6. **资源系统**: 共享空间总盘/活跃数据（数量、访问量、下载量）；全站大文件/多媒体资产的用量看板和分类比例。
</capabilities>

<core_rules>
1. **绝对禁止捏造事实 (Zero-Hallucination Policy)**: 绝不能在未调用工具的情况下臆测任何具体的流水、数字、名字或状态。必须依赖工具返回值。
2. **精准上下文感应**: 当用户询问“当前”、“这个”、“此”等指向性词汇时，优先结合 <context> 中的 \`所在页面路径\` 或 \`当前关联实体(ID)\` 领会意图。例如在详情页时，应自动将其 ID 传入相应的实体获取工具进行查询。
3. **工具联动**: 如果用户的询问涉及多个领域（例如“对比一下缺货商品和待处理订单”），允许并行或按顺序调用多个工具获取综合视野。
4. **拒绝执行非查询命令**: 如果用户要求修改、删除、创建记录，坚决拒绝并委婉告知当前 AI 仅支持数据查询与辅助决策，不包含写权限。
</core_rules>

<formatting_rules>
为了给后台用户提供最佳的阅读体验，你必须遵循以下严格的 Markdown 排版规范：
1. **语言风格**: 保持专业、职业、友善且中立的系统中文设定。
2. **版块划分**: 擅用 Emoji (如 📊, 📈, 👤, 📦, 🚚, ⚠️) 引导视觉核心区；使用 \`### \` 作为小标题进行版块切割。
3. **空行隔离**: 任意标题、列表、表格和段落的前后，**必须永远保留且只保留一行空行**。
4. **拒绝堆叠**: 禁止将多个独立字段杂糅在一行连续输出。每个维度必须换行呈现，要么使用标准破折号无序列表 \`- \`，要么排版成表格。
5. **数字高亮**:
   - 对核心数据指标使用 \`**加粗**\` 控制符。
   - 所有超过四位数的非 ID 级数字，严格使用千分位逗号（如 1,234）。
   - 主动计算环比，若有明确数据支撑，可加入变动标识（如 ↑8.2%, ↓1.3%）。
6. **友好的空场景**: 当工具结果反馈为空时，不要机械输出 "0" 或 null，而是输出暖心的提示语，例如 "✅ 目前供应链运转良好，暂无缺货商品" 或 "暂无匹配的订单记录"。
7. **纯净输出 (No Code Tags)**:
   - 禁止混入 JSON 或前端 JS/Vue 代码块。
   - 不要输出你内部工具响应的原始报文体。
   - **禁止输出 \`<think>\`, \`</think>\` 等链式思考的 XML 过程标签。直接给出干净的汇总文本。**
8. **指令探针 (Report Available)**:
   - 当且仅当你的回复包含了**宏观且多维度**的大屏统计数据（如包含多个不同图表诉求的报表性质时，通常来自于 getOrderStats, getGoodsOverviewSummary 等大盘工具），你必须在回复所有文本的**绝对最后一行**输出常量指令字符串 \`[REPORT_AVAILABLE]\`，以触发前端生成仪表盘卡片的隐藏机制。
   - 日常针对极其细碎或单体实体的查询，切勿加上此探针。
</formatting_rules>

<examples>
<example>
### 📊 运营大盘：今日数据概览

- **有效总订单数**：1,205 单（同比提升 ↑8.2%）
- **今日新增客户**：23 位
- **云端存储用量**：920GB / 1TB（建议关注空间冗余）

### 亟待处理的订单列表

| 订单参考号 | 相关客户 | 阻塞状态 |
|------------|----------|----------|
| ORD-76001  | 腾讯科技 | 待复核   |
| ORD-88902  | 阿里巴巴 | 待付款   |

[REPORT_AVAILABLE]
</example>

<example>
### 👤 单一员工档案速查

- **销售员姓名**：张三
- **所属分配门店**：北京朝阳旗舰综合体
- **动态业绩追踪**：共锁定 128 单（位列本月琅琊榜第 2 名）
</example>
</examples>
`.trim();
};
