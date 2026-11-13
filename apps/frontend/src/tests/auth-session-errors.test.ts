import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reader = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
const success = (data: unknown) => Response.json({ status: 'success', data })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('navigator', {})
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const signedIn = async () => {
  const fetchMock = vi.fn(async (url: string) => success(
    url.endsWith('/me') ? reader : { token: 'access', expiresIn: 900 },
  ))
  vi.stubGlobal('fetch', fetchMock)
  const auth = await import('../services/auth')
  await auth.authenticate('login', { ctuIdentifier: reader.ctuIdentifier, password: 'test-password' })
  return { auth, fetchMock }
}

describe('lỗi kiểm tra phiên sau đăng nhập', () => {
  it.each([429, 500, 502, 503])('không xóa người dùng khi /me trả %s, nhưng vẫn báo lỗi kiểm tra quyền', async (status) => {
    const { auth, fetchMock } = await signedIn()
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'error', message: 'Máy chủ tạm thời lỗi' }, { status, headers: { 'Retry-After': '60' } }))
    await expect(auth.refreshAuthorization()).rejects.toMatchObject({ status })
    expect(auth.currentUser.value?.accountId).toBe(reader.accountId)
  })

  it.each([401, 403])('giữ phiên khi proxy trả HTML %s thay vì lỗi API', async (status) => {
    const { auth, fetchMock } = await signedIn()
    fetchMock.mockResolvedValueOnce(new Response('<html>Request blocked</html>', { status }))
    await expect(auth.refreshAuthorization()).rejects.toMatchObject({ status: 502 })
    expect(auth.currentUser.value?.accountId).toBe(reader.accountId)
  })

  it('không xóa phiên khi refresh nhận HTML 403 từ proxy', async () => {
    const { auth, fetchMock } = await signedIn()
    fetchMock.mockResolvedValueOnce(new Response('<html>Request blocked</html>', { status: 403 }))
    await expect(auth.refreshSession()).rejects.toMatchObject({ status: 502 })
    expect(auth.currentUser.value?.accountId).toBe(reader.accountId)
  })

  it.each([401, 403])('xóa phiên khi /me xác nhận %s', async (status) => {
    const { auth, fetchMock } = await signedIn()
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'error', message: 'Không có phiên hợp lệ' }, { status }))
    await expect(auth.refreshAuthorization()).rejects.toMatchObject({ status })
    expect(auth.currentUser.value).toBeNull()
  })

  it('giữ người dùng nếu đã đổi refresh token nhưng /me gặp lỗi tạm thời', async () => {
    const { auth, fetchMock } = await signedIn()
    fetchMock.mockResolvedValueOnce(success({ token: 'rotated-access', expiresIn: 900 }))
    fetchMock.mockRejectedValueOnce(new TypeError('Network failed'))
    await expect(auth.refreshSession()).rejects.toMatchObject({ status: 0 })
    expect(auth.currentUser.value?.accountId).toBe(reader.accountId)
  })

  it('không giữ danh tính tài khoản cũ khi đăng nhập tài khoản mới mà /me lỗi', async () => {
    const { auth, fetchMock } = await signedIn()
    fetchMock.mockResolvedValueOnce(success({ token: 'other-access', expiresIn: 900 }))
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'error', message: 'Máy chủ tạm thời lỗi' }, { status: 503 }))
    await expect(auth.authenticate('login', { ctuIdentifier: 'B2109999', password: 'test-password' })).rejects.toMatchObject({ status: 503 })
    expect(auth.currentUser.value).toBeNull()
  })
})
