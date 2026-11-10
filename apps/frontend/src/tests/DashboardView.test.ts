import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DashboardView from '../views/DashboardView.vue'
import { getDashboardStatistics } from '../services/dashboard'
import type { DashboardStatistics } from '../services/dashboard'

vi.mock('../services/dashboard', () => ({ getDashboardStatistics: vi.fn() }))

const stats: DashboardStatistics = {
  books: {
    totalTitles: 420, totalCopies: 1560, availableCopies: 1280, outOfStockCount: 1,
    outOfStockList: [{ _id: 'b01', title: 'Giáo trình lập trình', totalCopies: 5, availableCopies: 0, facultyId: { _id: 'f01', facultyName: 'CNTT' } }],
  },
  readers: { totalReaders: 860 },
  loans: { borrowingCount: 226, overdueCount: 18, pendingPenaltyCount: 12 },
  penalties: { unpaidPenalty: 25000, collectedPenalty: 140000, totalRevenue: 140000 },
}

beforeEach(() => { vi.resetAllMocks() })

describe('tổng quan vận hành SC11', () => {
  it('chỉ hiển thị số thực trả về từ API và điều hướng đến danh sách phiếu', async () => {
    vi.mocked(getDashboardStatistics).mockResolvedValue(stats)
    const view = mount(DashboardView)
    await flushPromises()
    expect(getDashboardStatistics).toHaveBeenCalledTimes(1)
    expect(view.text()).toContain('1.280')
    expect(view.text()).toContain('Giáo trình lập trình')
    expect(view.text()).toContain('CNTT')
    expect(view.text()).toContain('25.000')
    await view.get('.dashboard-section-head .btn').trigger('click')
    expect(view.emitted('navigate')).toEqual([['loans']])
    view.unmount()
  })

  it('thông báo lỗi, thử lại và hiển thị dữ liệu sau khi máy chủ hoạt động', async () => {
    vi.mocked(getDashboardStatistics).mockRejectedValueOnce(new Error('Máy chủ tạm thời không khả dụng')).mockResolvedValueOnce({
      ...stats, books: { ...stats.books, outOfStockCount: 0, outOfStockList: [] },
    })
    const view = mount(DashboardView)
    await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Máy chủ tạm thời không khả dụng')
    expect(view.find('.dashboard-metrics').exists()).toBe(false)
    await view.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(view.text()).toContain('Hiện không có đầu sách hết bản khả dụng')
    expect(view.find('[role="alert"]').exists()).toBe(false)
    view.unmount()
  })
})
