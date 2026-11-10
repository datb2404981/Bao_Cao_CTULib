import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import BookManagementView from '../views/BookManagementView.vue'
import * as booksApi from '../services/book'
import type { Book } from '../types/book'

vi.mock('../services/auth', async (original) => ({
  ...await original<typeof import('../services/auth')>(),
  currentUser: ref({ accountId: '507f1f77bcf86cd799439011', ctuIdentifier: 'CB00001', role: 'EMPLOYEE', permissions: ['MANAGE_BOOKS'] }),
}))
vi.mock('../services/book', async (original) => ({
  ...await original<typeof import('../services/book')>(),
  getAllBooks: vi.fn(), createBook: vi.fn(), updateBook: vi.fn(), adjustBookInventory: vi.fn(),
}))
vi.mock('../services/author', () => ({ getAllAuthors: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439013', fullName: 'Tác giả A' }]) }))
vi.mock('../services/faculty', () => ({ getAllFaculties: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439014', facultyName: 'CNTT' }]) }))

const book: Book = {
  bookId: '507f1f77bcf86cd799439012', title: 'Lập trình Web', bookType: 'TEXTBOOK',
  facultyId: '507f1f77bcf86cd799439014', authorIds: ['507f1f77bcf86cd799439013'],
  totalCopies: 7, availableCopies: 2, coverPrice: 150000, isAvailableForCirculation: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(booksApi.getAllBooks).mockResolvedValue({ items: [book], meta: { currentPage: 1, totalPages: 1, totalItems: 1, limit: 10 } })
  vi.mocked(booksApi.adjustBookInventory).mockResolvedValue({ ...book, totalCopies: 8, availableCopies: 3 })
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open') })
})

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = '' })

const openInventory = async () => {
  const view = mount(BookManagementView, { attachTo: document.body })
  await flushPromises()
  await view.get('button[aria-label="Điều chỉnh tồn kho Lập trình Web"]').trigger('click')
  await flushPromises()
  return view
}

describe('điều chỉnh tồn kho SC26', () => {
  it('chặn số 0, số thập phân, giảm vượt số khả dụng và lý do dưới 5 ký tự', async () => {
    const view = await openInventory()
    const quantity = view.get('dialog input[type="number"]')
    const reason = view.get('dialog textarea')
    await reason.setValue('Kiểm kê định kỳ')

    for (const [value, expected] of [
      ['0', 'số nguyên khác 0'],
      ['1.5', 'số nguyên khác 0'],
      ['-3', 'Chỉ có 2 bản khả dụng'],
    ]) {
      await quantity.setValue(value)
      await view.get('dialog form').trigger('submit')
      expect(view.get('dialog [role="alert"]').text()).toContain(expected)
    }

    await quantity.setValue('-2')
    await reason.setValue('abc')
    await view.get('dialog form').trigger('submit')
    expect(view.get('dialog [role="alert"]').text()).toContain('ít nhất 5 ký tự')
    expect(booksApi.adjustBookInventory).not.toHaveBeenCalled()
    view.unmount()
  })

  it('khóa đóng dialog và chặn gửi trùng khi chờ API; sau thành công tải lại bảng', async () => {
    let complete!: (value: Book) => void
    vi.mocked(booksApi.adjustBookInventory).mockReturnValue(new Promise(resolve => { complete = resolve }))
    const view = await openInventory()
    await view.get('dialog input[type="number"]').setValue('-2')
    await view.get('dialog textarea').setValue(' Kiểm kê thiếu sách ')
    await view.get('dialog form').trigger('submit')
    await view.get('dialog form').trigger('submit')

    expect(booksApi.adjustBookInventory).toHaveBeenCalledExactlyOnceWith(book.bookId, -2, 'Kiểm kê thiếu sách')
    expect(view.get('dialog button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(view.get('dialog button[type="button"]').attributes('disabled')).toBeDefined()

    complete({ ...book, totalCopies: 5, availableCopies: 0 })
    await flushPromises()
    expect(view.find('dialog').exists()).toBe(false)
    expect(view.text()).toContain('Đã giảm 2 bản sách')
    expect(booksApi.getAllBooks).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('giữ nguyên dữ liệu nhập khi API lỗi để người dùng thử lại', async () => {
    vi.mocked(booksApi.adjustBookInventory).mockRejectedValueOnce(new Error('Số sách khả dụng không đủ để giảm kho'))
    const view = await openInventory()
    await view.get('dialog input[type="number"]').setValue('-2')
    await view.get('dialog textarea').setValue('Kiểm kê giảm tồn')
    await view.get('dialog form').trigger('submit')
    await flushPromises()
    expect(view.get('dialog [role="alert"]').text()).toContain('Số sách khả dụng không đủ')
    expect((view.get('dialog input[type="number"]').element as HTMLInputElement).value).toBe('-2')
    await view.get('dialog form').trigger('submit')
    await flushPromises()
    expect(booksApi.adjustBookInventory).toHaveBeenCalledTimes(2)
    expect(view.find('dialog').exists()).toBe(false)
    view.unmount()
  })
})
