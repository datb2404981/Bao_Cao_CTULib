import { readonly, ref } from 'vue'

export interface AuthUser {
  accountId: string
  ctuIdentifier: string
  email?: string
  role: string
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
let timer: ReturnType<typeof setTimeout> | undefined
let pendingRefresh: Promise<void> | undefined
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

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
    const fields: Record<string, string> = {}
    if (Array.isArray(result?.data)) {
      for (const item of result.data) if (typeof item.field === 'string' && typeof item.message === 'string') fields[item.field] = item.message
    }
    throw new AuthError(result?.message || 'Yêu cầu không thành công. Vui lòng thử lại.', response.status, fields)
  }
  return result.data
}
function clearSession() {
  clearTimeout(timer)
  accessToken = ''
  expiresAt = 0
  user.value = null
}
function acceptSession(data: SessionData) {
  accessToken = data.token
  expiresAt = Date.now() + data.expiresIn * 1000
  if (data.user) user.value = data.user
  else {
    // Refresh không trả user: chỉ lấy thông tin hiển thị từ JWT, không dùng để cấp quyền.
    const payload = JSON.parse(atob(data.token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    user.value = { accountId: payload.accountId, ctuIdentifier: payload.ctuIdentifier, role: payload.role }
  }
  clearTimeout(timer)
  timer = setTimeout(() => { void refreshSession().catch(() => {}) }, Math.max(1000, data.expiresIn * 1000 - 60000))
}
export function refreshSession(): Promise<void> {
  if (!pendingRefresh) {
    pendingRefresh = request('refresh').then(acceptSession).catch((error: unknown) => {
      if (error instanceof AuthError && [401, 403].includes(error.status)) clearSession()
      else timer = setTimeout(() => { void refreshSession().catch(() => {}) }, 30000)
      throw error
    }).finally(() => { pendingRefresh = undefined })
  }
  return pendingRefresh
}
export async function authenticate(mode: 'login' | 'register', input: { ctuIdentifier: string; password: string; email?: string }) {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  acceptSession(await request(mode, input))
}
export async function logout() {
  if (pendingRefresh) await pendingRefresh.catch(() => {})
  await request('logout')
  clearSession()
}
export async function getAccessToken() {
  if (!accessToken || Date.now() >= expiresAt - 30000) await refreshSession()
  return accessToken
}
export const currentUser = readonly(user)
