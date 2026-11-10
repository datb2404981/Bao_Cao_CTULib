import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAllBooks, getBookById, createBook, BookApiError } from '../services/book'
import type { Book, CreateBookPayload } from '../types/book'

// Mock getAccessToken từ services/auth
vi.mock('@/services/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-jwt-access-token'),
}))

const mockBook: Book = {
  bookId: '56e6630ff48c0647904890f3',
  title: 'Lập trình Web với Node.js và TypeScript',
  bookType: 'TEXTBOOK',
  facultyId: 'ee584419975de7543b8c2fd2',
  authorIds: ['3028c4b741766ed91a3b43ac'],
  totalCopies: 20,
  availableCopies: 15,
  coverPrice: 120000,
  publicationYear: 2024,
  publisher: 'NXB Đại học Cần Thơ',
  isAvailableForCirculation: true,
}

describe('services/book.ts - Unit Tests', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('getAllBooks', () => {
    it('SVC-LIST-001: Lấy danh sách mặc định thành công (200 OK)', async () => {
      const mockResponseData = {
        status: 'success',
        message: 'Lấy danh sách thành công',
        data: {
          items: [mockBook],
          meta: { totalItems: 12, totalPages: 2, currentPage: 1, limit: 10 },
        },
      }

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

      const result = await getAllBooks()

      expect(fetch).toHaveBeenCalledTimes(1)
      const [url, options] = vi.mocked(fetch).mock.calls[0]!
      expect(String(url)).toBe('/book')
      expect(options?.method).toBe('GET')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]?.bookId).toBe(mockBook.bookId)
      expect(result.meta.totalItems).toBe(12)
    })

    it('SVC-LIST-002: Nối query params phân trang đúng chuẩn URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 2, limit: 5 } },
      }), { status: 200 }))

      await getAllBooks({ page: 2, limit: 5 })

      const [url] = vi.mocked(fetch).mock.calls[0]!
      const parsedUrl = new URL(String(url), 'http://localhost')
      expect(parsedUrl.searchParams.get('page')).toBe('2')
      expect(parsedUrl.searchParams.get('limit')).toBe('5')
    })

    it('SVC-LIST-003 & 004: Mã hóa an toàn từ khóa tìm kiếm và lọc khoa', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } },
      }), { status: 200 }))

      await getAllBooks({ search: 'C++ & Python', facultyId: 'ee584419975de7543b8c2fd2' })

      const [url] = vi.mocked(fetch).mock.calls[0]!
      const parsedUrl = new URL(String(url), 'http://localhost')
      expect(parsedUrl.searchParams.get('search')).toBe('C++ & Python')
      expect(parsedUrl.searchParams.get('facultyId')).toBe('ee584419975de7543b8c2fd2')
    })

    it('SVC-LIST-004B: Gửi loại sách đến API trước khi phân trang', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 } },
      }), { status: 200 }))
      await getAllBooks({ page: 1, limit: 12, bookType: 'REFERENCE' })
      const [url] = vi.mocked(fetch).mock.calls[0]!
      const parsedUrl = new URL(String(url), 'http://localhost')
      expect(parsedUrl.searchParams.get('bookType')).toBe('REFERENCE')
    })

    it('SVC-LIST-005: Kết quả rỗng', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } },
      }), { status: 200 }))

      const result = await getAllBooks({ search: 'KhongTonTai123' })
      expect(result.items).toHaveLength(0)
      expect(result.meta.totalItems).toBe(0)
    })

    it('SVC-LIST-006: Ném BookApiError khi nhận 400 Bad Request', async () => {
      vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({
        status: 'error',
        message: 'Tham số trang không hợp lệ',
      }), { status: 400 }))

      await expect(getAllBooks({ page: 0 })).rejects.toThrow(BookApiError)
      await expect(getAllBooks({ page: 0 })).rejects.toMatchObject({
        status: 400,
        message: 'Tham số trang không hợp lệ',
      })
    })

    it('SVC-LIST-007: Ném BookApiError khi máy chủ lỗi 500', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Lỗi máy chủ nội bộ',
      }), { status: 500 }))

      await expect(getAllBooks()).rejects.toMatchObject({
        status: 500,
      })
    })

    it('SVC-LIST-008: Xử lý sự cố mạng (Fetch failure)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(getAllBooks()).rejects.toMatchObject({
        status: 0,
        message: expect.stringContaining('kết nối'),
      })
    })
  })

  describe('getBookById', () => {
    it('SVC-GET-001: Lấy chi tiết sách thành công và đính kèm Bearer token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        message: 'Chi tiết ấn phẩm',
        data: mockBook,
      }), { status: 200 }))

      const result = await getBookById(mockBook.bookId)

      expect(result.bookId).toBe(mockBook.bookId)
      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const headers = new Headers(options?.headers)
      expect(headers.get('Authorization')).toBe('Bearer mock-jwt-access-token')
    })

    it('SVC-GET-002: Báo lỗi 401 khi token không hợp lệ hoặc thiếu', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Chưa đăng nhập hoặc token không hợp lệ',
      }), { status: 401 }))

      await expect(getBookById(mockBook.bookId)).rejects.toMatchObject({
        status: 401,
        message: 'Chưa đăng nhập hoặc token không hợp lệ',
      })
    })

    it('SVC-GET-003: Báo lỗi 404 khi mã sách không tồn tại', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Sách không tồn tại',
      }), { status: 404 }))

      await expect(getBookById('000000000000000000000000')).rejects.toMatchObject({
        status: 404,
        message: 'Sách không tồn tại',
      })
    })

    it('SVC-GET-004: Báo lỗi khi mã sách rỗng', async () => {
      await expect(getBookById('')).rejects.toMatchObject({
        status: 400,
        message: 'Mã sách không hợp lệ.',
      })
    })
  })

  describe('createBook', () => {
    const payload: CreateBookPayload = {
      title: 'Giáo trình Kiến trúc Phần mềm',
      facultyId: 'ee584419975de7543b8c2fd2',
      authorIds: ['3028c4b741766ed91a3b43ac'],
      bookType: 'TEXTBOOK',
      totalCopies: 10,
      coverPrice: 80000,
    }

    it('SVC-POST-001: Tạo sách thành công (201 Created)', async () => {
      const createdBook: Book = {
        ...payload,
        bookId: '69cabe960354ac17e1a6b499',
        availableCopies: 10,
        isAvailableForCirculation: true,
      }

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        message: 'Thêm thành công',
        data: createdBook,
      }), { status: 201 }))

      const result = await createBook(payload)

      expect(result.bookId).toBe(createdBook.bookId)
      expect(result.availableCopies).toBe(10)
      const [, options] = vi.mocked(fetch).mock.calls[0]!
      expect(options?.method).toBe('POST')
      expect(JSON.parse(String(options?.body))).toEqual(payload)
    })

    it('SVC-POST-002: Bóc tách lỗi trường dữ liệu khi nhận 400 Validation Error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Dữ liệu không hợp lệ',
        data: [
          { field: 'title', message: 'Vui lòng nhập tên sách' },
          { field: 'coverPrice', message: 'Giá bìa không được âm' },
        ],
      }), { status: 400 }))

      try {
        await createBook({ ...payload, title: '', coverPrice: -10 })
        expect.unreachable('Hàm phải ném lỗi BookApiError')
      } catch (error) {
        expect(error).toBeInstanceOf(BookApiError)
        const err = error as BookApiError
        expect(err.status).toBe(400)
        expect(err.fields?.title).toBe('Vui lòng nhập tên sách')
        expect(err.fields?.coverPrice).toBe('Giá bìa không được âm')
      }
    })

    it('SVC-POST-003: Chặn tạo sách với mã 401 Unauthorized', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.',
      }), { status: 401 }))

      await expect(createBook(payload)).rejects.toMatchObject({
        status: 401,
      })
    })

    it('SVC-POST-004: Chặn tạo sách với mã 403 Forbidden', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Không đủ quyền truy cập',
      }), { status: 403 }))

      await expect(createBook(payload)).rejects.toMatchObject({
        status: 403,
        message: 'Không đủ quyền truy cập',
      })
    })

    it('SVC-POST-005: Ném lỗi khi máy chủ 500', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'error',
        message: 'Lỗi máy chủ nội bộ',
      }), { status: 500 }))

      await expect(createBook(payload)).rejects.toMatchObject({
        status: 500,
      })
    })
  })
})
