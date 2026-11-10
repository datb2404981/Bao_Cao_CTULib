import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccountsManagementView from '../views/AccountsManagementView.vue'
import { getAccounts, updateAccount } from '../services/account'
import type { AccountsResult, AccountRow } from '../types/account'

vi.mock('../services/account', () => ({ getAccounts: vi.fn(), updateAccount: vi.fn() }))

const row: AccountRow = { _id: '507f1f77bcf86cd799439011', ctuIdentifier: 'B2404981', email: 'student@ctu.edu.vn', role: 'READER', isActive: true, fullName: 'Nguyễn Văn An' }
const result = (items: AccountRow[], totalItems = items.length, totalPages = 1): AccountsResult => ({ items, meta: { totalItems, totalPages, currentPage: 1, limit: 10 } })

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.mocked(getAccounts).mockResolvedValue(result([row]))
  vi.mocked(updateAccount).mockResolvedValue(row)
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open') })
})

describe('quản lý tài khoản SC23–SC24', () => {
  it('lọc theo họ tên, vai trò, trạng thái và truyền đúng các tham số API', async () => {
    const view = mount(AccountsManagementView)
    await flushPromises()
    expect(view.text()).toContain('Nguyễn Văn An')
    await view.get('input[type=search]').setValue('  Nguyễn Văn  ')
    await view.get('select').setValue('READER')
    await flushPromises()
    await view.findAll('select')[1]!.setValue('false')
    await flushPromises()
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(getAccounts).toHaveBeenLastCalledWith({ page: 1, limit: 10, search: 'Nguyễn Văn', role: 'READER', isActive: 'false' })
    view.unmount()
  })

  it('chặn email không hợp lệ, lưu email và trạng thái mới rồi đóng dialog', async () => {
    vi.mocked(updateAccount).mockResolvedValue({ ...row, email: 'new@ctu.edu.vn', isActive: false })
    const view = mount(AccountsManagementView, { attachTo: document.body })
    await flushPromises()
    await view.get('button[aria-label="Chỉnh sửa tài khoản B2404981"]').trigger('click')
    await flushPromises()
    await view.get('dialog input[type=email]').setValue('sai-email')
    await view.get('dialog form').trigger('submit')
    expect(view.get('dialog [role=alert]').text()).toContain('email hợp lệ')
    expect(updateAccount).not.toHaveBeenCalled()
    await view.get('dialog input[type=email]').setValue(' new@ctu.edu.vn ')
    await view.get('dialog input[type=checkbox]').setValue(false)
    await view.get('dialog form').trigger('submit')
    await flushPromises()
    expect(updateAccount).toHaveBeenCalledWith(row._id, { email: 'new@ctu.edu.vn', isActive: false })
    expect(view.find('dialog').exists()).toBe(false)
    expect(view.text()).toContain('Đã cập nhật tài khoản')
    view.unmount()
  })

  it('giữ biểu mẫu khi API trả lỗi trùng email để sửa và thử lại', async () => {
    vi.mocked(updateAccount).mockRejectedValueOnce(new Error('Email đã được sử dụng')).mockResolvedValueOnce(row)
    const view = mount(AccountsManagementView, { attachTo: document.body })
    await flushPromises()
    await view.get('button[aria-label="Chỉnh sửa tài khoản B2404981"]').trigger('click')
    await flushPromises()
    await view.get('dialog input[type=email]').setValue('new@ctu.edu.vn')
    await view.get('dialog form').trigger('submit')
    await flushPromises()
    expect(view.get('dialog [role=alert]').text()).toContain('Email đã được sử dụng')
    expect((view.get('dialog input[type=email]').element as HTMLInputElement).value).toBe('new@ctu.edu.vn')
    await view.get('dialog form').trigger('submit')
    await flushPromises()
    expect(updateAccount).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('xóa tổng phân trang lỗi thời sau khi tải thất bại và thử tải lại', async () => {
    vi.mocked(getAccounts).mockResolvedValueOnce(result([row], 81, 9)).mockRejectedValueOnce(new Error('API 503')).mockResolvedValueOnce(result([row]))
    const view = mount(AccountsManagementView)
    await flushPromises()
    expect(view.text()).toContain('81 tài khoản')
    await view.get('.account-filters button[type=button]').trigger('click')
    await flushPromises()
    expect(view.get('[role=alert]').text()).toContain('API 503')
    expect(view.text()).toContain('0 tài khoản · Trang 1/1')
    await view.get('[role=alert] button').trigger('click')
    await flushPromises()
    expect(view.text()).toContain('1 tài khoản · Trang 1/1')
    view.unmount()
  })

  it('bỏ qua phản hồi cũ khi các yêu cầu tìm kiếm hoàn thành sai thứ tự', async () => {
    let complete!: (value: AccountsResult) => void
    vi.mocked(getAccounts).mockReturnValueOnce(new Promise(resolve => { complete = resolve })).mockResolvedValueOnce(result([{ ...row, fullName: 'Kết quả mới' }]))
    const view = mount(AccountsManagementView)
    await view.get('input[type=search]').setValue('mới')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.text()).toContain('Kết quả mới')
    complete(result([{ ...row, fullName: 'Kết quả cũ' }]))
    await flushPromises()
    expect(view.text()).not.toContain('Kết quả cũ')
    view.unmount()
  })
})
