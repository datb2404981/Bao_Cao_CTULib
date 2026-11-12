import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { getAllBooks, getBookById, createBook, BookApiError } from '../services/book'
import type { Book, CreateBookPayload } from '../types/book'
import BookCard from '../components/catalog/BookCard.vue'
import BookPagination from '../components/catalog/BookPagination.vue'
import BookFilters from '../components/catalog/BookFilters.vue'
import BookDetailModal from '../components/catalog/BookDetailModal.vue'
import BookFormModal from '../components/management/BookFormModal.vue'
import BookCatalogView from '../views/BookCatalogView.vue'
import * as authService from '../services/auth'

vi.mock('@/services/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token-123'),
  currentUser: { value: null },
  authenticate: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}))

const baseBook: Book = {
  bookId: '69cabe960354ac17e1a6b401',
  title: 'Giáo trình Mạng Máy tính & Truyền thông',
  bookType: 'TEXTBOOK',
  facultyId: 'cae0f440bef882ce04faec01',
  authorIds: ['3028c4b741766ed91a3b43ac'],
  totalCopies: 5,
  availableCopies: 3,
  coverPrice: 95000,
  publicationYear: 2023,
  publisher: 'NXB Đại học Cần Thơ',
  isAvailableForCirculation: true,
}

describe('Empirical Challenger: Book Catalog Stress Suite', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('1. API Service Stress Tests (Edge Cases & Malformed Inputs)', () => {
    it('handles special characters in search: ? & = " \' <script> # % + and emojis', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } },
      }), { status: 200 }))

      const specialSearch = '?search=true&x=1"\'<script>alert(1)</script>#hash%20+📚'
      await getAllBooks({ search: specialSearch })

      expect(fetch).toHaveBeenCalledTimes(1)
      const [url] = vi.mocked(fetch).mock.calls[0]!
      const parsedUrl = new URL(String(url), 'http://localhost')
      expect(parsedUrl.searchParams.get('search')).toBe(specialSearch)
    })

    it('handles whitespace-only search by omitting search param', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } },
      }), { status: 200 }))

      await getAllBooks({ search: '     \t\n   ' })

      const [url] = vi.mocked(fetch).mock.calls[0]!
      const parsedUrl = new URL(String(url), 'http://localhost')
      expect(parsedUrl.searchParams.has('search')).toBe(false)
    })

    it('handles extreme page numbers: page 99999, negative, zero, and decimals', async () => {
      vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } },
      }), { status: 200 }))

      await getAllBooks({ page: 99999 })
      let [url] = vi.mocked(fetch).mock.calls[0]!
      expect(new URL(String(url), 'http://localhost').searchParams.get('page')).toBe('99999')

      await getAllBooks({ page: -5 })
      ;[url] = vi.mocked(fetch).mock.calls[1]!
      expect(new URL(String(url), 'http://localhost').searchParams.get('page')).toBe('-5')

      await getAllBooks({ page: 0 })
      ;[url] = vi.mocked(fetch).mock.calls[2]!
      expect(new URL(String(url), 'http://localhost').searchParams.get('page')).toBe('0')
    })

    it('handles server HTML error response (e.g. 502/504 Bad Gateway HTML body)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }))

      let capturedError: unknown
      try {
        await getAllBooks()
      } catch (err) {
        capturedError = err
      }

      expect(capturedError).toBeInstanceOf(BookApiError)
      expect(capturedError).toMatchObject({
        status: 502,
        message: 'Yêu cầu không thành công.',
      })
    })

    it('handles missing auth token gracefully in getBookById and createBook', async () => {
      vi.mocked(authService.getAccessToken).mockResolvedValueOnce(null)

      await expect(getBookById(baseBook.bookId)).rejects.toMatchObject({
        status: 401,
        message: 'Vui lòng đăng nhập để thực hiện thao tác này.',
      })
    })

    it('handles getAccessToken exception gracefully', async () => {
      vi.mocked(authService.getAccessToken).mockRejectedValueOnce(new Error('Session corrupted'))

      await expect(getBookById(baseBook.bookId)).rejects.toMatchObject({
        status: 401,
        message: 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.',
      })
    })

    it('handles network timeout and abort signal', async () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError')
      vi.mocked(fetch).mockRejectedValueOnce(abortError)

      await expect(getAllBooks()).rejects.toMatchObject({
        status: 0,
        message: expect.stringContaining('Không thể kết nối máy chủ'),
      })
    })

    it('handles invalid ObjectId strings in getBookById (e.g. path traversal, SQL injection, script tags)', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        "' OR '1'='1",
        '<script>alert(1)</script>',
        'not-24-hex-characters',
      ]

      for (const malId of maliciousIds) {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
          status: 'error',
          message: 'Sách không tồn tại',
        }), { status: 404 }))

        await expect(getBookById(malId)).rejects.toMatchObject({
          status: 404,
          message: 'Sách không tồn tại',
        })
      }
    })
  })

  describe('2. BookCard Component Boundary Tests', () => {
    it('renders correctly when totalCopies = 0 and availableCopies = 0', () => {
      const zeroBook: Book = {
        ...baseBook,
        totalCopies: 0,
        availableCopies: 0,
      }
      const wrapper = mount(BookCard, { props: { book: zeroBook } })
      const badge = wrapper.find('.badge-copies')
      expect(badge.text()).toBe('Hết sách')
      expect(badge.classes()).toContain('out-of-stock')
      expect(badge.classes()).toContain('empty')
    })

    it('renders "Còn 1 bản" when availableCopies = 1', () => {
      const singleBook: Book = {
        ...baseBook,
        totalCopies: 1,
        availableCopies: 1,
      }
      const wrapper = mount(BookCard, { props: { book: singleBook } })
      const badge = wrapper.find('.badge-copies')
      expect(badge.text()).toBe('Còn 1 bản')
      expect(badge.classes()).not.toContain('out-of-stock')
    })

    it('renders "Hết sách" when availableCopies > 0 but isAvailableForCirculation is false', () => {
      const nonCirculatingBook: Book = {
        ...baseBook,
        availableCopies: 5,
        isAvailableForCirculation: false,
      }
      const wrapper = mount(BookCard, { props: { book: nonCirculatingBook } })
      const badge = wrapper.find('.badge-copies')
      expect(badge.text()).toBe('Hết sách')
      expect(badge.classes()).toContain('out-of-stock')
    })

    it('renders price correctly when coverPrice = 0', () => {
      const freeBook: Book = {
        ...baseBook,
        coverPrice: 0,
      }
      const wrapper = mount(BookCard, { props: { book: freeBook } })
      expect(wrapper.find('.card-price').exists()).toBe(true)
      expect(wrapper.find('.price-val').text()).toBe('0 đ')
    })

    it('renders safely without XSS when title or authorNames contain HTML tags', () => {
      const xssBook: Book = {
        ...baseBook,
        title: '<img src=x onerror=alert(1)> & "XSS Test"',
      }
      const wrapper = mount(BookCard, {
        props: {
          book: xssBook,
          authorNames: '<script>evil()</script>',
          facultyName: '<b>Khoa CNTT</b>',
        },
      })

      // Vue auto-escapes in template text nodes
      expect(wrapper.find('h3.book-title').text()).toBe('<img src=x onerror=alert(1)> & "XSS Test"')
      expect(wrapper.find('.author').text()).toBe('<script>evil()</script>')
      // No unescaped malicious tags should be inserted into DOM
      expect(wrapper.find('h3.book-title img').exists()).toBe(false)
    })
  })

  describe('3. BookPagination Boundary Tests', () => {
    it('does not render when totalPages is 0', () => {
      const wrapper = mount(BookPagination, {
        props: { currentPage: 1, totalPages: 0, totalItems: 0, limit: 10 },
      })
      expect(wrapper.find('.pagination-bar').exists()).toBe(false)
    })

    it('renders disabled buttons when disabled prop is true', () => {
      const wrapper = mount(BookPagination, {
        props: { currentPage: 2, totalPages: 5, totalItems: 50, limit: 10, disabled: true },
      })
      expect(wrapper.find('button.btn-prev').attributes('disabled')).toBeDefined()
      expect(wrapper.find('button.btn-next').attributes('disabled')).toBeDefined()
      for (const btn of wrapper.findAll('button.page-num-btn')) {
        expect(btn.attributes('disabled')).toBeDefined()
      }
    })

    it('handles extreme totalPages = 1000 with ellipsis without crashing or lag', () => {
      const wrapper = mount(BookPagination, {
        props: { currentPage: 500, totalPages: 1000, totalItems: 10000, limit: 10 },
      })
      const ellipsisSpans = wrapper.findAll('.page-ellipsis')
      expect(ellipsisSpans.length).toBe(2) // start ellipsis and end ellipsis
      expect(wrapper.text()).toContain('500')
      expect(wrapper.text()).toContain('1000')
    })

    it('prevents navigation when clicking current page or out-of-bounds page', async () => {
      const wrapper = mount(BookPagination, {
        props: { currentPage: 2, totalPages: 3, totalItems: 30, limit: 10 },
      })
      const activeBtn = wrapper.find('button.page-num-btn.active')
      await activeBtn.trigger('click')
      expect(wrapper.emitted('page-change')).toBeUndefined()
    })
  })

  describe('4. BookFormModal Boundary & Validation Tests', () => {
    const faculties = [{ _id: 'cae0f440bef882ce04faec01', facultyName: 'Khoa Mạng Máy tính' }]
    const authors = [
      { _id: '3028c4b741766ed91a3b43ac', fullName: 'Tác giả A' },
      { _id: '9d458de4ad9937662b64fbfc', fullName: 'Tác giả B' },
    ]

    it('accepts totalCopies = 0 and coverPrice = 0 as valid boundary inputs', async () => {
      const wrapper = mount(BookFormModal, {
        props: { isOpen: true, faculties, authors },
      })
      await wrapper.find('input[name="title"]').setValue('Tài liệu phát miễn phí')
      await wrapper.find('select[name="facultyId"]').setValue(faculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([authors[0]!._id])
      await wrapper.find('input[name="totalCopies"]').setValue('0')
      await wrapper.find('input[name="coverPrice"]').setValue('0')

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeTruthy()
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload
      expect(payload.totalCopies).toBe(0)
      expect(payload.coverPrice).toBe(0)
    })

    it('rejects publicationYear > currentYear + 1', async () => {
      const wrapper = mount(BookFormModal, {
        props: { isOpen: true, faculties, authors },
      })
      await wrapper.find('input[name="title"]').setValue('Sách viễn tưởng')
      await wrapper.find('input[name="publicationYear"]').setValue('2099')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Năm xuất bản không được lớn hơn')
    })

    it('rejects publicationYear = 0 with "Năm xuất bản phải là số dương"', async () => {
      const wrapper = mount(BookFormModal, {
        props: { isOpen: true, faculties, authors },
      })
      await wrapper.find('input[name="title"]').setValue('Sách kiểm tra năm 0')
      await wrapper.find('select[name="facultyId"]').setValue(faculties[0]!._id)
      await wrapper.find('select[name="authorIds"]').setValue([authors[0]!._id])
      await wrapper.find('input[name="totalCopies"]').setValue('5')
      await wrapper.find('input[name="coverPrice"]').setValue('50000')
      await wrapper.find('input[name="publicationYear"]').setValue('0')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Năm xuất bản phải là số dương')
    })

    it('rejects invalid coverImageUrl format', async () => {
      const wrapper = mount(BookFormModal, {
        props: { isOpen: true, faculties, authors },
      })
      await wrapper.find('input[name="coverImageUrl"]').setValue('not-a-valid-url')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Đường dẫn ảnh bìa không hợp lệ')
    })

    it('rejects duplicate author IDs', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties,
          authors,
          initialData: {
            title: 'Sách trùng tác giả',
            facultyId: faculties[0]!._id,
            authorIds: [authors[0]!._id, authors[0]!._id], // duplicate
          },
        },
      })
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('submit')).toBeFalsy()
      expect(wrapper.text()).toContain('Danh sách tác giả không được trùng lặp')
    })
  })

  describe('5. BookDetailModal Interaction & Fallback Tests', () => {
    it('gracefully falls back to initialBook when getBookById fails with 401', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Chưa đăng nhập',
      }), { status: 401 }))

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: baseBook.bookId,
          initialBook: baseBook,
          facultyName: 'Khoa Mạng Máy tính',
          authorNames: 'Tác giả A',
        },
      })
      await flushPromises()

      // Should display book title from initialBook
      expect(wrapper.text()).toContain(baseBook.title)
      // Should show notice that login is required to borrow
      expect(wrapper.text()).toContain('Bạn cần đăng nhập tài khoản CTULib để thực hiện chức năng mượn sách.')
      // Footer button should say "Đăng nhập để mượn"
      expect(wrapper.find('button.primary').text()).toBe('Đăng nhập để mượn')
    })

    it('disables borrow button when availableCopies = 0', async () => {
      const zeroCopiesBook = { ...baseBook, availableCopies: 0 }
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: zeroCopiesBook.bookId,
          initialBook: zeroCopiesBook,
        },
      })
      await flushPromises()

      const borrowBtn = wrapper.find('button.primary')
      expect(borrowBtn.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Hết bản khả dụng')
    })

    it('emits require-login when unauthenticated user clicks borrow', async () => {
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: baseBook.bookId,
          initialBook: baseBook,
        },
      })
      await flushPromises()

      await wrapper.find('button.primary').trigger('click')
      expect(wrapper.emitted('require-login')).toBeTruthy()
    })

    it('formats coverPrice = null to "Chưa cập nhật"', async () => {
      const nullPriceBook = { ...baseBook, coverPrice: (null as unknown as number) }
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: nullPriceBook.bookId,
          initialBook: nullPriceBook,
        },
      })
      await flushPromises()

      const priceText = wrapper.find('dd.num')?.text()
      expect(priceText).toBe('Chưa cập nhật')
    })
  })

  describe('6. BookCatalogView Integration & Behavioral Flaw Exploration', () => {
    it('CHALLENGE: Server-side bookType filter preserves API pagination totals', async () => {
      // Giả lập backend trả về 12 sách toàn bộ là TEXTBOOK trên trang 1
      const textbooks: Book[] = Array.from({ length: 12 }, (_, i) => ({
        ...baseBook,
        bookId: `id_${i}`,
        title: `Giáo trình ${i + 1}`,
        bookType: 'TEXTBOOK',
      }))

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: {
          items: textbooks,
          meta: { totalItems: 24, totalPages: 2, currentPage: 1, limit: 12 },
        },
      }), { status: 200 }))

      const wrapper = mount(BookCatalogView)
      await flushPromises()

      // Ban đầu: hiển thị 12 sách giáo trình
      expect(wrapper.findAll('.book-card').length).toBe(12)
      expect(wrapper.find('.result-count').exists()).toBe(false)
      expect(wrapper.find('.pagination-info').text()).toContain('Trang 1 / 2')

      // Bây giờ người dùng chọn Loại sách: Sách tham khảo (REFERENCE)
      // API trả danh sách và tổng đã lọc tại server.
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: {
          items: [{ ...baseBook, bookType: 'REFERENCE', title: 'Sách tham khảo lọc từ server' }],
          meta: { totalItems: 6, totalPages: 1, currentPage: 1, limit: 12 },
        },
      }), { status: 200 }))

      const kindSelect = wrapper.find('select.kind-select')
      await kindSelect.setValue('REFERENCE')
      await wrapper.find('form.filters').trigger('submit.prevent')
      await flushPromises()

      const emptyStateExists = wrapper.find('.empty-state').exists()

      expect(wrapper.findAll('.book-card').length).toBe(1)
      expect(emptyStateExists).toBe(false)
      expect(wrapper.find('.pagination-bar').exists()).toBe(false)
      expect(new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost').searchParams.get('bookType')).toBe('REFERENCE')
    })

    it('automatically triggers search after debounce without requiring explicit submit', async () => {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const path = new URL(String(input), 'http://localhost').pathname
        return new Response(JSON.stringify({
          status: 'success',
          data: path === '/api/v1/book'
            ? { items: [baseBook], meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 } }
            : [],
        }), { status: 200 })
      })
      const bookRequests = () => vi.mocked(fetch).mock.calls.filter(([input]) =>
        new URL(String(input), 'http://localhost').pathname === '/api/v1/book'
      )

      const wrapper = mount(BookCatalogView)
      await flushPromises()
      expect(bookRequests()).toHaveLength(1)

      // Người dùng gõ vào ô tìm kiếm
      const searchInput = wrapper.find('input[type="search"]')
      await searchInput.setValue('Kiến trúc')

      // Chờ 500ms (vượt quá debounceMs 300ms)
      await new Promise((resolve) => setTimeout(resolve, 500))
      await flushPromises()

      expect(bookRequests()).toHaveLength(2)
      wrapper.unmount()
    })
  })
})
