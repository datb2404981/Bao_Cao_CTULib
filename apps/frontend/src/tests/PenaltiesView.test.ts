import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PenaltiesView from '../views/PenaltiesView.vue'
import * as penaltiesApi from '../services/penalty'
import type { PenaltyDetail, PenaltyPage } from '../types/penalty'

vi.mock('../services/penalty', () => ({
  getPenalties: vi.fn(), getPenaltyDetail: vi.fn(), collectPenalty: vi.fn(),
}))

const pending: PenaltyDetail = {
  penaltyId: '507f1f77bcf86cd799439091', loanId: '507f1f77bcf86cd799439092',
  readerAccountId: '507f1f77bcf86cd799439093', issuedDate: '2026-11-10T08:00:00Z',
  overdueDays: 2, appliedCoverPrice: 100000, damagePercentage: 0, overdueFee: 10000,
  damageFee: 0, totalPenalty: 10000, violationNote: null, paymentStatus: 'PENDING',
  paymentDate: null, collectorAccountId: null, amountCollected: 0, paymentMethod: null,
}
const paid: PenaltyDetail = {
  ...pending, paymentStatus: 'PAID', amountCollected: 10000,
  paymentDate: '2026-11-10T09:00:00Z', collectorAccountId: '507f1f77bcf86cd799439094',
  paymentMethod: 'CASH',
}
const pageOf = (items: PenaltyDetail[]): PenaltyPage => ({
  items, meta: { totalItems: items.length, totalPages: items.length ? 1 : 0, currentPage: 1, limit: 10 },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(penaltiesApi.getPenalties).mockResolvedValue(pageOf([pending]))
  vi.mocked(penaltiesApi.getPenaltyDetail).mockResolvedValue(pending)
  vi.mocked(penaltiesApi.collectPenalty).mockResolvedValue({
    penalty: paid, loan: { loanId: pending.loanId, status: 'Đã trả' }, isBorrowingBlocked: false,
  })
})

describe('quản lý phiếu phạt', () => {
  it('khóa bộ lọc và lựa chọn phiếu khi đang ghi nhận thanh toán', async () => {
    let finishPayment!: (value: { penalty: PenaltyDetail; loan: { loanId: string; status: string }; isBorrowingBlocked: boolean }) => void
    vi.mocked(penaltiesApi.collectPenalty).mockReturnValue(new Promise(resolve => { finishPayment = resolve }))
    const view = mount(PenaltiesView)
    await flushPromises()
    await view.get('.loan-table button').trigger('click')
    await flushPromises()
    await view.get('.loan-detail .loan-actions .btn.primary').trigger('click')
    await view.get('.loan-confirm-box input[type="checkbox"]').setValue(true)
    await view.get('.loan-confirm-box').trigger('submit')

    expect(penaltiesApi.collectPenalty).toHaveBeenCalledExactlyOnceWith(pending.penaltyId, 10000)
    expect(view.findAll('.loan-filter-panel input, .loan-filter-panel select').every(field => field.attributes('disabled') !== undefined)).toBe(true)
    expect(view.get('.loan-table button').attributes('disabled')).toBeDefined()
    expect(view.get('.loan-section-heading button').attributes('disabled')).toBeDefined()
    await view.get('.loan-filter-panel').trigger('submit')
    await view.get('.loan-table button').trigger('click')
    expect(penaltiesApi.getPenalties).toHaveBeenCalledTimes(1)
    expect(view.get('.loan-detail').text()).toContain(pending.penaltyId.slice(-8).toUpperCase())

    finishPayment({ penalty: paid, loan: { loanId: pending.loanId, status: 'Đã trả' }, isBorrowingBlocked: false })
    await flushPromises()
    expect(view.get('.loan-detail').text()).toContain('Đã thanh toán')
    view.unmount()
  })

  it('giữ chi tiết biên nhận vừa thu khi phiếu rời khỏi bộ lọc Chờ thanh toán', async () => {
    const view = mount(PenaltiesView)
    await flushPromises()
    await view.get('select').setValue('PENDING')
    await view.get('form.loan-filter-panel').trigger('submit')
    await flushPromises()
    await view.get('.loan-table button').trigger('click')
    await flushPromises()
    await view.get('.loan-detail .loan-actions .btn.primary').trigger('click')
    await view.get('.loan-confirm-box input[type="checkbox"]').setValue(true)
    vi.mocked(penaltiesApi.getPenalties).mockResolvedValue(pageOf([]))
    await view.get('.loan-confirm-box').trigger('submit')
    await flushPromises()

    expect(penaltiesApi.collectPenalty).toHaveBeenCalledExactlyOnceWith(pending.penaltyId, 10000)
    expect(view.text()).toContain('Không có phiếu phạt phù hợp')
    expect(view.get('.loan-detail').text()).toContain('Đã thanh toán')
    expect(view.get('.loan-detail').text()).toContain('Đã thu')
    await view.get('.loan-detail button').trigger('click')
    expect(view.find('.loan-detail').exists()).toBe(false)
    view.unmount()
  })
})
