import { getAccessToken } from './auth';
import { fetchWithRateLimitRetry } from './fetchWithRateLimitRetry';
import type {
  Author,
  CreateAuthorPayload,
  UpdateAuthorPayload,
  ApiResponse,
  ValidationErrorItem,
} from '../types/author';
import { AuthorApiError } from '../types/author';

export { AuthorApiError };

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
        throw new AuthorApiError('Vui lòng đăng nhập để thực hiện thao tác này.', 401);
      }
      headers['Authorization'] = `Bearer ${token}`;
    } catch (cause) {
      if (cause instanceof AuthorApiError) throw cause;
      throw new AuthorApiError('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.', 401);
    }
  }

  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(`${base}/api/v1${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(15000) : undefined,
    });
  } catch (cause) {
    if (cause instanceof AuthorApiError) throw cause;
    throw new AuthorApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.', 0);
  }

  const result: ApiResponse<T> | null = await response.json().catch(() => null);

  if (!response.ok || result?.status !== 'success') {
    const fields: Record<string, string> = {};
    if (Array.isArray(result?.data)) {
      for (const item of result.data as ValidationErrorItem[]) {
        const fieldName = item.field || (Array.isArray(item.path) && item.path.length > 0 ? String(item.path[0]) : '');
        if (fieldName && typeof item.message === 'string') {
          fields[fieldName] = item.message;
        }
      }
    }

    let defaultMsg = 'Yêu cầu không thành công.';
    if (response.status === 401) defaultMsg = 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.';
    else if (response.status === 429) defaultMsg = 'Máy chủ đang giới hạn truy cập. Vui lòng thử lại sau ít phút.';
    else if (response.status === 403) defaultMsg = 'Bạn không có đủ quyền thực hiện thao tác này.';
    else if (response.status === 404) defaultMsg = 'Tác giả không tồn tại.';
    else if (response.status === 409) defaultMsg = 'Tác giả đã tồn tại.';
    else if (response.status === 400) defaultMsg = 'Dữ liệu gửi lên không hợp lệ.';

    throw new AuthorApiError(result?.message || defaultMsg, response.status, fields, result?.data);
  }

  return result.data;
}

/**
 * Lấy toàn bộ danh sách Tác giả
 */
export async function getAllAuthors(): Promise<Author[]> {
  return request<Author[]>('/author', {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Lấy thông tin chi tiết một Tác giả theo ID
 */
export async function getAuthorById(id: string): Promise<Author> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new AuthorApiError('Mã tác giả không hợp lệ.', 400);
  }
  return request<Author>(`/author/${encodeURIComponent(cleanId)}`, {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Tạo mới một Tác giả
 */
export async function createAuthor(payload: CreateAuthorPayload): Promise<Author> {
  return request<Author>('/author', {
    method: 'POST',
    body: payload,
    requireAuth: true,
  });
}

/**
 * Cập nhật thông tin Tác giả
 */
export async function updateAuthor(id: string, payload: UpdateAuthorPayload): Promise<Author> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new AuthorApiError('Mã tác giả không hợp lệ.', 400);
  }
  return request<Author>(`/author/${encodeURIComponent(cleanId)}`, {
    method: 'PUT',
    body: payload,
    requireAuth: true,
  });
}

/**
 * Xóa một Tác giả
 */
export async function deleteAuthor(id: string): Promise<Author> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new AuthorApiError('Mã tác giả không hợp lệ.', 400);
  }
  return request<Author>(`/author/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}

