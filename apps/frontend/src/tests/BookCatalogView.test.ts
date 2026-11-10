import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookCatalogView from '../views/BookCatalogView.vue'
import * as bookService from '@/services/book'
import * as facultyService from '../services/faculty'
import * as authorService from '../services/author'

vi.mock('../services/faculty', () => ({ getAllFaculties: vi.fn() }))
vi.mock('../services/author', () => ({ getAllAuthors: vi.fn() }))

vi.mock('@/services/book', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/book')>()
  return {
    ...actual,
    getAllBooks: vi.fn(),
  }
})

describe('BookCatalogView.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(facultyService.getAllFaculties).mockResolvedValue([])
    vi.mocked(authorService.getAllAuthors).mockResolvedValue([])
  })

  it('displays loading state while waiting for API', () => {
    vi.spyOn(bookService, 'getAllBooks').mockReturnValue(new Promise(() => {})) // pending promise
    const wrapper = mount(BookCatalogView)
    expect(wrapper.find('.loading-skeleton, .spinner').exists()).toBe(true)
  })

  it('renders book cards on successful API response', async () => {
    vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
      items: [
        {
          bookId: '56e6630ff48c0647904890f3',
          title: 'Lập trình Web với Node.js và TypeScript',
          bookType: 'TEXTBOOK',
          facultyId: 'ee584419975de7543b8c2fd2',
          authorIds: ['3028c4b741766ed91a3b43ac'],
          totalCopies: 20,
          availableCopies: 15,
          coverPrice: 120000,
          isAvailableForCirculation: true,
        },
      ],
      meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()

    expect(wrapper.findAll('.book-card').length).toBe(1)
    expect(wrapper.text()).toContain('Lập trình Web với Node.js và TypeScript')
  })

  it('dùng ID khoa thực tế từ API làm tùy chọn lọc và tên hiển thị', async () => {
    vi.mocked(facultyService.getAllFaculties).mockResolvedValue([
      { _id: '69cabe960354ac17e1a6b451', facultyName: 'Khoa Dữ liệu thực tế' },
    ])
    vi.mocked(authorService.getAllAuthors).mockResolvedValue([
      { _id: '69cabe960354ac17e1a6b452', fullName: 'Tác giả thực tế' },
    ])
    vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
      items: [{ bookId: '69cabe960354ac17e1a6b453', title: 'Sách thật', bookType: 'TEXTBOOK',
        facultyId: '69cabe960354ac17e1a6b451', authorIds: ['69cabe960354ac17e1a6b452'],
        totalCopies: 2, availableCopies: 1, coverPrice: 0, isAvailableForCirculation: true }],
      meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()
    expect(wrapper.get('select.faculty-select').text()).toContain('Khoa Dữ liệu thực tế')
    expect(wrapper.get('select.faculty-select').html()).toContain('69cabe960354ac17e1a6b451')
    expect(wrapper.text()).toContain('Khoa Dữ liệu thực tế')
  })

  it('hiện cảnh báo và cho tải lại khi danh mục khoa bị lỗi', async () => {
    const facultyFetch = vi.mocked(facultyService.getAllFaculties)
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce([{ _id: '69cabe960354ac17e1a6b451', facultyName: 'Khoa đã tải lại' }])
    vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
      items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()
    expect(wrapper.get('.notice.warning').text()).toContain('Không tải được')
    await wrapper.get('.notice.warning button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.notice.warning').exists()).toBe(false)
    expect(facultyFetch).toHaveBeenCalledTimes(2)
  })

  it('renders empty-state when no books match filters', async () => {
    vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
      items: [],
      meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('Không tìm thấy sách phù hợp')
  })

  it('renders error banner and allows retry when API throws error', async () => {
    const getAllSpy = vi.spyOn(bookService, 'getAllBooks')
      .mockRejectedValueOnce(new bookService.BookApiError('Lỗi máy chủ nội bộ', 500))
      .mockResolvedValueOnce({
        items: [],
        meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 },
      })

    const wrapper = mount(BookCatalogView)
    await flushPromises()

    expect(wrapper.find('.error-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('Lỗi máy chủ nội bộ')

    // Click Retry
    await wrapper.find('button.btn-retry').trigger('click')
    await flushPromises()

    expect(getAllSpy).toHaveBeenCalledTimes(2)
  })

  it('uses server-side totals and pagination for a bookType filter', async () => {
    const textbook = {
      bookId: '56e6630ff48c0647904890f3',
      title: 'Lập trình Web với Node.js và TypeScript',
      bookType: 'TEXTBOOK' as const,
      facultyId: 'ee584419975de7543b8c2fd2',
      authorIds: ['3028c4b741766ed91a3b43ac'],
      totalCopies: 20,
      availableCopies: 15,
      coverPrice: 120000,
      isAvailableForCirculation: true,
    }
    const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockImplementation(async (params) => params?.bookType === 'REFERENCE' ? {
      items: [{ ...textbook, bookId: '66e6630ff48c0647904890f3', title: 'Tài liệu chuyên khảo', bookType: 'REFERENCE' }],
      meta: { totalItems: 13, totalPages: 2, currentPage: 1, limit: 12 },
    } : {
      items: [
        textbook,
      ],
      meta: { totalItems: 24, totalPages: 2, currentPage: 1, limit: 12 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()

    expect(wrapper.find('.results-line').text()).toContain('24')

    // Bộ lọc truyền đến server, kết quả không phụ thuộc các sách của trang trước.
    const kindSelect = wrapper.find('select.kind-select')
    await kindSelect.setValue('REFERENCE')
    await wrapper.find('form.filters').trigger('submit.prevent')
    await flushPromises()

    expect(getAllSpy).toHaveBeenCalledWith(expect.objectContaining({ bookType: 'REFERENCE', page: 1 }))
    expect(wrapper.find('.results-line').text()).toContain('13')
    expect(wrapper.find('.results-line').text()).not.toContain('24')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.text()).toContain('Tài liệu chuyên khảo')
    expect(wrapper.find('.pagination-bar').exists()).toBe(true)
  })

  it('ignores stale API responses when the search changes during a request', async () => {
    let resolveFirst!: (value: Awaited<ReturnType<typeof bookService.getAllBooks>>) => void
    const first = new Promise<Awaited<ReturnType<typeof bookService.getAllBooks>>>((resolve) => { resolveFirst = resolve })
    const newest = {
      items: [{
        bookId: '56e6630ff48c0647904890f3', title: 'Kết quả mới', bookType: 'TEXTBOOK' as const,
        facultyId: 'ee584419975de7543b8c2fd2', authorIds: [], totalCopies: 2,
        availableCopies: 2, coverPrice: 0, isAvailableForCirculation: true,
      }],
      meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
    }
    const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockReturnValueOnce(first).mockResolvedValue(newest)
    const wrapper = mount(BookCatalogView)
    await wrapper.find('input[type="search"]').setValue('Kết quả mới')
    await wrapper.find('form.filters').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.text()).toContain('Kết quả mới')
    resolveFirst({ items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 } })
    await flushPromises()
    expect(wrapper.text()).toContain('Kết quả mới')
    expect(wrapper.find('.results-line').text()).toContain('1')
    expect(getAllSpy).toHaveBeenCalledTimes(2)
  })

  it('automatically triggers search on debounce without clicking submit', async () => {
    const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
      items: [],
      meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()
    expect(getAllSpy).toHaveBeenCalledTimes(1)

    const searchInput = wrapper.find('input[type="search"]')
    await searchInput.setValue('Học máy')

    // Chờ 400ms (vượt quá 300ms debounce)
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()

    expect(getAllSpy).toHaveBeenCalledTimes(2)
  })
})

