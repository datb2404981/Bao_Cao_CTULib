import { getAccessToken } from './auth';
import { fetchWithRateLimitRetry } from './fetchWithRateLimitRetry';
import type {
  Publisher,
  CreatePublisherPayload,
  UpdatePublisherPayload,
  ApiResponse,
  ValidationErrorItem,
} from '../types/publisher';
import { PublisherApiError } from '../types/publisher';

export { PublisherApiError };

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
        throw new PublisherApiError('Vui lòng đăng nhập để thực hiện thao tác này.', 401);
      }
      headers['Authorization'] = `Bearer ${token}`;
    } catch (cause) {
      if (cause instanceof PublisherApiError) throw cause;
      throw new PublisherApiError('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.', 401);
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
    if (cause instanceof PublisherApiError) throw cause;
    throw new PublisherApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.', 0);
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
    else if (response.status === 404) defaultMsg = 'Nhà xuất bản không tồn tại.';
    else if (response.status === 409) defaultMsg = 'Nhà xuất bản đã tồn tại.';
    else if (response.status === 400) defaultMsg = 'Dữ liệu gửi lên không hợp lệ.';

    throw new PublisherApiError(result?.message || defaultMsg, response.status, fields, result?.data);
  }

  return result.data;
}

/**
 * Lấy toàn bộ danh sách Nhà xuất bản
 */
export async function getAllPublishers(): Promise<Publisher[]> {
  return request<Publisher[]>('/publisher', {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Lấy thông tin chi tiết một Nhà xuất bản theo ID
 */
export async function getPublisherById(id: string): Promise<Publisher> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new PublisherApiError('Mã nhà xuất bản không hợp lệ.', 400);
  }
  return request<Publisher>(`/publisher/${encodeURIComponent(cleanId)}`, {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Tạo mới một Nhà xuất bản
 */
export async function createPublisher(payload: CreatePublisherPayload): Promise<Publisher> {
  return request<Publisher>('/publisher', {
    method: 'POST',
    body: payload,
    requireAuth: true,
  });
}

/**
 * Cập nhật thông tin Nhà xuất bản
 */
export async function updatePublisher(id: string, payload: UpdatePublisherPayload): Promise<Publisher> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new PublisherApiError('Mã nhà xuất bản không hợp lệ.', 400);
  }
  return request<Publisher>(`/publisher/${encodeURIComponent(cleanId)}`, {
    method: 'PUT',
    body: payload,
    requireAuth: true,
  });
}

/**
 * Xóa một Nhà xuất bản
 */
export async function deletePublisher(id: string): Promise<Publisher> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new PublisherApiError('Mã nhà xuất bản không hợp lệ.', 400);
  }
  return request<Publisher>(`/publisher/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}
