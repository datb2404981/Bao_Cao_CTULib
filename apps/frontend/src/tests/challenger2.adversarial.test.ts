import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import App from '../App.vue'
import BookCatalogView from '../views/BookCatalogView.vue'
import BookManagementView from '../views/BookManagementView.vue'
import BookFormModal from '../components/management/BookFormModal.vue'
import BookDetailModal from '../components/catalog/BookDetailModal.vue'
import * as facultyService from '../services/faculty'
import * as authorService from '../services/author'
import * as bookService from '../services/book'
import type { Book, CreateBookPayload } from '../types/book'

enableAutoUnmount(afterEach)

const { mockCurrentUser } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: vueRef } = require('vue')
  return {
    mockCurrentUser: vueRef<any>(null),
  }
})

vi.mock('../services/auth', () => {
  class MockAuthError extends Error {
      status: number
      fields: Record<string, string>
      constructor(message: string, status: number, fields: Record<string, string> = {}) {
        super(message)
        this.status = status
        this.fields = fields
      }
    }
  return {
    AuthError: MockAuthError,
    currentUser: mockCurrentUser,
    getAccessToken: vi.fn(async () => {
      if (!mockCurrentUser.value) return null
      return 'mock-token-' + (mockCurrentUser.value.role || 'user')
    }),
    refreshAuthorization: vi.fn(async () => {
      if (!mockCurrentUser.value) {
        return Promise.reject(new MockAuthError('Chưa đăng nhập', 401))
      }
    }),
    refreshSession: vi.fn(async () => undefined),
    authenticate: vi.fn(async () => undefined),
    logout: vi.fn(async () => {
      mockCurrentUser.value = null
    }),
  }
})

