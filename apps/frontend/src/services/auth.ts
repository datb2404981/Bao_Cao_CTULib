import { readonly, ref } from 'vue'
import { fetchWithRateLimitRetry } from './fetchWithRateLimitRetry'

export interface AuthUser {
  accountId: string
  ctuIdentifier: string
  email?: string
  role: string
  permissions?: readonly string[]
}
interface SessionData { token: string; expiresIn: number; user?: AuthUser }
export class AuthError extends Error {
  status: number
  fields: Record<string, string>
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}
const user = ref<AuthUser | null>(null)
let accessToken = ''
let expiresAt = 0
let lastAuthorizedAt = 0
let timer: ReturnType<typeof setTimeout> | undefined
let sessionVersion = 0
let authorizationVersion = 0
let pendingRefresh: Promise<void> | undefined
const AUTHORIZATION_CACHE_MS = 60_000
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// Các tab/khung cùng origin dùng chung cookie HttpOnly nhưng có bộ nhớ riêng.
// Khóa cả request và nhận phiên để không gửi lại refresh token vừa được xoay.
const withSessionLock = async <T>(action: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`ctulib-auth:${base}`, action)
  }
  return action()
}

async function request(endpoint: string, body: object = {}): Promise<SessionData> {
  let response: Response
  try {
    response = await fetch(`${base}/api/v1/auth/${endpoint}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new AuthError('Không thể kết nối máy chủ. Vui lòng thử lại.', 0)
  }
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.status !== 'success') {
    if (response.status === 429) throw new AuthError('Máy chủ đang giới hạn truy cập. Vui lòng thử lại sau ít phút.', 429)
    if (result?.status !== 'error' || typeof result.message !== 'string') {
      throw new AuthError('Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại.', 502)
    }
    const fields: Record<string, string> = {}
    if (Array.isArray(result?.data)) {
      for (const item of result.data) if (typeof item.field === 'string' && typeof item.message === 'string') fields[item.field] = item.message
    }
    throw new AuthError(result?.message || 'Yêu cầu không thành công. Vui lòng thử lại.', response.status, fields)
  }
  return result.data
}
function clearSession() {
  sessionVersion++
  authorizationVersion++
  clearTimeout(timer)
  accessToken = ''
  expiresAt = 0
  lastAuthorizedAt = 0
  user.value = null
}
export async function refreshAuthorization(force = true): Promise<void> {
  if (!accessToken || Date.now() >= expiresAt) { await refreshSession(); return }
  if (!force && user.value && Date.now() - lastAuthorizedAt < AUTHORIZATION_CACHE_MS) return
  const version = sessionVersion
  const check = ++authorizationVersion
  const token = accessToken
  let response: Response
  try {
    response = await fetchWithRateLimitRetry(`${base}/api/v1/auth/me`, {
      credentials: 'include', headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
  } catch { throw new AuthError('Không thể kiểm tra quyền truy cập. Vui lòng thử lại.', 0) }
  const result = await response.json().catch(() => null)
  if (version !== sessionVersion || check !== authorizationVersion) return
  if (!response.ok || result?.status !== 'success') {
    if (response.status === 429) throw new AuthError('Máy chủ đang giới hạn truy cập. Vui lòng thử lại sau ít phút.', 429)
    if (result?.status !== 'error' || typeof result.message !== 'string') {
      throw new AuthError('Không thể kiểm tra quyền truy cập do phản hồi máy chủ không hợp lệ.', 502)
    }
    if ([401, 403].includes(response.status)) clearSession()
    throw new AuthError(result?.message || 'Không thể kiểm tra quyền truy cập.', response.status)
  }
  const data = result.data
  if (!data || typeof data.accountId !== 'string' || typeof data.ctuIdentifier !== 'string'
    || !['READER', 'EMPLOYEE', 'ADMIN'].includes(data.role)
    || !Array.isArray(data.permissions) || !data.permissions.every((value: unknown) => typeof value === 'string')) {
    throw new AuthError('Thông tin quyền truy cập không hợp lệ.', 502)
  }
  user.value = data as AuthUser
  lastAuthorizedAt = Date.now()
}
async function acceptSession(data: SessionData) {
  sessionVersion++
  accessToken = data.token
  expiresAt = Date.now() + data.expiresIn * 1000
  await refreshAuthorization(true)
  clearTimeout(timer)
  timer = setTimeout(() => { void refreshSession().catch(() => {}) }, Math.max(1000, data.expiresIn * 1000 - 60000))
}
export function refreshSession(): Promise<void> {
  if (!pendingRefresh) {
    pendingRefresh = withSessionLock(async () => {
      await acceptSession(await request('refresh'))
    }).catch((error: unknown) => {
      if (error instanceof AuthError && [401, 403].includes(error.status)) clearSession()
      else timer = setTimeout(() => { void refreshSession().catch(() => {}) }, 30000)
      throw error
    }).finally(() => { pendingRefresh = undefined })
  }
  return pendingRefresh
}
export async function authenticate(mode: 'login' | 'register', input: { ctuIdentifier: string; password: string; email?: string }) {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  await withSessionLock(async () => {
    const data = await request(mode, input)
    clearSession()
    await acceptSession(data)
  })
}
export async function logout() {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  await withSessionLock(async () => {
    await request('logout')
    clearSession()
  })
}
export async function getAccessToken() {
  if (!accessToken || Date.now() >= expiresAt - 30000) await refreshSession()
  return accessToken
}
export const currentUser = readonly(user)
