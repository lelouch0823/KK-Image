function extractUserText(history = []) {
  return (history || [])
    .filter((message) => message?.role === 'user')
    .map((message) => {
      if (typeof message?.content === 'string') return message.content;
      if (Array.isArray(message?.content)) {
        return message.content.map((part) => String(part?.text || '')).join(' ');
      }
      return '';
    })
    .join(' ');
}

function countImages(history = []) {
  return (history || [])
    .filter((message) => Array.isArray(message?.content))
    .flatMap((message) => message.content)
    .filter((part) => part?.type === 'image_url').length;
}

function maxImageUrlLength(history = []) {
  return (history || [])
    .filter((message) => Array.isArray(message?.content))
    .flatMap((message) => message.content)
    .filter((part) => part?.type === 'image_url')
    .reduce((max, part) => Math.max(max, String(part?.image_url?.url || '').length), 0);
}

export function validateAIRequest({ history = [], limits = {}, userSignals = [] } = {}) {
  const text = extractUserText(history);
  const imageCount = countImages(history);
  const longestImage = maxImageUrlLength(history);

  if (
    text.length > Number(limits.maxInputLength || 10000) ||
    imageCount > Number(limits.maxImageCount || 10) ||
    longestImage > Number(limits.maxImageUrlLength || 5000000)
  ) {
    return {
      decision: 'block',
      reason: 'input_too_large',
      disableTools: false,
    };
  }

  if (Array.isArray(userSignals) && userSignals.length >= 3) {
    return {
      decision: 'degrade',
      reason: 'prompt_injection_risk',
      disableTools: true,
    };
  }

  return {
    decision: 'allow',
    reason: null,
    disableTools: false,
  };
}