describe('Challenger 2: Adversarial RBAC, State Transitions & Validation Tests', () => {
  const dummyFaculties = [{ _id: 'ee584419975de7543b8c2fd2', facultyName: 'Khoa KTPM' }]
  const dummyAuthors = [{ _id: '3028c4b741766ed91a3b43ac', fullName: 'GS. Nguyễn Văn A' }]

  const sampleBook: Book = {
    bookId: '56e6630ff48c0647904890f3',
    title: 'Giáo trình Kiến trúc Phần mềm',
    bookType: 'TEXTBOOK',
    facultyId: 'ee584419975de7543b8c2fd2',
    authorIds: ['3028c4b741766ed91a3b43ac'],
    totalCopies: 10,
    availableCopies: 5,
    coverPrice: 95000,
    isAvailableForCirculation: true,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    window.location.hash = ''
    mockCurrentUser.value = null
    vi.spyOn(facultyService, 'getAllFaculties').mockResolvedValue(dummyFaculties)
    vi.spyOn(authorService, 'getAllAuthors').mockResolvedValue(dummyAuthors)
    vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
      items: [],
      meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 },
    })
  })

  // =========================================================================
  // SUITE 1: RBAC & PERMISSION ENFORCEMENT
  // =========================================================================
  describe('1. RBAC & Permission Enforcement', () => {
    it('blocks unauthenticated user from accessing management view and hides nav links', async () => {
      mockCurrentUser.value = null
      window.location.hash = '#/manage'

      const wrapper = mount(App)
      await flushPromises()

      // Nav link "Quản lý sách" must NOT exist
      const manageLinks = wrapper.findAll('a').filter(a => a.text().includes('Quản lý'))
      expect(manageLinks.length).toBe(0)

      // Hash sync must redirect unauthenticated access from #/manage to #/auth
      expect(window.location.hash).toBe('#/auth')
      expect(wrapper.findComponent(BookManagementView).exists()).toBe(false)
      expect(wrapper.findComponent(BookCatalogView).exists()).toBe(false)
    })

    it('blocks READER role from accessing management view and shows forbidden screen', async () => {
      mockCurrentUser.value = {
        ctuIdentifier: 'B9900001',
        email: 'b9900001@example.com',
        role: 'READER',
        isActive: true,
      }
      window.location.hash = '#/manage'

      const wrapper = mount(App)
      await flushPromises()

      // Header shows reader badge
      expect(wrapper.text()).toContain('Bạn đọc')

      // Nav link "Quản lý sách" must NOT exist for READER
      const manageLinks = wrapper.findAll('a').filter(a => a.text().includes('Quản lý'))
      expect(manageLinks.length).toBe(0)

      // Thiếu quyền phải hiển thị từ chối truy cập
      expect(window.location.hash).toBe('#/forbidden')
      expect(wrapper.findComponent(BookManagementView).exists()).toBe(false)
      expect(wrapper.findComponent(BookCatalogView).exists()).toBe(false)
    })

    it('displays 403 warning and suppresses API call if BookManagementView is mounted by unauthorized user', async () => {
      mockCurrentUser.value = {
        ctuIdentifier: 'B9900001',
        email: 'b9900001@example.com',
        role: 'READER',
        isActive: true,
      }
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks')

      const wrapper = mount(BookManagementView)
      await flushPromises()

      // Must render 403 Forbidden notice
      expect(wrapper.find('.notice.warning').exists()).toBe(true)
      expect(wrapper.text()).toContain('403 Forbidden')
      expect(wrapper.text()).toContain('Giới hạn quyền truy cập')

      // Must NOT render management table or add book button
      expect(wrapper.find('.responsive-table').exists()).toBe(false)
      expect(wrapper.find('button.primary').exists()).toBe(false)

      // Must NOT make API call
      expect(getAllSpy).not.toHaveBeenCalled()
    })

    it('allows EMPLOYEE with MANAGE_BOOKS to view management navigation and load books', async () => {
      mockCurrentUser.value = {
        ctuIdentifier: 'CB99101',
        email: 'cb99101@example.com',
        role: 'EMPLOYEE',
        permissions: ['MANAGE_BOOKS'],
        isActive: true,
      }
      window.location.hash = '#/manage'
      vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: [sampleBook],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 },
      })

      const wrapper = mount(App)
      await flushPromises()

      // Nav link "Quản lý sách" exists and is rendered
      const manageLinks = wrapper.findAll('a').filter(a => a.text().includes('Quản lý sách'))
      expect(manageLinks.length).toBeGreaterThan(0)

      expect(wrapper.findComponent(BookManagementView).exists()).toBe(true)
    })

    it('allows ADMIN with MANAGE_BOOKS to access management view', async () => {
      mockCurrentUser.value = {
        ctuIdentifier: 'ADMIN01',
        email: 'admin01@example.com',
        role: 'ADMIN',
        permissions: ['MANAGE_BOOKS'],
        isActive: true,
      }
      window.location.hash = '#/manage'
      vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: [],
        meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 },
      })

      const wrapper = mount(App)
      await flushPromises()

      expect(wrapper.findComponent(BookManagementView).exists()).toBe(true)
      expect(wrapper.find('.notice.warning').exists()).toBe(false)
    })

    it('rejects createBook API call with 401 when unauthenticated', async () => {
      mockCurrentUser.value = null

      const payload: CreateBookPayload = {
        title: 'Sách mới',
        facultyId: dummyFaculties[0]!._id,
        authorIds: [dummyAuthors[0]!._id],
        totalCopies: 5,
        coverPrice: 50000,
      }

      await expect(bookService.createBook(payload)).rejects.toThrowError(bookService.BookApiError)
      await expect(bookService.createBook(payload)).rejects.toMatchObject({
        status: 401,
      })
    })

    it('rejects createBook API call with 403 when backend returns Forbidden', async () => {
      mockCurrentUser.value = { role: 'READER', ctuIdentifier: 'B9900001' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'error', message: 'Không đủ quyền truy cập', data: null }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const payload: CreateBookPayload = {
        title: 'Sách mới',
        facultyId: dummyFaculties[0]!._id,
        authorIds: [dummyAuthors[0]!._id],
        totalCopies: 5,
        coverPrice: 50000,
      }

      await expect(bookService.createBook(payload)).rejects.toMatchObject({
        status: 403,
        message: 'Không đủ quyền truy cập',
      })
    })
  })

  // =========================================================================
  // SUITE 2: LIFECYCLE STATE TRANSITIONS
  // =========================================================================
  describe('2. Lifecycle State Transitions (Loading, Success, Empty, Error, Retry)', () => {
    it('manages Catalog View loading, success, and results line transitions', async () => {
      let resolvePromise!: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(bookService, 'getAllBooks').mockReturnValue(pendingPromise as any)

      const wrapper = mount(BookCatalogView)

      // State 1: Loading
      expect(wrapper.find('.loading-skeleton').exists()).toBe(true)
      expect(wrapper.find('.results-line').exists()).toBe(false)
      expect(wrapper.find('input[type="search"]').attributes('disabled')).toBeUndefined()

      // Transition to State 2: Success
      resolvePromise({
        items: [sampleBook],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
      })
      await flushPromises()

      expect(wrapper.find('.loading-skeleton').exists()).toBe(false)
      expect(wrapper.find('.book-card').exists()).toBe(true)
      expect(wrapper.find('.results-line').exists()).toBe(true)
      expect(wrapper.find('.results-line').text()).toContain('1')
    })

    it('transitions to Empty State and resets filters on action', async () => {
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks')
        .mockResolvedValueOnce({
          items: [],
          meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 },
        })
        .mockResolvedValueOnce({
          items: [sampleBook],
          meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
        })

      const wrapper = mount(BookCatalogView)
      await flushPromises()

      // State: Empty
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('Không tìm thấy sách phù hợp')
      expect(wrapper.find('.results-line').text()).toContain('0')

      // Click "Xóa bộ lọc"
      await wrapper.find('button[data-reset-filter]').trigger('click')
      await flushPromises()

      // Returned to Success
      expect(getAllSpy).toHaveBeenCalledTimes(2)
      expect(wrapper.find('.book-card').exists()).toBe(true)
    })

    it('transitions to Error State and recovers on Retry click', async () => {
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks')
        .mockRejectedValueOnce(new bookService.BookApiError('Lỗi kết nối cơ sở dữ liệu', 500))
        .mockResolvedValueOnce({
          items: [sampleBook],
          meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
        })

      const wrapper = mount(BookCatalogView)
      await flushPromises()

      // State: Error
      expect(wrapper.find('.error-banner').exists()).toBe(true)
      expect(wrapper.text()).toContain('Lỗi kết nối cơ sở dữ liệu')
      expect(wrapper.find('.results-line').exists()).toBe(false)
      expect(wrapper.find('.book-card').exists()).toBe(false)

      // Click Retry
      await wrapper.find('.btn-retry').trigger('click')
      await flushPromises()

      // Recovered to Success
      expect(getAllSpy).toHaveBeenCalledTimes(2)
      expect(wrapper.find('.error-banner').exists()).toBe(false)
      expect(wrapper.find('.book-card').exists()).toBe(true)
    })

    it('handles BookDetailModal lifecycle: 401 fallback to initialBook and unauthenticated borrow prompt', async () => {
      mockCurrentUser.value = null
      vi.spyOn(bookService, 'getBookById').mockRejectedValue(
        new bookService.BookApiError('Chưa đăng nhập', 401)
      )

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
          facultyName: 'Khoa KTPM',
          authorNames: 'GS. Nguyễn Văn A',
        },
      })
      await flushPromises()

      // Does not show raw error banner because initialBook was preserved
      expect(wrapper.find('.notice.error').exists()).toBe(false)
      expect(wrapper.text()).toContain('Giáo trình Kiến trúc Phần mềm')
      expect(wrapper.text()).toContain('95.000 đồng')

      // Shows unauthenticated warning notice
      expect(wrapper.find('.notice.info').exists()).toBe(true)
      expect(wrapper.text()).toContain('Bạn cần đăng nhập tài khoản CTULib để thực hiện chức năng mượn sách.')

      // Primary button prompts login
      const borrowBtn = wrapper.find('button.primary')
      expect(borrowBtn.text()).toBe('Đăng nhập để mượn')

      // Clicking button emits 'require-login'
      await borrowBtn.trigger('click')
      expect(wrapper.emitted('require-login')).toBeTruthy()
    })

    it('disables borrow button when book is out of stock or not available for circulation', async () => {
      mockCurrentUser.value = {
        ctuIdentifier: 'B9900001',
        role: 'READER',
        isActive: true,
      }

      const outOfStockBook: Book = {
        ...sampleBook,
        availableCopies: 0,
        isAvailableForCirculation: true,
      }
      vi.spyOn(bookService, 'getBookById').mockResolvedValue(outOfStockBook)

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: outOfStockBook.bookId,
          initialBook: outOfStockBook,
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Hết bản khả dụng')
      const btn = wrapper.find('button.primary')
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })

  // =========================================================================
  // SUITE 3: FORM VALIDATION & ZOD ERROR MAPPING
  // =========================================================================
  describe('3. Form Validation Edge Cases & Zod Field Error Mapping', () => {
    it('validates empty and whitespace-only title', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      // Whitespace only
      await wrapper.find('input[name="title"]').setValue('     ')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Vui lòng nhập tên sách')
    })

    it('validates empty faculty selection', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      await wrapper.find('input[name="title"]').setValue('Tên sách hợp lệ')
      await wrapper.find('select[name="facultyId"]').setValue('')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Vui lòng chọn Khoa/Viện')
    })

    it('validates empty author list', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      await wrapper.find('input[name="title"]').setValue('Tên sách hợp lệ')
      await wrapper.find('select[name="facultyId"]').setValue(dummyFaculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([])
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Sách phải có ít nhất một tác giả')
    })

    it('detects duplicate authorIds when initialized with duplicate entries', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
          initialData: {
            title: 'Sách trùng tác giả',
            facultyId: dummyFaculties[0]!._id,
            authorIds: [dummyAuthors[0]!._id, dummyAuthors[0]!._id], // Duplicates
            totalCopies: 5,
            coverPrice: 50000,
          },
        },
      })

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Danh sách tác giả không được trùng lặp')
    })

    it('validates totalCopies edge cases: negative, non-integer, zero allowed', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      // 1. Negative copies
      await wrapper.find('input[name="totalCopies"]').setValue('-3')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Tổng số bản không được âm')

      // 2. Non-integer copies
      await wrapper.find('input[name="totalCopies"]').setValue('4.7')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Tổng số bản phải là số nguyên')

      // 3. Zero copies: is allowed by both client and backend schema
      await wrapper.find('input[name="title"]').setValue('Sách chuẩn bị xuất bản')
      await wrapper.find('select[name="facultyId"]').setValue(dummyFaculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([dummyAuthors[0]!._id])
      await wrapper.find('input[name="coverPrice"]').setValue('100000')
      await wrapper.find('input[name="totalCopies"]').setValue('0')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeTruthy()
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload
      expect(payload.totalCopies).toBe(0)
    })

    it('validates coverPrice edge cases: negative, zero allowed', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      // Negative price
      await wrapper.find('input[name="coverPrice"]').setValue('-20000')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Giá bìa không được âm')

      // Zero price (free publication) is allowed
      await wrapper.find('input[name="title"]').setValue('Tài liệu miễn phí')
      await wrapper.find('select[name="facultyId"]').setValue(dummyFaculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([dummyAuthors[0]!._id])
      await wrapper.find('input[name="totalCopies"]').setValue('5')
      await wrapper.find('input[name="coverPrice"]').setValue('0')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeTruthy()
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload
      expect(payload.coverPrice).toBe(0)
    })

    it('validates publicationYear edge cases: future beyond limit, negative, and float', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      const currentYear = new Date().getFullYear()

      // Future beyond currentYear + 1
      await wrapper.find('input[name="publicationYear"]').setValue(String(currentYear + 5))
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain(`Năm xuất bản không được lớn hơn ${currentYear + 1}`)

      // Negative year
      await wrapper.find('input[name="publicationYear"]').setValue('-200')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Năm xuất bản phải là số dương')

      // Float year
      await wrapper.find('input[name="publicationYear"]').setValue('2024.5')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Năm xuất bản phải là số nguyên')
    })

    it('rejects publicationYear=0 and prevents form submission with positive number error', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      await wrapper.find('input[name="title"]').setValue('Kiểm tra Năm xuất bản 0')
      await wrapper.find('select[name="facultyId"]').setValue(dummyFaculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([dummyAuthors[0]!._id])
      await wrapper.find('input[name="totalCopies"]').setValue('10')
      await wrapper.find('input[name="coverPrice"]').setValue('50000')
      await wrapper.find('input[name="publicationYear"]').setValue('0')

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Năm xuất bản phải là số dương')
    })

    it('validates coverImageUrl edge cases: invalid URL format vs valid URL', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      // Invalid URL
      await wrapper.find('input[name="coverImageUrl"]').setValue('not-a-valid-url')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.text()).toContain('Đường dẫn ảnh bìa không hợp lệ')

      // Valid URL
      await wrapper.find('input[name="title"]').setValue('Sách có ảnh bìa')
      await wrapper.find('select[name="facultyId"]').setValue(dummyFaculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([dummyAuthors[0]!._id])
      await wrapper.find('input[name="coverImageUrl"]').setValue('https://example.com/cover.jpg')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeTruthy()
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload
      expect(payload.coverImageUrl).toBe('https://example.com/cover.jpg')
    })

    it('correctly maps backend Zod field errors to input fields and aria-invalid attributes', () => {
      const serverFieldErrors = {
        title: 'Tên sách này đã tồn tại trong cơ sở dữ liệu',
        facultyId: 'Khoa/Viện không tồn tại',
        authorIds: 'Một số tác giả không tồn tại',
        coverPrice: 'Giá bìa không được âm',
        totalCopies: 'Tổng số bản không hợp lệ',
      }

      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
          serverError: 'Dữ liệu gửi lên không hợp lệ',
          serverFieldErrors,
        },
      })

      // Top-level server notice
      expect(wrapper.find('.notice.error').text()).toContain('Dữ liệu gửi lên không hợp lệ')

      // Each input must show error message and aria-invalid=true
      expect(wrapper.find('input[name="title"]').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Tên sách này đã tồn tại trong cơ sở dữ liệu')

      expect(wrapper.find('select[name="facultyId"]').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Khoa/Viện không tồn tại')

      expect(wrapper.find('select[name="authorIds"]').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Một số tác giả không tồn tại')

      expect(wrapper.find('input[name="coverPrice"]').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Giá bìa không được âm')

      expect(wrapper.find('input[name="totalCopies"]').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('Tổng số bản không hợp lệ')
    })

    it('properly sanitizes payload: trims whitespace, omits empty strings, excludes availableCopies', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties: dummyFaculties,
          authors: dummyAuthors,
        },
      })

      await wrapper.find('input[name="title"]').setValue('   Giáo trình Mạng Máy Tính   ')
      await wrapper.find('select[name="facultyId"]').setValue(dummyFaculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([dummyAuthors[0]!._id])
      await wrapper.find('input[name="publisher"]').setValue('   NXB Đại học Cần Thơ   ')
      await wrapper.find('input[name="totalCopies"]').setValue('25')
      await wrapper.find('input[name="coverPrice"]').setValue('80000')

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeTruthy()
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload

      expect(payload.title).toBe('Giáo trình Mạng Máy Tính')
      expect(payload.publisher).toBe('NXB Đại học Cần Thơ')
      expect(payload.totalCopies).toBe(25)
      expect(payload.coverPrice).toBe(80000)
      // availableCopies must NOT be sent in payload
      expect((payload as any).availableCopies).toBeUndefined()
    })
  })
})
