import { getAccessToken } from './auth';
import type {
  Book,
  CreateBookPayload,
  BookQueryParams,
  PaginatedBooksResult,
  ApiResponse,
  ValidationErrorItem,
} from '../types/book';
import { BookApiError } from '../types/book';

export { BookApiError };

const base = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  requireAuth?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, requireAuth = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (requireAuth) {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new BookApiError('Vui lòng đăng nhập để thực hiện thao tác này.', 401);
      }
      headers['Authorization'] = `Bearer ${token}`;
    } catch (cause) {
      if (cause instanceof BookApiError) throw cause;
      throw new BookApiError('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.', 401);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${base}${endpoint}`, {
      method,
      headers,
      body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(15000) : undefined,
    });
  } catch (cause) {
    if (cause instanceof BookApiError) throw cause;
    throw new BookApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.', 0);
  }

  const result: ApiResponse<T> | null = await response.json().catch(() => null);

  if (!response.ok || result?.status !== 'success') {
    const fields: Record<string, string> = {};
    if (Array.isArray(result?.data)) {
      for (const item of result.data as ValidationErrorItem[]) {
        if (typeof item.field === 'string' && typeof item.message === 'string') {
          fields[item.field] = item.message;
        }
      }
    }

    let defaultMsg = 'Yêu cầu không thành công.';
    if (response.status === 401) defaultMsg = 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.';
    else if (response.status === 403) defaultMsg = 'Bạn không có đủ quyền thực hiện thao tác này.';
    else if (response.status === 404) defaultMsg = 'Không tìm thấy ấn phẩm yêu cầu.';
    else if (response.status === 400) defaultMsg = 'Dữ liệu gửi lên không hợp lệ.';

    throw new BookApiError(result?.message || defaultMsg, response.status, fields, result?.data);
  }

  return result.data;
}

export async function getAllBooks(params?: BookQueryParams): Promise<PaginatedBooksResult> {
  const query = new URLSearchParams();

  if (params?.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params?.limit !== undefined) {
    query.set('limit', String(params.limit));
  }
  if (params?.search !== undefined && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params?.facultyId !== undefined && params.facultyId.trim()) {
    query.set('facultyId', params.facultyId.trim());
  }

  const queryString = query.toString();
  const endpoint = `/book${queryString ? `?${queryString}` : ''}`;
  return request<PaginatedBooksResult>(endpoint, { method: 'GET', requireAuth: false });
}

export async function getBookById(bookId: string): Promise<Book> {
  const cleanId = (bookId || '').trim();
  if (!cleanId) {
    throw new BookApiError('Mã sách không hợp lệ.', 400);
  }
  const endpoint = `/book/${encodeURIComponent(cleanId)}`;
  return request<Book>(endpoint, { method: 'GET', requireAuth: true });
}

export async function createBook(payload: CreateBookPayload): Promise<Book> {
  return request<Book>('/book', {
    method: 'POST',
    body: payload,
    requireAuth: true,
  });
}
