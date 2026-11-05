import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookCatalogView from '../views/BookCatalogView.vue'
import * as bookService from '@/services/book'

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

  it('synchronizes totalItems and pagination when bookType filter is active', async () => {
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
      meta: { totalItems: 24, totalPages: 2, currentPage: 1, limit: 12 },
    })

    const wrapper = mount(BookCatalogView)
    await flushPromises()

    expect(wrapper.find('.results-line').text()).toContain('24')

    // Chọn lọc sang loại sách REFERENCE (không khớp sách nào trong trang)
    const kindSelect = wrapper.find('select.kind-select')
    await kindSelect.setValue('REFERENCE')
    await wrapper.find('form.filters').trigger('submit.prevent')
    await flushPromises()

    // Số đếm đồng bộ hiển thị 0, khớp với empty state
    expect(wrapper.find('.results-line').text()).toContain('0')
    expect(wrapper.find('.results-line').text()).not.toContain('24')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
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

