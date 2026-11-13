import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Ref } from 'vue'
import App from '../App.vue'
import { currentUser, refreshAuthorization, refreshSession, authenticate, AuthError } from '../services/auth'
import type { AuthUser } from '../services/auth'

vi.mock('../services/auth', async (original) => {
  const actual = await original<typeof import('../services/auth')>()
  const { ref } = await import('vue')
  return { ...actual, currentUser: ref(null), refreshSession: vi.fn(), refreshAuthorization: vi.fn(), logout: vi.fn(), authenticate: vi.fn() }
})
const user = currentUser as Ref<AuthUser | null>
const global = { stubs: {
  BookCatalogView: {
    template: '<p data-testid="catalog">Tìm sách</p>',
    methods: { resetAllAndScrollTop: vi.fn(), focusSearchInput: vi.fn() },
  },
  BookManagementView: { template: '<p data-testid="management">Quản lý sách</p>' },
  FacultyManagementView: true, AuthorManagementView: true,
  MyLoansView: { template: '<p data-testid="my-loans">Phiếu mượn</p>' },
  PeopleManagementView: { props: ['resource'], template: '<p data-testid="people">Hồ sơ {{ resource }}</p>' },
} }
beforeEach(() => {
  vi.clearAllMocks()
  user.value = { accountId: '507f1f77bcf86cd799439011', ctuIdentifier: 'ADMIN', role: 'ADMIN', permissions: [] }
  vi.mocked(refreshSession).mockResolvedValue(undefined)
  vi.mocked(refreshAuthorization).mockResolvedValue(undefined)
  window.history.replaceState(null, '', '/catalog')
})
afterEach(() => { document.body.innerHTML = '' })
describe('chặn màn hình trước khi mount', () => {
  it('đợi kiểm tra quyền trước khi tạo màn hình từ liên kết trực tiếp', async () => {
    window.history.replaceState(null, '', '/employee')
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
    window.history.replaceState(null, '', '/employee')
    vi.mocked(refreshAuthorization).mockRejectedValue(new AuthError('Không thể kết nối máy chủ', 0))
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Chưa thể kiểm tra quyền truy cập')
    expect(window.location.pathname).toBe('/employee')
    wrapper.unmount()
  })
  it('429 khi độc giả chuyển trang giữ phiên và URL, thử lại thành công mới mở phiếu mượn', async () => {
    user.value = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
    const wrapper = mount(App, { global })
    await flushPromises()
    vi.mocked(refreshAuthorization).mockRejectedValueOnce(new AuthError('Máy chủ đang giới hạn truy cập.', 429))
    await wrapper.get('nav a[href="/my-loans"]').trigger('click')
    await flushPromises()
    expect(window.location.pathname).toBe('/my-loans')
    expect(wrapper.get('#access-check-error-title').text()).toContain('Chưa thể kiểm tra quyền')
    expect(wrapper.find('[data-testid="my-loans"]').exists()).toBe(false)
    expect(wrapper.find('button.profile').exists()).toBe(true)
    await wrapper.get('section[aria-labelledby="access-check-error-title"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="my-loans"]').exists()).toBe(true)
    expect(wrapper.find('#access-check-error-title').exists()).toBe(false)
    expect(window.location.pathname).toBe('/my-loans')
    wrapper.unmount()
  })

  it('khách mở liên kết nội bộ được chuyển đến đăng nhập', async () => {
    user.value = null
    window.history.replaceState(null, '', '/reader')
    vi.mocked(refreshAuthorization).mockRejectedValue(new AuthError('Chưa đăng nhập', 401))
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(window.location.pathname).toBe('/auth')
    wrapper.unmount()
  })
  it('mất phiên ở /forbidden thì về đăng nhập và có thể đăng nhập lại', async () => {
    user.value = null
    window.history.replaceState(null, '', '/forbidden')
    vi.mocked(refreshSession).mockRejectedValue(new AuthError('Phiên đăng nhập đã hết hạn', 401))
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(window.location.pathname).toBe('/auth')
    expect(wrapper.find('#access-denied-title').exists()).toBe(false)
    expect(wrapper.find('#identifier').exists()).toBe(true)
    vi.mocked(authenticate).mockImplementationOnce(async () => {
      user.value = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
    })
    await wrapper.get('#identifier').setValue('B2101234')
    await wrapper.get('#password').setValue('test-password')
    await wrapper.get('.auth-form-header + form').trigger('submit')
    await flushPromises()
    expect(window.location.pathname).toBe('/my-loans')
    expect(wrapper.find('[data-testid="my-loans"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('không hiện quyền sách chỉ dựa vào role ADMIN', async () => {
    window.history.replaceState(null, '', '/manage')
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(wrapper.find('[data-testid="management"]').exists()).toBe(false)
    expect(wrapper.find('nav a[href="/manage"]').exists()).toBe(false)
    expect(wrapper.find('nav a[href="/reader"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('kết quả kiểm tra đến muộn không đưa người dùng về màn hình đã rời', async () => {
    window.history.replaceState(null, '', '/employee')
    let resolve!: () => void
    vi.mocked(refreshAuthorization).mockReturnValue(new Promise<void>((done) => { resolve = done }))
    const wrapper = mount(App, { global })
    await flushPromises()
    window.history.replaceState(null, '', '/catalog')
    window.dispatchEvent(new Event('popstate'))
    await flushPromises()
    resolve()
    await flushPromises()
    expect(wrapper.find('[data-testid="people"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('đóng điều hướng và menu tài khoản khi dùng lịch sử trình duyệt', async () => {
    const wrapper = mount(App, { global })
    await flushPromises()

    await wrapper.get('button.menu-button').trigger('click')
    await wrapper.get('button.profile').trigger('click')
    expect(wrapper.get('nav.topnav').classes()).toContain('is-open')
    expect(wrapper.find('.profile-dropdown-card').exists()).toBe(true)

    window.history.replaceState(null, '', '/reader')
    window.dispatchEvent(new Event('popstate'))
    await flushPromises()

    expect(wrapper.get('nav.topnav').classes()).not.toContain('is-open')
    expect(wrapper.find('.profile-dropdown-card').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['a.brand', 'nav a[href="/catalog"]'])(
    'độc giả bấm %s khi đang kiểm tra phiên thì về danh mục và bỏ kết quả đến muộn',
    async (selector) => {
      user.value = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
      window.history.replaceState(null, '', '/my-loans')
      let resolve!: () => void
      vi.mocked(refreshAuthorization).mockReturnValue(new Promise<void>((done) => { resolve = done }))
      const wrapper = mount(App, { global })
      await flushPromises()
      expect(wrapper.text()).toContain('Đang kiểm tra quyền truy cập')

      await wrapper.get(selector).trigger('click')
      await flushPromises()
      expect(window.location.pathname).toBe('/catalog')
      expect(wrapper.find('[data-testid="catalog"]').exists()).toBe(true)

      resolve()
      await flushPromises()
      expect(window.location.pathname).toBe('/catalog')
      expect(wrapper.find('[data-testid="my-loans"]').exists()).toBe(false)
      wrapper.unmount()
    },
  )

  it.each(['a.brand', 'nav a[href="/catalog"]'])(
    'độc giả bấm %s từ phiếu mượn thì về danh mục',
    async (selector) => {
      user.value = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
      window.history.replaceState(null, '', '/my-loans')
      const wrapper = mount(App, { global })
      await flushPromises()
      expect(wrapper.find('[data-testid="my-loans"]').exists()).toBe(true)
      await wrapper.get('button.menu-button').trigger('click')
      await wrapper.get(selector).trigger('click')
      await flushPromises()
      expect(window.location.pathname).toBe('/catalog')
      expect(wrapper.find('[data-testid="catalog"]').exists()).toBe(true)
      expect(wrapper.get('nav.topnav').classes()).not.toContain('is-open')
      wrapper.unmount()
    },
  )

  it('chuyển liên kết hash cũ sang đường dẫn trực tiếp', async () => {
    user.value = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
    window.history.replaceState(null, '', '/#/my-loans')
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(window.location.pathname).toBe('/my-loans')
    expect(window.location.hash).toBe('')
    expect(wrapper.find('[data-testid="my-loans"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('chuẩn hóa URL forbidden bị chồng hash về một đường dẫn', async () => {
    user.value = { accountId: 'reader-id', ctuIdentifier: 'B2101234', role: 'READER', permissions: [] }
    window.history.replaceState(null, '', '/forbidden#/forbidden')
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(window.location.pathname).toBe('/forbidden')
    expect(window.location.hash).toBe('')
    expect(wrapper.text()).toContain('Không có quyền truy cập')
    wrapper.unmount()
  })

  it('khôi phục phiên EMPLOYEE từ catalog về màn hình nghiệp vụ mặc định', async () => {
    user.value = {
      accountId: '507f1f77bcf86cd799439012',
      ctuIdentifier: 'CB99101',
      role: 'EMPLOYEE',
      permissions: ['MANAGE_BOOKS'],
    }
    window.history.replaceState(null, '', '/catalog')
    const wrapper = mount(App, { global })
    await flushPromises()
    expect(window.location.pathname).toBe('/manage')
    expect(wrapper.find('[data-testid="management"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="catalog"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('kiểm tra dữ liệu đăng ký trên giao diện', () => {
  it('chặn email tên miền toàn số và mật khẩu dấu cách trước khi gọi API', async () => {
    user.value = null
    window.history.replaceState(null, '', '/auth')
    const wrapper = mount(App, { global })
    await flushPromises()
    await wrapper.get('.auth-text-link').trigger('click')
    await wrapper.get('#identifier').setValue('B2101234')
    await wrapper.get('#email').setValue('test@123.com')
    await wrapper.get('#password').setValue('StrongPass123')
    await wrapper.get('#confirmation').setValue('StrongPass123')
    await wrapper.get('.auth-form-header + form').trigger('submit')
    expect(wrapper.get('#email-error').text()).toContain('tên miền phải có chữ cái')
    expect(authenticate).not.toHaveBeenCalled()

    await wrapper.get('#email').setValue('reader@example.com')
    await wrapper.get('#password').setValue('            ')
    await wrapper.get('#confirmation').setValue('            ')
    await wrapper.get('.auth-form-header + form').trigger('submit')
    expect(wrapper.get('#password-error').text()).toContain('8 ký tự')
    expect(authenticate).not.toHaveBeenCalled()

    await wrapper.get('#password').setValue('StrongPass123')
    await wrapper.get('#confirmation').setValue('StrongPass123')
    await wrapper.get('.auth-form-header + form').trigger('submit')
    await flushPromises()
    expect(authenticate).toHaveBeenCalledExactlyOnceWith('register', {
      ctuIdentifier: 'B2101234', email: 'reader@example.com', password: 'StrongPass123',
    })
    wrapper.unmount()
  })
})
