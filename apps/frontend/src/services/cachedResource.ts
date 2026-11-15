/**
 * Bộ đệm ngắn hạn trong bộ nhớ và gộp các request đồng thời cho danh mục ít thay đổi.
 */
export const createCachedResource = <T>(fetcher: () => Promise<T>, ttlMs = 60_000) => {
  let cachedValue: T | null = null;
  let cachedAt = 0;
  let inFlight: Promise<T> | null = null;

  const get = async (): Promise<T> => {
    if (cachedValue !== null && Date.now() - cachedAt < ttlMs) {
      return cachedValue;
    }
    if (inFlight) {
      return inFlight;
    }
    inFlight = fetcher()
      .then((value) => {
        cachedValue = value;
        cachedAt = Date.now();
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const invalidate = (): void => {
    cachedValue = null;
    cachedAt = 0;
  };

  return { get, invalidate };
};
