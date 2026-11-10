import { AuthError, getAccessToken } from './auth'

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const request = async <T>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown): Promise<T> => {
  const token = await getAccessToken()
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method, credentials: 'include', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch { throw new AuthError('Không thể kết nối máy chủ. Vui lòng thử lại.', 0) }
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.status !== 'success') {
    const fields: Record<string, string> = {}
    const issues: unknown = result?.errors ?? result?.data
    if (Array.isArray(issues)) {
      for (const item of issues) {
        if (typeof item?.field === 'string' && typeof item?.message === 'string') fields[item.field] = item.message
      }
    }
    throw new AuthError(result?.message || 'Yêu cầu không thành công.', response.status, fields)
  }
  return result.data as T
}
