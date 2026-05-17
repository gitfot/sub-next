function extractRetrySeconds(message: string) {
  const match = /retry in (\d+) seconds/i.exec(message);
  return match ? Number.parseInt(match[1] ?? '', 10) : null;
}

export async function getResponseErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  let message = fallbackMessage;

  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.json() as { message?: unknown };
      if (typeof payload.message === 'string' && payload.message.trim()) {
        message = payload.message;
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        message = text;
      }
    }
  } catch {
    return fallbackMessage;
  }

  if (response.status === 429) {
    const retrySeconds = extractRetrySeconds(message);
    if (retrySeconds !== null) {
      return `请求过于频繁，请 ${retrySeconds} 秒后再试`;
    }
    return '请求过于频繁，请稍后再试';
  }

  return message;
}
