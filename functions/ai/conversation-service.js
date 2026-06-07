const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?(system|developer)\s+instructions?/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /show\s+(me\s+)?(your\s+)?(hidden|internal)\s+(prompt|rules?)/i,
  /developer\s+message/i,
  /print\s+(all\s+)?environment\s+variables?/i,
  /api[_\s-]?key|secret|token/i,
  /越狱|忽略(以上|之前|先前)指令|泄露(系统|提示词|密钥)/i,
];

function summarizeImageUrl(url = '') {
  const value = String(url || '');
  const isDataUrl = value.startsWith('data:');
  const isHttpUrl = /^https?:\/\//i.test(value);
  let mime = '';
  if (isDataUrl) {
    const match = value.match(/^data:([^;,]+)/i);
    mime = match?.[1] || '';
  }
  return {
    isDataUrl,
    isHttpUrl,
    mime: mime || null,
    length: value.length || 0,
  };
}

function summarizeUserInputModalities(history = []) {
  const summary = {
    userMessageCount: 0,
    textParts: 0,
    imageParts: 0,
    dataUrlImages: 0,
    httpUrlImages: 0,
    imageMimes: [],
    maxImageUrlLength: 0,
  };
  const mimeSet = new Set();

  const visitContent = (content) => {
    if (typeof content === 'string') {
      if (content.trim()) summary.textParts += 1;
      return;
    }
    if (Array.isArray(content)) {
      content.forEach(visitContent);
      return;
    }
    if (!content || typeof content !== 'object') return;

    if (content.type === 'text' && typeof content.text === 'string' && content.text.trim()) {
      summary.textParts += 1;
      return;
    }

    if (content.type === 'image_url' && typeof content.image_url?.url === 'string') {
      summary.imageParts += 1;
      const imageInfo = summarizeImageUrl(content.image_url.url);
      if (imageInfo.isDataUrl) summary.dataUrlImages += 1;
      if (imageInfo.isHttpUrl) summary.httpUrlImages += 1;
      if (imageInfo.mime) mimeSet.add(imageInfo.mime);
      summary.maxImageUrlLength = Math.max(summary.maxImageUrlLength, imageInfo.length);
      return;
    }

    if (typeof content.text === 'string' && content.text.trim()) {
      summary.textParts += 1;
    }
  };

  if (Array.isArray(history)) {
    history
      .filter((msg) => msg?.role === 'user')
      .forEach((msg) => {
        summary.userMessageCount += 1;
        visitContent(msg.content);
      });
  }

  summary.imageMimes = Array.from(mimeSet);
  return summary;
}

export function detectInjectionSignals(rawText = '') {
  const text = String(rawText || '');
  if (!text.trim()) return [];
  return INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) =>
    pattern.toString()
  );
}

function hasImagePart(content) {
  if (Array.isArray(content)) {
    return content.some(
      (part) => part?.type === 'image_url' && typeof part.image_url?.url === 'string'
    );
  }
  if (content && typeof content === 'object') {
    return content.type === 'image_url' && typeof content.image_url?.url === 'string';
  }
  return false;
}

function hasImageInLatestUserTurn(history = []) {
  if (!Array.isArray(history) || history.length === 0) return false;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role !== 'user') continue;
    return hasImagePart(msg.content);
  }
  return false;
}

function buildSystemContent(basePrompt, { visionFirst = false } = {}) {
  if (!visionFirst) return basePrompt;
  return `${basePrompt}

<vision_first_mode>
图像优先：本轮用户输入包含图片，你必须优先基于图片内容回答，不要优先转成 SKU/ID 检索问答。
若当前模型无法识别图片，请以以下前缀开头回复：
[IMAGE_UNSUPPORTED] 当前模型无法识别图片，请移除图片或切换模型。
</vision_first_mode>`.trim();
}

function extractUserTextForDetection(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  if (content && typeof content === 'object') {
    if (content.type === 'text' && typeof content.text === 'string') {
      return content.text;
    }
    if (typeof content.text === 'string') {
      return content.text;
    }
  }
  return '';
}

function extractLatestUserText(history = []) {
  if (!Array.isArray(history) || history.length === 0) return '';
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role !== 'user') continue;
    return extractUserTextForDetection(msg.content);
  }
  return '';
}

export async function prepareConversationRequest({
  history = [],
  channel = 'chat',
  basePrompt = '',
} = {}) {
  const visionFirst = hasImageInLatestUserTurn(history);
  const inputSummary = summarizeUserInputModalities(history);
  const userSignals = Array.isArray(history)
    ? history
        .filter((msg) => msg?.role === 'user')
        .flatMap((msg) => detectInjectionSignals(extractUserTextForDetection(msg.content)))
    : [];
  const latestUserText = extractLatestUserText(history);

  return {
    visionFirst,
    latestUserText,
    messages: [
      { role: 'system', content: buildSystemContent(basePrompt, { visionFirst }) },
      ...history,
    ],
    telemetry: {
      channel,
      inputSummary,
      userSignals,
    },
  };
}
