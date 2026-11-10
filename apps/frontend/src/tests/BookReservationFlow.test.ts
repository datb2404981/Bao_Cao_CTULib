import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Ref } from 'vue'
import BookCatalogView from '../views/BookCatalogView.vue'
import * as booksApi from '../services/book'
import * as facultyApi from '../services/faculty'
import * as authorApi from '../services/author'
import * as loansApi from '../services/loan'
import { currentUser } from '../services/auth'
import type { AuthUser } from '../services/auth'
import type { Book } from '../types/book'
import type { LoanRecord } from '../types/loan'

vi.mock('../services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth')>()
  const { ref } = await import('vue')
  return { ...actual, currentUser: ref(null) }
})
vi.mock('../services/book', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/book')>()
  return { ...actual, getAllBooks: vi.fn(), getBookById: vi.fn() }
})
vi.mock('../services/faculty', () => ({ getAllFaculties: vi.fn() }))
vi.mock('../services/author', () => ({ getAllAuthors: vi.fn() }))
vi.mock('../services/loan', () => ({ reserveBook: vi.fn() }))

const book: Book = {
  bookId: '507f1f77bcf86cd799439012', title: 'Giáo trình lập trình Web',
  bookType: 'TEXTBOOK', facultyId: '507f1f77bcf86cd799439013', authorIds: [],
  totalCopies: 3, availableCopies: 2, coverPrice: 100000, isAvailableForCirculation: true,
}
const loan: LoanRecord = {
  _id: '507f1f77bcf86cd799439099', bookId: book.bookId,
  readerId: '507f1f77bcf86cd799439011', status: 'Đặt lịch mượn',
  reservationDate: '2026-11-10T04:00:00.000Z',
  reservationExpiryDate: '2026-11-12T09:00:00.000Z',
}
const user = currentUser as Ref<AuthUser | null>

beforeEach(() => {
  vi.clearAllMocks()
  user.value = { accountId: loan.readerId, ctuIdentifier: 'B1234567', role: 'READER' }
  vi.mocked(booksApi.getAllBooks).mockResolvedValue({
    items: [book], meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 12 },
  })
  vi.mocked(booksApi.getBookById).mockResolvedValue(book)
  vi.mocked(facultyApi.getAllFaculties).mockResolvedValue([])
  vi.mocked(authorApi.getAllAuthors).mockResolvedValue([])
})
afterEach(() => { document.body.innerHTML = '' })

const openConfirmation = async (view: ReturnType<typeof mount<typeof BookCatalogView>>) => {
  await flushPromises()
  await view.get('.book-card .btn-view').trigger('click')
  await flushPromises()
  await view.get('.btn-borrow-action').trigger('click')
  await flushPromises()
}

describe('xác nhận đặt mượn SC06–SC07', () => {
  it('chỉ gửi một yêu cầu khi xác nhận, có thể quay lại xem sách, hiển thị hạn thực tế từ API', async () => {
    let resolveReservation!: (value: LoanRecord) => void
    vi.mocked(loansApi.reserveBook).mockReturnValue(new Promise((resolve) => { resolveReservation = resolve }))
    const view = mount(BookCatalogView, { attachTo: document.body })
    await openConfirmation(view)

    expect(loansApi.reserveBook).not.toHaveBeenCalled()
    expect(view.get('.reservation-dialog').text()).toContain('Xác nhận đặt mượn')
    await view.get('.reservation-dialog .dialog-footer .btn').trigger('click')
    await flushPromises()
    expect(view.get('.btn-borrow-action').exists()).toBe(true)
    await view.get('.btn-borrow-action').trigger('click')
    await flushPromises()

    const confirm = view.get('.reservation-dialog .btn.primary')
    await confirm.trigger('click')
    await confirm.trigger('click')
    expect(loansApi.reserveBook).toHaveBeenCalledExactlyOnceWith(book.bookId)
    expect(confirm.attributes('disabled')).toBeDefined()

    resolveReservation(loan)
    await flushPromises()
    expect(view.get('.reservation-dialog').text()).toContain('Đặt mượn thành công')
    expect(view.get('.reservation-deadline').text()).toContain('12/11/26')
    await view.get('.reservation-dialog .btn.primary').trigger('click')
    expect(view.emitted('navigate')?.[0]).toEqual(['my-loans'])
    view.unmount()
  })

  it('cho thử lại khi máy chủ từ chối, không báo thành công sai', async () => {
    vi.mocked(loansApi.reserveBook).mockRejectedValueOnce(new Error('Hết bản sách'))
      .mockResolvedValueOnce(loan)
    const view = mount(BookCatalogView, { attachTo: document.body })
    await openConfirmation(view)
    await view.get('.reservation-dialog .btn.primary').trigger('click')
    await flushPromises()
    expect(view.get('.reservation-dialog [role="alert"]').text()).toContain('Hết bản sách')
    expect(view.get('.reservation-dialog').text()).not.toContain('Đặt mượn thành công')
    await view.get('.reservation-dialog .btn.primary').trigger('click')
    await flushPromises()
    expect(loansApi.reserveBook).toHaveBeenCalledTimes(2)
    expect(view.get('.reservation-dialog').text()).toContain('Đặt mượn thành công')
    view.unmount()
  })
})
