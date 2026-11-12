const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 3000;

export const fetchWithRateLimitRetry = async (url: string, options: RequestInit): Promise<Response> => {
  const response = await fetch(url, options);
  if ((options.method ?? 'GET').toUpperCase() !== 'GET' || response.status !== 429) {
    return response;
  }

  const retryAfter = response.headers.get('Retry-After');
  const delayMs = retryAfter === null
    ? DEFAULT_RETRY_DELAY_MS
    : /^\d+$/.test(retryAfter.trim())
      ? Number(retryAfter) * 1000
      : Date.parse(retryAfter) - Date.now();

  if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > MAX_RETRY_DELAY_MS) {
    return response;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  return fetch(url, options);
};
