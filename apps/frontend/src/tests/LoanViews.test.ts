import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MyLoansView from '../views/MyLoansView.vue'
import LoansManagementView from '../views/LoansManagementView.vue'
import * as api from '../services/loan'
import type { LoanPage, LoanRecord, PenaltyRecord } from '../types/loan'

vi.mock('../services/loan', () => ({
  getMyLoans: vi.fn(), getAllLoans: vi.fn(), getLoanPenalty: vi.fn(),
  cancelLoan: vi.fn(), handoverLoan: vi.fn(), returnLoan: vi.fn(), collectLoanPenalty: vi.fn(),
}))

const reserved: LoanRecord = {
  _id: '507f1f77bcf86cd799439099', readerId: '507f1f77bcf86cd799439011',
  bookId: '507f1f77bcf86cd799439012', status: 'Đặt lịch mượn',
  reservationDate: '2026-11-08T08:00:00.000Z', reservationExpiryDate: '2099-11-08T12:00:00.000Z',
}
const returned: LoanRecord = { ...reserved, status: 'Chờ nộp phạt', actualReturnDate: '2026-11-09T08:00:00.000Z' }
const overdue: LoanRecord = { ...reserved, status: 'Quá hạn', dueDate: '2026-11-07T08:00:00.000Z' }
const penalty: PenaltyRecord = {
  _id: '507f1f77bcf86cd799439098', loanRecordId: reserved._id,
  overdueFee: 10000, damageFee: 15000, totalPenalty: 25000, paymentStatus: 'Chờ thanh toán',
}
const pageOf = (records: LoanRecord[]): LoanPage => ({
  records, pagination: { page: 1, limit: 5, total: records.length, totalPages: 1 },
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.getMyLoans).mockResolvedValue(pageOf([reserved]))
  vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([reserved]))
  vi.mocked(api.getLoanPenalty).mockResolvedValue(null)
  vi.mocked(api.cancelLoan).mockResolvedValue({ ...reserved, status: 'Đã huỷ' })
})

