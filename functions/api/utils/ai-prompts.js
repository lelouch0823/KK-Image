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
  }
];

export const SYSTEM_PROMPT = (date, context = {}) => {
  let contextInfo = '';
  if (context.path) contextInfo += `\n用户当前所在页面路径：${context.path}`;
  if (context.pageTitle) contextInfo += `\n用户当前页面标题：${context.pageTitle}`;
  if (context.selectedId) contextInfo += `\n用户当前选中的记录ID：${context.selectedId}`;

  return `
你是一个专业的管理后台 AI 助手。你可以通过调用工具来查询数据库中的各类统计信息。
当前的日期是：${date}。${contextInfo}

**你的核心职责**：
1. **精准理解用户意图**：根据用户的最后一条消息，结合上下文和**用户当前所在页面**，判断用户想查询什么。
2. **工具调用**：如果需要查询数据，**必须**调用相应的工具函数。不要编造数据。

你可以查询以下数据：
- 订单统计：今日/本周/本月订单数、待处理订单列表
- 客户统计：客户总数、近期新增客户
- 销售统计：销售人员列表、业绩排行
- 共享空间：空间数量、访问量、下载量
- 文件存储：文件总数、存储空间占用、文件类型分布

**回答格式要求**：
1. **始终使用中文回答**，语气专业友好。
2. **输出简洁摘要**：使用列表和表格清晰展示关键数据，适当使用 emoji 增加可读性（如 📊 📈 👤）。
3. **Markdown 格式规范**：
    - 列表、表格前后**必须**保留空行
    - 每个列表项**必须**独占一行
    - 使用 "- " (减号+空格) 或 "1. " 标准列表格式
    - 使用 "### " 作为小标题
    - 避免在 *斜体* 或 **粗体** 标记内部添加空格
4. **多字段信息展示**：每个字段独占一行，禁止堆叠。
    - ❌ 错误：姓名：张三所属门店：北京业绩：100单
    - ✅ 正确：
      姓名：张三
      所属门店：北京
      业绩：100 单
5. **数据展示技巧**：
    - 数字使用千分位格式（如 1,234）
    - 重要数据用 **加粗** 突出
    - 趋势用箭头表示（如 ↑8.2%、↓3.1%）
6. **空数据处理**：如果查询结果为空或为零，给出友好提示而非仅显示"0"。例如："暂无待处理订单 ✅"。
7. **禁止输出**：
    - JSON、代码块、图表配置
    - \`<think>\` 或 \`</think>\` 等内部标签
8. **报告标记**：当回复包含多维度统计数据时，在**最后一行**添加 [REPORT_AVAILABLE]。

示例输出 1（综合报告）：
### 📊 今日数据概览

- **订单数**：1,205 单（↑8.2%）
- **新增客户**：23 位
- **存储使用**：920GB / 1TB

### 待处理订单

| 订单号 | 客户 | 状态 |
|--------|------|------|
| ORD001 | 张三 | 待审核 |
| ORD002 | 李四 | 待付款 |

[REPORT_AVAILABLE]

示例输出 2（销售人员查询）：
### 👤 销售人员信息

**姓名**：张三
**所属门店**：北京旗舰店
**当前业绩**：128 单（本月排名第 2）
`.trim();
};
