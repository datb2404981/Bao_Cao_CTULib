import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Ref } from 'vue'
import App from '../App.vue'
import BookCatalogView from '../views/BookCatalogView.vue'
import * as booksApi from '../services/book'
import * as facultyApi from '../services/faculty'
import * as authorApi from '../services/author'
import * as loansApi from '../services/loan'
import { currentUser, authenticate, refreshSession, refreshAuthorization } from '../services/auth'
import type { AuthUser } from '../services/auth'
import type { Book } from '../types/book'

vi.mock('../services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth')>()
  const { ref } = await import('vue')
  return {
    ...actual,
    currentUser: ref(null),
    authenticate: vi.fn(),
    refreshSession: vi.fn(),
    refreshAuthorization: vi.fn(),
    logout: vi.fn(),
  }
})

vi.mock('../services/book', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/book')>()
  return {
    ...actual,
    getAllBooks: vi.fn(),
    getBookById: vi.fn(),
  }
})

vi.mock('../services/faculty', () => ({ getAllFaculties: vi.fn() }))
vi.mock('../services/author', () => ({ getAllAuthors: vi.fn() }))
vi.mock('../services/loan', () => ({ reserveBook: vi.fn() }))

const sampleBook: Book = {
  bookId: '507f1f77bcf86cd799439012',
  title: 'Giáo trình Lập trình Web Nâng Cao',
  bookType: 'TEXTBOOK',
  facultyId: '507f1f77bcf86cd799439013',
  authorIds: [],
  totalCopies: 5,
  availableCopies: 3,
  coverPrice: 150000,
  isAvailableForCirculation: true,
}

const user = currentUser as Ref<AuthUser | null>

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  user.value = null
  vi.mocked(refreshSession).mockResolvedValue(undefined)
  vi.mocked(refreshAuthorization).mockResolvedValue(undefined)
  vi.mocked(booksApi.getAllBooks).mockResolvedValue({
    items: [sampleBook],
    meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
  })
  vi.mocked(booksApi.getBookById).mockResolvedValue(sampleBook)
  vi.mocked(facultyApi.getAllFaculties).mockResolvedValue([])
  vi.mocked(authorApi.getAllAuthors).mockResolvedValue([])
  window.history.replaceState(null, '', '#/catalog')
})

afterEach(() => {
  document.body.innerHTML = ''
  sessionStorage.clear()
})

describe('Luồng đăng nhập để mượn sách và quay lại đúng trang chi tiết sách', () => {
  it('BookCatalogView: khách xem sách, bấm "Đăng nhập để mượn" sẽ phát sự kiện require-login mang theo thông tin sách', async () => {
    user.value = null
    const wrapper = mount(BookCatalogView, { attachTo: document.body })
    await flushPromises()

    // Mở modal chi tiết sách
    await wrapper.get('.book-card .btn-view').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Chi tiết sách')
    expect(wrapper.text()).toContain(sampleBook.title)

    // Nút hiển thị "Đăng nhập để mượn" khi chưa đăng nhập
    const borrowBtn = wrapper.get('.btn-borrow-action')
    expect(borrowBtn.text()).toContain('Đăng nhập để mượn')

    // Bấm "Đăng nhập để mượn"
    await borrowBtn.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('require-login')).toBeTruthy()
    expect(wrapper.emitted('require-login')![0][0]).toEqual(sampleBook)
    expect(wrapper.emitted('navigate')).toBeTruthy()
    expect(wrapper.emitted('navigate')![0]).toEqual(['auth'])

    wrapper.unmount()
  })

  it('BookCatalogView: khi nhận initialBook sẽ tự động mở modal chi tiết sách đó', async () => {
    user.value = {
      accountId: '507f1f77bcf86cd799439011',
      ctuIdentifier: 'B2101234',
      role: 'READER',
    }
    const wrapper = mount(BookCatalogView, {
      props: { initialBook: sampleBook },
      attachTo: document.body,
    })
    await flushPromises()

    // Modal chi tiết sách đã được mở sẵn
    expect(wrapper.text()).toContain('Chi tiết sách')
    expect(wrapper.text()).toContain(sampleBook.title)

    // Đã đăng nhập là bạn đọc nên nút hiển thị "Đặt mượn" và sẵn sàng để mượn ngay
    const borrowBtn = wrapper.get('.btn-borrow-action')
    expect(borrowBtn.text()).toContain('Đặt mượn')
    expect(borrowBtn.attributes('disabled')).toBeUndefined()

    wrapper.unmount()
  })

  it('App.vue End-to-End: từ chi tiết sách bấm đăng nhập để mượn -> đăng nhập thành công -> quay lại đúng chi tiết sách để mượn ngay', async () => {
    user.value = null
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    // 1. Mở xem chi tiết sách trong catalog
    expect(wrapper.text()).toContain('Tra cứu Học liệu & Giáo trình')
    await wrapper.get('.book-card .btn-view').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Chi tiết sách')
    expect(wrapper.text()).toContain(sampleBook.title)

    // 2. Bấm "Đăng nhập để mượn"
    const borrowBtn = wrapper.get('.btn-borrow-action')
    expect(borrowBtn.text()).toContain('Đăng nhập để mượn')
    await borrowBtn.trigger('click')
    await flushPromises()

    // 3. Màn hình chuyển sang Auth/Login, không hiển thị banner mượn sách.
    // Thông tin sách vẫn được giữ để quay lại trang chi tiết sau khi đăng nhập.
    expect(window.location.hash).toBe('#/auth')
    expect(wrapper.find('.pending-borrow-banner').exists()).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('ctulib_pending_borrow_book') || 'null')).toEqual(sampleBook)

    // 4. Nhập thông tin tài khoản và đăng nhập
    await wrapper.find('#identifier').setValue('B2101234')
    await wrapper.find('#password').setValue('password123')

    vi.mocked(authenticate).mockImplementation(async () => {
      user.value = {
        accountId: '507f1f77bcf86cd799439011',
        ctuIdentifier: 'B2101234',
        role: 'READER',
      }
    })

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // 5. Kiểm tra kết quả: không chuyển sang my-loans mà quay lại đúng catalog và mở sẵn chi tiết quyển sách đó
    expect(window.location.hash).toBe('#/catalog')
    expect(wrapper.text()).toContain('Chi tiết sách')
    expect(wrapper.text()).toContain(sampleBook.title)

    // Nút mượn chuyển thành "Đặt mượn" cho độc giả, sẵn sàng để mượn ngay mà không cần tìm lại sách!
    const activeBorrowBtn = wrapper.get('.btn-borrow-action')
    expect(activeBorrowBtn.text()).toContain('Đặt mượn')
    expect(activeBorrowBtn.attributes('disabled')).toBeUndefined()

    wrapper.unmount()
  })
})