describe('phiếu mượn của độc giả', () => {
  it('đặt tên cột thao tác và phân biệt từng nút chi tiết', async () => {
    const another: LoanRecord = { ...reserved, _id: '507f1f77bcf86cd799439088', bookTitle: 'Lập trình Web' }
    vi.mocked(api.getMyLoans).mockResolvedValue(pageOf([reserved, another]))
    const view = mount(MyLoansView)
    await flushPromises()
    expect(view.findAll('.loan-table th').at(-1)?.text()).toBe('Thao tác')
    expect(view.findAll('.loan-table tbody button').map(button => button.attributes('aria-label'))).toEqual([
      'Xem chi tiết phiếu mượn #1',
      'Xem chi tiết phiếu mượn Lập trình Web',
    ])
    view.unmount()
  })

  it('hiển thị lịch sử và chỉ hủy khi độc giả xác nhận', async () => {
    const view = mount(MyLoansView)
    await flushPromises()
    expect(api.getMyLoans).toHaveBeenCalledWith({ page: 1, limit: 5 })
    expect(view.text()).toContain('Phiếu mượn của tôi')
    await view.get('.loan-table button').trigger('click')
    await flushPromises()
    expect(api.getLoanPenalty).toHaveBeenCalledWith(reserved._id)
    await view.get('.loan-actions .btn.danger').trigger('click')
    expect(api.cancelLoan).not.toHaveBeenCalled()
    await view.get('.loan-confirm-box .btn.danger').trigger('click')
    await flushPromises()
    expect(api.cancelLoan).toHaveBeenCalledExactlyOnceWith(reserved._id)
    expect(view.text()).toContain('Đã hủy đặt giữ chỗ')
    view.unmount()
  })

  it('giữ nguyên phiếu đang hủy và khóa thao tác đổi phiếu, bộ lọc, làm mới khi API chưa xong', async () => {
    const another: LoanRecord = { ...reserved, _id: '507f1f77bcf86cd799439088' }
    vi.mocked(api.getMyLoans).mockResolvedValue(pageOf([reserved, another]))
    let finishCancel!: (value: LoanRecord) => void
    vi.mocked(api.cancelLoan).mockReturnValue(new Promise(resolve => { finishCancel = resolve }))
    const view = mount(MyLoansView)
    await flushPromises()
    await view.findAll('.loan-table button')[0]!.trigger('click')
    await flushPromises()
    await view.get('.loan-detail .btn.danger').trigger('click')
    await view.get('.loan-confirm-box .btn.danger').trigger('click')

    expect(api.cancelLoan).toHaveBeenCalledExactlyOnceWith(reserved._id)
    expect(view.get('.loan-heading button').attributes('disabled')).toBeDefined()
    expect(view.get('.loan-inline-filter select').attributes('disabled')).toBeDefined()
    expect(view.get('.loan-detail > .loan-actions button').attributes('disabled')).toBeDefined()
    expect(view.findAll('.loan-table button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    await view.findAll('.loan-table button')[1]!.trigger('click')
    await view.get('.loan-detail > .loan-actions button').trigger('click')
    await view.get('.loan-heading button').trigger('click')
    expect(view.get('.loan-detail').text()).toContain('Chi tiết phiếu mượn')
    expect(api.getMyLoans).toHaveBeenCalledTimes(1)

    finishCancel({ ...reserved, status: 'Đã huỷ' })
    await flushPromises()
    expect(view.find('.loan-detail').exists()).toBe(false)
    expect(view.text()).toContain('Đã hủy đặt giữ chỗ')
    expect(api.getMyLoans).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('loại bỏ phản hồi phiếu phạt cũ khi đóng chi tiết và mở phiếu khác', async () => {
    const another: LoanRecord = { ...reserved, _id: '507f1f77bcf86cd799439088', bookTitle: 'Lập trình Web' }
    vi.mocked(api.getMyLoans).mockResolvedValue(pageOf([reserved, another]))
    let finishPenalty!: (value: PenaltyRecord | null) => void
    vi.mocked(api.getLoanPenalty)
      .mockReturnValueOnce(new Promise(resolve => { finishPenalty = resolve }))
      .mockResolvedValueOnce(null)
    const view = mount(MyLoansView)
    await flushPromises()
    await view.findAll('.loan-table tbody tr:not(.loan-expanded-row) > td:last-child button')[0]!.trigger('click')
    expect(view.get('.loan-expanded-row').element.previousElementSibling?.textContent).toContain('1')
    await view.get('.loan-detail > .loan-actions button:last-child').trigger('click')
    await view.findAll('.loan-table tbody tr:not(.loan-expanded-row) > td:last-child button')[1]!.trigger('click')
    await flushPromises()
    finishPenalty(penalty)
    await flushPromises()
    expect(view.get('.loan-detail').text()).toContain('Lập trình Web')
    expect(view.get('.loan-detail').text()).not.toContain('25.000')
    expect(view.get('.loan-expanded-row').element.previousElementSibling?.textContent).toContain('Lập trình Web')
    view.unmount()
  })
})

describe('quản lý mượn trả của thủ thư', () => {
  it('đặt tên cột thao tác và phân biệt từng nút xử lý', async () => {
    const another: LoanRecord = { ...reserved, _id: '507f1f77bcf86cd799439088', readerCode: 'B2200001' }
    vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([reserved, another]))
    const view = mount(LoansManagementView)
    await flushPromises()
    expect(view.findAll('.loan-table th').at(-1)?.text()).toBe('Thao tác')
    expect(view.findAll('.loan-table tbody button').map(button => button.attributes('aria-label'))).toEqual([
      'Xử lý phiếu mượn #1',
      'Xử lý phiếu mượn B2200001',
    ])
    view.unmount()
  })

  it('giữ nguyên phiếu đang xử lý và chặn thao tác khác khi chờ API', async () => {
    const another = { ...reserved, _id: '507f1f77bcf86cd799439088' }
    vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([reserved, another]))
    let finishCancel!: (value: LoanRecord) => void
    vi.mocked(api.cancelLoan).mockReturnValue(new Promise(resolve => { finishCancel = resolve }))
    const view = mount(LoansManagementView)
    await flushPromises()
    await view.findAll('.loan-table button')[0]!.trigger('click')
    await flushPromises()
    await view.get('.loan-detail .btn.danger').trigger('click')
    await view.get('.loan-check input').setValue(true)
    await view.get('.loan-confirm-box').trigger('submit')
    expect(api.cancelLoan).toHaveBeenCalledExactlyOnceWith(reserved._id)
    expect(view.get('.loan-confirm-box button[type=submit]').attributes('disabled')).toBeDefined()
    expect(view.findAll('.loan-table button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(view.get('.loan-heading button').attributes('disabled')).toBeDefined()
    await view.findAll('.loan-table button')[1]!.trigger('click')
    await view.get('.loan-filter-panel').trigger('submit')
    expect(view.get('.loan-detail').text()).toContain('Chi tiết phiếu mượn')
    expect(api.getAllLoans).toHaveBeenCalledTimes(1)
    finishCancel({ ...reserved, status: 'Đã huỷ' })
    await flushPromises()
    expect(api.cancelLoan).toHaveBeenCalledTimes(1)
    expect(api.getAllLoans).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('không hiển thị tiền phạt trả về muộn của phiếu trước khi chuyển phiếu', async () => {
    const another = { ...reserved, _id: '507f1f77bcf86cd799439088', status: 'Chờ nộp phạt' as const, bookTitle: 'Lập trình Web' }
    vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([reserved, another]))
    let finishFirst!: (value: PenaltyRecord | null) => void
    vi.mocked(api.getLoanPenalty)
      .mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve }))
      .mockResolvedValueOnce(null)
    const view = mount(LoansManagementView)
    await flushPromises()
    await view.findAll('.loan-table tbody tr:not(.loan-expanded-row) > td:last-child button')[0]!.trigger('click')
    expect(view.get('.loan-expanded-row').element.previousElementSibling?.textContent).toContain('1')
    await view.findAll('.loan-table tbody tr:not(.loan-expanded-row) > td:last-child button')[1]!.trigger('click')
    await flushPromises()
    finishFirst(penalty)
    await flushPromises()
    expect(view.get('.loan-detail').text()).toContain('Lập trình Web')
    expect(view.get('.loan-detail').text()).not.toContain('25.000')
    expect(view.get('.loan-expanded-row').element.previousElementSibling?.textContent).toContain('Lập trình Web')
    view.unmount()
  })

  it('tiếp nhận trả sách, xác thực tỷ lệ hư hại và hiển thị phí thực trả từ API', async () => {
    vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([overdue]))
    vi.mocked(api.returnLoan).mockResolvedValue({
      loan: returned, penaltyRecord: penalty,
      overdueDays: 2, overdueFee: 10000, damageFee: 15000, totalPenalty: 25000,
    })
    const view = mount(LoansManagementView)
    await flushPromises()
    await view.get('.loan-table button').trigger('click')
    await flushPromises()
    const returnButton = view.findAll('.loan-detail > .loan-actions button').find(btn => btn.text() === 'Tiếp nhận trả')
    expect(returnButton).toBeDefined()
    await returnButton!.trigger('click')
    await view.get('input[type=number]').setValue('15.5')
    await view.get('.loan-check input').setValue(true)
    expect(view.get('.loan-confirm-box button[type=submit]').attributes('disabled')).toBeDefined()
    await view.get('input[type=number]').setValue('15')
    expect(api.returnLoan).not.toHaveBeenCalled()
    await view.get('.loan-check input').setValue(true)
    await view.get('.loan-confirm-box button[type=submit]').trigger('submit')
    await flushPromises()
    expect(api.returnLoan).toHaveBeenCalledWith(overdue._id, { damagePercentage: 15 })
    expect(view.text()).toContain('25.000')
    view.unmount()
  })

  it('chỉ thu tiền khi có phiếu phạt chờ thanh toán và đã xác nhận', async () => {
    vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([returned]))
    vi.mocked(api.getLoanPenalty).mockResolvedValue(penalty)
    vi.mocked(api.collectLoanPenalty).mockResolvedValue({
      loan: { ...returned, status: 'Đã trả' },
      penalty: { ...penalty, paymentStatus: 'Đã thanh toán' },
      isBorrowingBlocked: false, message: 'Thu tiền phạt thành công',
    })
    const view = mount(LoansManagementView)
    await flushPromises()
    await view.get('.loan-table button').trigger('click')
    await flushPromises()
    const collectButton = view.findAll('.loan-detail > .loan-actions button').find(btn => btn.text() === 'Xác nhận thu tiền')
    expect(collectButton?.attributes('disabled')).toBeUndefined()
    await collectButton!.trigger('click')
    expect(view.text()).toContain('25.000')
    expect(view.get('.loan-confirm-box button[type=submit]').attributes('disabled')).toBeDefined()
    await view.get('.loan-check input').setValue(true)
    await view.get('.loan-confirm-box button[type=submit]').trigger('submit')
    await flushPromises()
    expect(api.collectLoanPenalty).toHaveBeenCalledExactlyOnceWith(returned._id)
    view.unmount()
  })

  it('tìm kiếm theo mã sinh viên / cán bộ và tên sách, hiển thị đúng trên bảng', async () => {
    const richLoan: LoanRecord = {
      ...reserved,
      readerCode: 'B2203456',
      readerName: 'Nguyễn Văn B',
      bookTitle: 'Cấu trúc dữ liệu và giải thuật',
    }
    vi.mocked(api.getAllLoans).mockResolvedValue(pageOf([richLoan]))
    const view = mount(LoansManagementView)
    await flushPromises()

    expect(view.text()).toContain('B2203456')
    expect(view.text()).toContain('Cấu trúc dữ liệu và giải thuật')
    expect(view.text()).not.toContain(reserved.readerId)
    expect(view.text()).not.toContain(reserved.bookId)

    const inputs = view.findAll('.loan-filter-panel input[type="text"]')
    await inputs[0]!.setValue('B2203456')
    await inputs[1]!.setValue('Cấu trúc dữ liệu')
    await view.get('.loan-filter-panel').trigger('submit')
    await flushPromises()

    expect(api.getAllLoans).toHaveBeenLastCalledWith({
      page: 1,
      limit: 5,
      readerCode: 'B2203456',
      bookTitle: 'Cấu trúc dữ liệu',
    })
    view.unmount()
  })
})
