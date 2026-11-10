import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Ref } from 'vue'
import App from '../App.vue'
import { currentUser, refreshAuthorization, refreshSession, AuthError } from '../services/auth'
import type { AuthUser } from '../services/auth'

vi.mock('../services/auth', async (original) => {
  const actual = await original<typeof import('../services/auth')>()
  const { ref } = await import('vue')
  return { ...actual, currentUser: ref(null), refreshSession: vi.fn(), refreshAuthorization: vi.fn(), logout: vi.fn(), authenticate: vi.fn() }
})
const user = currentUser as Ref<AuthUser | null>
const global = { stubs: {
  BookCatalogView: { template: '<p data-testid="catalog">Tìm sách</p>' },
  BookManagementView: { template: '<p data-testid="management">Quản lý sách</p>' },
  FacultyManagementView: true, AuthorManagementView: true,
  PeopleManagementView: { props: ['resource'], template: '<p data-testid="people">Hồ sơ {{ resource }}</p>' },
} }
beforeEach(() => {
  vi.clearAllMocks()
  user.value = { accountId: '507f1f77bcf86cd799439011', ctuIdentifier: 'ADMIN', role: 'ADMIN', permissions: [] }
  vi.mocked(refreshSession).mockResolvedValue(undefined)
  vi.mocked(refreshAuthorization).mockResolvedValue(undefined)
  window.history.replaceState(null, '', '#/catalog')
})
afterEach(() => { document.body.innerHTML = '' })
describe('chặn màn hình trước khi mount', () => {
  it('đợi kiểm tra quyền trước khi tạo màn hình từ liên kết trực tiếp', async () => {
    window.history.replaceState(null, '', '#/employee')
    let resolve!: () => void
    vi.mocked(refreshAuthorization).mockReturnValue(new Promise<void>((done) => { resolve = done }))
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Đang kiểm tra quyền truy cập')
    resolve()
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').text()).toContain('employee')
    wrapper.unmount()
  })
  it('không tạo màn hình nội bộ khi kiểm tra quyền lỗi mạng', async () => {
    window.history.replaceState(null, '', '#/employee')
    vi.mocked(refreshAuthorization).mockRejectedValue(new AuthError('Không thể kết nối máy chủ', 0))
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Không có quyền truy cập')
    expect(window.location.hash).toBe('#/forbidden')
    wrapper.unmount()
  })
  it('khách mở liên kết nội bộ được chuyển đến đăng nhập', async () => {
    user.value = null
    window.history.replaceState(null, '', '#/reader')
    vi.mocked(refreshAuthorization).mockRejectedValue(new AuthError('Chưa đăng nhập', 401))
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(window.location.hash).toBe('#/auth')
    wrapper.unmount()
  })
  it('không hiện quyền sách chỉ dựa vào role ADMIN', async () => {
    window.history.replaceState(null, '', '#/manage')
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="management"]').exists()).toBe(false)
    expect(wrapper.find('nav a[href="#/manage"]').exists()).toBe(false)
    expect(wrapper.find('nav a[href="#/reader"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('kết quả kiểm tra đến muộn không đưa người dùng về màn hình đã rời', async () => {
    window.history.replaceState(null, '', '#/employee')
    let resolve!: () => void
    vi.mocked(refreshAuthorization).mockReturnValue(new Promise<void>((done) => { resolve = done }))
    const wrapper = mount(App, { global })
    await flushPromises()
    window.history.replaceState(null, '', '#/catalog')
    window.dispatchEvent(new Event('hashchange'))
    await flushPromises()
    resolve()
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
