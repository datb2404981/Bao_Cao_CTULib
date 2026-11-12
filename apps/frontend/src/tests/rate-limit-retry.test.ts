import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllBooks } from '../services/book';
import { getAllAuthors } from '../services/author';
import { getAllFaculties } from '../services/faculty';
import { fetchWithRateLimitRetry } from '../services/fetchWithRateLimitRetry';

vi.mock('@/services/auth', () => ({ getAccessToken: vi.fn().mockResolvedValue(null) }));

const rateLimitResponse = (headers: HeadersInit = {}): Response =>
  new Response('<html>Just a moment...</html>', {
    status: 429,
    headers: { 'Content-Type': 'text/html', ...headers },
  });

describe('Phục hồi khi Cloudflare giới hạn truy cập API', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('Tự thử lại một lần khi GET /book nhận 429 HTML rồi trả dữ liệu', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 } },
      }), { status: 200 }));

    const pending = getAllBooks();
    await vi.advanceTimersByTimeAsync(1000);
    const data = await pending;

    expect(data.items).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/v1/book');
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe('/api/v1/book');
  });

  it('Báo đúng nguyên nhân nếu cả hai lần GET /book đều bị 429 HTML', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(rateLimitResponse()).mockResolvedValueOnce(rateLimitResponse());

    const pending = expect(getAllBooks()).rejects.toMatchObject({
      status: 429,
      message: 'Máy chủ đang giới hạn truy cập. Vui lòng thử lại sau ít phút.',
    });
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Tôn trọng Retry-After dài, không gửi thêm request lên máy chủ', async () => {
    vi.mocked(fetch).mockResolvedValue(rateLimitResponse({ 'Retry-After': '60' }));

    await expect(getAllAuthors()).rejects.toMatchObject({ status: 429 });
    await expect(getAllFaculties()).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Không thử lại thao tác ghi POST khi nhận 429', async () => {
    vi.mocked(fetch).mockResolvedValue(rateLimitResponse());

    const response = await fetchWithRateLimitRetry('/api/v1/book', { method: 'POST', body: '{}' });
    expect(response.status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
