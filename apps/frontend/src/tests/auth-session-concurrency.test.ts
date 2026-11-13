import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reader = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
const success = (data: unknown) => Response.json({ status: 'success', data })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('phiên dùng chung cookie giữa các khung', () => {
  it('hai khung refresh đồng thời dùng lần lượt cookie mới, không replay token cũ', async () => {
    let queue = Promise.resolve()
    const lock = vi.fn((_name: string, action: () => Promise<unknown>) => {
      const result = queue.then(action)
      queue = result.then(() => undefined, () => undefined)
      return result
    })
    vi.stubGlobal('navigator', { locks: { request: lock } })
    let cookieVersion = 0
    let activeRefreshes = 0
    let maxActiveRefreshes = 0
    const versions: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/refresh')) {
        activeRefreshes++
        maxActiveRefreshes = Math.max(maxActiveRefreshes, activeRefreshes)
        const sentVersion = cookieVersion
        versions.push(sentVersion)
        await Promise.resolve()
        // Mô phỏng backend chỉ chấp nhận token hiện hành một lần.
        if (sentVersion !== cookieVersion) return Response.json({ status: 'error' }, { status: 401 })
        cookieVersion++
        activeRefreshes--
        return success({ token: `access-${cookieVersion}`, expiresIn: 900 })
      }
      return success(reader)
    }))
    const firstFrame = await import('../services/auth')
    vi.resetModules()
    const secondFrame = await import('../services/auth')
    await Promise.all([firstFrame.refreshSession(), secondFrame.refreshSession()])
    expect(versions).toEqual([0, 1])
    expect(maxActiveRefreshes).toBe(1)
    expect(firstFrame.currentUser.value?.role).toBe('READER')
    expect(secondFrame.currentUser.value?.role).toBe('READER')
    expect(lock).toHaveBeenCalledTimes(2)
  })

  it('cùng tài khoản đăng nhập ở hai khung rồi cả hai vẫn refresh được', async () => {
    let queue = Promise.resolve()
    vi.stubGlobal('navigator', { locks: { request: (_name: string, action: () => Promise<unknown>) => {
      const result = queue.then(action)
      queue = result.then(() => undefined, () => undefined)
      return result
    } } })
    let cookieVersion = 0
    const logins: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/me')) return success(reader)
      if (url.endsWith('/login')) {
        logins.push((JSON.parse(String(options?.body)) as { ctuIdentifier: string }).ctuIdentifier)
      }
      cookieVersion++
      return success({ token: `access-${cookieVersion}`, expiresIn: 900 })
    }))
    const first = await import('../services/auth')
    vi.resetModules()
    const second = await import('../services/auth')
    const input = { ctuIdentifier: reader.ctuIdentifier, password: 'test-password' }
    await Promise.all([first.authenticate('login', input), second.authenticate('login', input)])
    await Promise.all([first.refreshSession(), second.refreshSession()])
    expect(logins).toEqual([reader.ctuIdentifier, reader.ctuIdentifier])
    expect(first.currentUser.value?.accountId).toBe(reader.accountId)
    expect(second.currentUser.value?.accountId).toBe(reader.accountId)
    expect(cookieVersion).toBe(4)
  })

  it('login, refresh và logout dùng cùng khóa để không ghi đè cookie đồng thời', async () => {
    const lock = vi.fn(async (_name: string, action: () => Promise<unknown>) => action())
    vi.stubGlobal('navigator', { locks: { request: lock } })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => success(
      url.endsWith('/me') ? reader : { token: 'access', expiresIn: 900 },
    )))
    const auth = await import('../services/auth')
    await auth.authenticate('login', { ctuIdentifier: 'B2101234', password: 'password' })
    await auth.refreshSession()
    await auth.logout()
    expect(lock.mock.calls.map(([name]) => name)).toEqual(['ctulib-auth:', 'ctulib-auth:', 'ctulib-auth:'])
    expect(auth.currentUser.value).toBeNull()
  })

  it('vẫn đăng nhập được khi trình duyệt không hỗ trợ Web Locks', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('fetch', vi.fn(async (url: string) => success(
      url.endsWith('/me') ? reader : { token: 'access', expiresIn: 900 },
    )))
    const auth = await import('../services/auth')
    await auth.refreshSession()
    expect(auth.currentUser.value?.role).toBe('READER')
  })

  it('tái sử dụng kết quả kiểm tra quyền trong 60 giây khi chuyển trang để không gọi /auth/me liên tục', async () => {
    vi.stubGlobal('navigator', {})
    const fetchMock = vi.fn(async (url: string) => success(
      url.endsWith('/me') ? reader : { token: 'access', expiresIn: 900 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('../services/auth')
    await auth.authenticate('login', { ctuIdentifier: 'B2101234', password: 'password' })

    const meCallsAfterLogin = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/me')).length
    expect(meCallsAfterLogin).toBe(1)

    // Chuyển trang trong vòng 60 giây: không gọi lại /auth/me
    vi.advanceTimersByTime(30_000)
    await auth.refreshAuthorization(false)
    await auth.refreshAuthorization(false)
    const meCallsWithinTtl = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/me')).length
    expect(meCallsWithinTtl).toBe(1)

    // Sau 60 giây: gọi lại /auth/me để đồng bộ quyền mới nhất
    vi.advanceTimersByTime(31_000)
    await auth.refreshAuthorization(false)
    const meCallsAfterTtl = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/me')).length
    expect(meCallsAfterTtl).toBe(2)
  })
})
