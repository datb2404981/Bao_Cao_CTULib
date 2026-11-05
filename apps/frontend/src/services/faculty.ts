import { getAccessToken } from './auth';
import type {
  Faculty,
  CreateFacultyPayload,
  UpdateFacultyPayload,
  ApiResponse,
  ValidationErrorItem,
} from '../types/faculty';
import { FacultyApiError } from '../types/faculty';

export { FacultyApiError };

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
        throw new FacultyApiError('Vui lòng đăng nhập để thực hiện thao tác này.', 401);
      }
      headers['Authorization'] = `Bearer ${token}`;
    } catch (cause) {
      if (cause instanceof FacultyApiError) throw cause;
      throw new FacultyApiError('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.', 401);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${base}${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(15000) : undefined,
    });
  } catch (cause) {
    if (cause instanceof FacultyApiError) throw cause;
    throw new FacultyApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.', 0);
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
    else if (response.status === 403) defaultMsg = 'Bạn không có đủ quyền thực hiện thao tác này.';
    else if (response.status === 404) defaultMsg = 'Khoa/Viện không tồn tại.';
    else if (response.status === 409) defaultMsg = 'Khoa đã tồn tại.';
    else if (response.status === 400) defaultMsg = 'Dữ liệu gửi lên không hợp lệ.';

    throw new FacultyApiError(result?.message || defaultMsg, response.status, fields, result?.data);
  }

  return result.data;
}

/**
 * Lấy toàn bộ danh sách Khoa/Viện
 */
export async function getAllFaculties(): Promise<Faculty[]> {
  return request<Faculty[]>('/faculty', {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Lấy thông tin chi tiết một Khoa/Viện theo ID
 */
export async function getFacultyById(id: string): Promise<Faculty> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new FacultyApiError('Mã khoa không hợp lệ.', 400);
  }
  return request<Faculty>(`/faculty/${encodeURIComponent(cleanId)}`, {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Tạo mới một Khoa/Viện
 */
export async function createFaculty(payload: CreateFacultyPayload): Promise<Faculty> {
  return request<Faculty>('/faculty', {
    method: 'POST',
    body: payload,
    requireAuth: true,
  });
}

/**
 * Cập nhật thông tin Khoa/Viện
 */
export async function updateFaculty(id: string, payload: UpdateFacultyPayload): Promise<Faculty> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new FacultyApiError('Mã khoa không hợp lệ.', 400);
  }
  return request<Faculty>(`/faculty/${encodeURIComponent(cleanId)}`, {
    method: 'PUT',
    body: payload,
    requireAuth: true,
  });
}

/**
 * Xóa một Khoa/Viện
 */
export async function deleteFaculty(id: string): Promise<Faculty> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new FacultyApiError('Mã khoa không hợp lệ.', 400);
  }
  return request<Faculty>(`/faculty/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}

