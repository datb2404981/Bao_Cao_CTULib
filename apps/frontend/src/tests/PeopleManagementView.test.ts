import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PeopleManagementView from '../views/PeopleManagementView.vue'
import * as api from '../services/people'
import { AuthError } from '../services/auth'

const session = vi.hoisted(() => ({ role: 'ADMIN' }))
vi.mock('../services/auth', async (original) => {
  const actual = await original<typeof import('../services/auth')>()
  return { ...actual, currentUser: { get value() { return { accountId: '507f1f77bcf86cd799439011', ctuIdentifier: 'ADMIN', role: session.role, permissions: [] } } }, refreshAuthorization: vi.fn().mockResolvedValue(undefined) }
})
vi.mock('../services/people', () => ({ getReaders: vi.fn(), getEmployees: vi.fn(), getPermissions: vi.fn(), createReader: vi.fn(), updateReader: vi.fn(), setBorrowingBlock: vi.fn(), createEmployee: vi.fn(), updateEmployee: vi.fn(), createPermission: vi.fn(), updatePermission: vi.fn() }))
vi.mock('../services/faculty', () => ({ getAllFaculties: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439022', facultyName: 'Công nghệ thông tin' }]) }))
const id = '507f1f77bcf86cd799439011'
const permission = { _id: '507f1f77bcf86cd799439033', permissionName: 'MANAGE_BOOKS', description: 'Quản lý sách' }
const clickText = async (wrapper: ReturnType<typeof mount>, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text() === text)
  expect(button, text).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  session.role = 'ADMIN'
  vi.mocked(api.getReaders).mockResolvedValue([{ _id: id, fullName: 'Nguyễn Văn An', facultyId: '507f1f77bcf86cd799439022', readerType: 'STUDENT', isBorrowingBlocked: false }])
  vi.mocked(api.getEmployees).mockResolvedValue([{ _id: id, fullName: 'Lê Văn Hào', permissionIds: [permission._id] }])
  vi.mocked(api.getPermissions).mockResolvedValue([permission])
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open') })
})
describe('quản lý độc giả, nhân viên và quyền', () => {
  it('chặn và gỡ chặn thủ công, vẫn giữ chặn do nghiệp vụ phạt', async () => {
    vi.mocked(api.getReaders).mockResolvedValue([{ _id: id, fullName: 'Nguyễn Văn An', facultyId: '507f1f77bcf86cd799439022', readerType: 'STUDENT', isBorrowingBlocked: true, isBorrowingManuallyBlocked: false }])
    vi.mocked(api.setBorrowingBlock)
      .mockResolvedValueOnce({ _id: id, fullName: 'Nguyễn Văn An', facultyId: '507f1f77bcf86cd799439022', isBorrowingBlocked: true, isBorrowingManuallyBlocked: true, borrowingBlockReason: 'Vi phạm nội quy' })
      .mockResolvedValueOnce({ _id: id, fullName: 'Nguyễn Văn An', facultyId: '507f1f77bcf86cd799439022', isBorrowingBlocked: true, isBorrowingManuallyBlocked: false })
    const wrapper = mount(PeopleManagementView, { props: { resource: 'reader' }, attachTo: document.body })
    await flushPromises()
    await clickText(wrapper, 'Xem hồ sơ')
    await wrapper.get('.borrowing-control textarea').setValue('Vi phạm nội quy')
    await clickText(wrapper, 'Chặn mượn thủ công')
    expect(api.setBorrowingBlock).toHaveBeenNthCalledWith(1, id, { blocked: true, reason: 'Vi phạm nội quy' })
    expect(wrapper.find('.borrowing-control').text()).toContain('Lý do khóa thủ công')
    await clickText(wrapper, 'Gỡ chặn thủ công')
    expect(api.setBorrowingBlock).toHaveBeenNthCalledWith(2, id, { blocked: false, reason: '' })
    expect(wrapper.find('.borrowing-control').text()).toContain('Quyền mượn đang bị chặn')
    expect(wrapper.find('.borrowing-control').text()).toContain('nghiệp vụ phạt')
    wrapper.unmount()
  })

  it('giữ hộp thoại mở và khóa tất cả nút đóng khi đang cập nhật trạng thái mượn', async () => {
    let complete!: (value: Awaited<ReturnType<typeof api.setBorrowingBlock>>) => void
    vi.mocked(api.setBorrowingBlock).mockReturnValue(new Promise(resolve => { complete = resolve }))
    const wrapper = mount(PeopleManagementView, { props: { resource: 'reader' }, attachTo: document.body })
    await flushPromises()
    await clickText(wrapper, 'Xem hồ sơ')
    await wrapper.get('.borrowing-control textarea').setValue('Khóa thủ công')
    await wrapper.get('.borrowing-control button').trigger('click')
    expect(wrapper.get('button[aria-label="Đóng hộp thoại"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    complete({ _id: id, facultyId: '507f1f77bcf86cd799439022', isBorrowingBlocked: false, isBorrowingManuallyBlocked: true, borrowingBlockReason: 'Khóa thủ công' })
    await flushPromises()
    expect(wrapper.get('button[aria-label="Đóng hộp thoại"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('không gửi chặn nếu lý do quá ngắn và hiển thị lỗi cập nhật từ API', async () => {
    vi.mocked(api.setBorrowingBlock).mockRejectedValue(new Error('Máy chủ không nhận yêu cầu'))
    const wrapper = mount(PeopleManagementView, { props: { resource: 'reader' }, attachTo: document.body })
    await flushPromises()
    await clickText(wrapper, 'Xem hồ sơ')
    await wrapper.get('.borrowing-control textarea').setValue('abc')
    await clickText(wrapper, 'Chặn mượn thủ công')
    expect(api.setBorrowingBlock).not.toHaveBeenCalled()
    expect(wrapper.find('.borrowing-control').text()).toContain('ít nhất 5 ký tự')
    await wrapper.get('.borrowing-control textarea').setValue('Khóa vì vi phạm')
    await clickText(wrapper, 'Chặn mượn thủ công')
    expect(wrapper.find('.borrowing-control').text()).toContain('Máy chủ không nhận yêu cầu')
    expect(wrapper.find('.borrowing-control textarea').element.value).toBe('Khóa vì vi phạm')
    wrapper.unmount()
  })
  it('không tải API hoặc hiện dữ liệu khi role thiếu quyền', async () => {
    session.role = 'EMPLOYEE'
    const wrapper = mount(PeopleManagementView, { props: { resource: 'reader' } })
    await flushPromises()
    expect(api.getReaders).not.toHaveBeenCalled()
    expect(wrapper.find('table').exists()).toBe(false)
    wrapper.unmount()
  })
  it('hiện độc giả, tìm kiếm và xem hồ sơ đúng trường', async () => {
    const wrapper = mount(PeopleManagementView, { props: { resource: 'reader' }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('Nguyễn Văn An')
    expect(wrapper.text()).toContain('Công nghệ thông tin')
    await clickText(wrapper, 'Xem hồ sơ')
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    await clickText(wrapper, 'Đóng')
    await wrapper.find('input[type="search"]').setValue('không tồn tại')
    expect(wrapper.text()).toContain('Không tìm thấy kết quả')
    wrapper.unmount()
  })
  it('thu hồi hết quyền gửi permissionIds rỗng bằng PATCH', async () => {
    vi.mocked(api.updateEmployee).mockResolvedValue({ _id: id, permissionIds: [] })
    const wrapper = mount(PeopleManagementView, { props: { resource: 'employee' }, attachTo: document.body })
    await flushPromises()
    await clickText(wrapper, 'Xem hồ sơ')
    await clickText(wrapper, 'Chỉnh sửa')
    await wrapper.find('input[type="checkbox"]').setValue(false)
    await wrapper.find('dialog form').trigger('submit')
    await flushPromises()
    expect(api.updateEmployee).toHaveBeenCalledWith(id, expect.objectContaining({ permissionIds: [] }))
    expect(wrapper.text()).toContain('Đã cập nhật nhân viên thành công')
    wrapper.unmount()
  })
  it('giữ biểu mẫu và hiển thị lỗi khi API không lưu được', async () => {
    vi.mocked(api.createPermission).mockRejectedValue(new AuthError('Tên quyền đã tồn tại', 409))
    const wrapper = mount(PeopleManagementView, { props: { resource: 'permission' }, attachTo: document.body })
    await flushPromises()
    await clickText(wrapper, '+ Thêm quyền')
    await wrapper.find('input[list]').setValue('MANAGE_BOOKS')
    await wrapper.find('textarea').setValue('Quản lý sách')
    await wrapper.find('dialog form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('dialog').text()).toContain('Tên quyền đã tồn tại')
    expect(wrapper.find('dialog input').element.value).toBe('MANAGE_BOOKS')
    wrapper.unmount()
  })
  it('từ chối tạo hồ sơ với ID tài khoản không hợp lệ', async () => {
    const wrapper = mount(PeopleManagementView, { props: { resource: 'employee' }, attachTo: document.body })
    await flushPromises()
    await clickText(wrapper, '+ Thêm nhân viên')
    await wrapper.find('dialog form').trigger('submit')
    expect(api.createEmployee).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('24 ký tự hex')
    wrapper.unmount()
  })
})
