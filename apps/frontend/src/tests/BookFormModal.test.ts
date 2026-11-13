import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookFormModal from '../components/management/BookFormModal.vue'
import type { CreateBookPayload } from '../types/book'

describe('BookFormModal.vue', () => {
  const faculties = [{ _id: 'ee584419975de7543b8c2fd2', facultyName: 'Khoa KTPM' }]
  const authors = [{ _id: '3028c4b741766ed91a3b43ac', fullName: 'Tác giả A' }]

  it('does not render modal content when isOpen is false', () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: false, faculties, authors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('validates mandatory fields and prevents submit when empty', async () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.text()).toContain('Vui lòng nhập tên sách')
  })

  it('validates negative totalCopies and negative coverPrice', async () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })
    await wrapper.find('input[name="title"]').setValue('Giáo trình Mới')
    await wrapper.find('input[name="totalCopies"]').setValue('-5')
    await wrapper.find('input[name="coverPrice"]').setValue('-50000')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.text()).toContain('Tổng số bản không được âm')
    expect(wrapper.text()).toContain('Giá bìa không được âm')
  })

  it('emits submit event with sanitized payload when form is valid', async () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })
    await wrapper.find('input[name="title"]').setValue('Giáo trình Kiến trúc Phần mềm')
    await wrapper.find('select[name="facultyId"]').setValue(faculties[0]!._id)
    await wrapper.find('select[name="authorIds"]').setValue([authors[0]!._id])
    await wrapper.find('input[name="totalCopies"]').setValue('10')
    await wrapper.find('input[name="coverPrice"]').setValue('100000')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toBeTruthy()
    const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload
    expect(payload.title).toBe('Giáo trình Kiến trúc Phần mềm')
    expect(payload.totalCopies).toBe(10)
    expect(payload.coverPrice).toBe(100000)
    expect(payload.facultyId).toBe(faculties[0]!._id)
    expect(payload.authorIds).toEqual([authors[0]!._id])
  })

  it('renders serverFieldErrors and serverError appropriately', () => {
    const wrapper = mount(BookFormModal, {
      props: {
        isOpen: true,
        faculties,
        authors,
        isSubmitting: false,
        serverError: 'Lỗi trùng mã hoặc dữ liệu',
        serverFieldErrors: { title: 'Tên sách này đã tồn tại' },
      },
    })
    expect(wrapper.text()).toContain('Lỗi trùng mã hoặc dữ liệu')
    expect(wrapper.text()).toContain('Tên sách này đã tồn tại')
  })

  it('hiển thị đúng số bản khả dụng khi sửa sách, không nhầm với tổng số bản', async () => {
    const wrapper = mount(BookFormModal, {
      props: {
        isOpen: true,
        faculties,
        authors,
        editMode: true,
        initialData: {
          title: 'Sách đã cho mượn',
          totalCopies: 20,
          availableCopies: 15,
        },
      },
    })
    expect((wrapper.get('input[name="totalCopies"]').element as HTMLInputElement).value).toBe('20')
    expect((wrapper.get('input[name="availableCopies"]').element as HTMLInputElement).value).toBe('15')
    await wrapper.setProps({ isOpen: false })
  })

  it('validates publicationYear <= 0 and rejects submit with error message', async () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })
    await wrapper.find('input[name="title"]').setValue('Giáo trình Tin học')
    await wrapper.find('select[name="facultyId"]').setValue(faculties[0]!._id)
    await wrapper.find('select[name="authorIds"]').setValue([authors[0]!._id])
    await wrapper.find('input[name="totalCopies"]').setValue('5')
    await wrapper.find('input[name="coverPrice"]').setValue('50000')
    await wrapper.find('input[name="publicationYear"]').setValue('0')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.text()).toContain('Năm xuất bản phải là số dương')
  })

  it('từ chối lưu nếu khoa hoặc tác giả đã bị xóa khỏi danh mục khi form đang mở', async () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })
    await wrapper.get('input[name="title"]').setValue('Tài liệu an toàn')
    await wrapper.get('select[name="facultyId"]').setValue(faculties[0]!._id)
    await wrapper.get('select[name="authorIds"]').setValue([authors[0]!._id])
    await wrapper.setProps({ faculties: [], authors: [] })
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.text()).toContain('Khoa/Viện đã chọn không còn trong danh mục')
    expect(wrapper.text()).toContain('Một hoặc nhiều tác giả đã chọn không còn trong danh mục')
  })

  it('chặn đóng form và gửi thêm request khi đang lưu', async () => {
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors, isSubmitting: true, serverError: null, serverFieldErrors: {} },
    })
    await wrapper.get('.modal-backdrop').trigger('click')
    await wrapper.get('dialog').trigger('keydown', { key: 'Escape' })
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('close')).toBeFalsy()
    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.get('dialog').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button[aria-label="Đóng hộp thoại"]').attributes('disabled')).toBeDefined()
  })

  it('cho phép tìm kiếm, chọn và xoá tác giả bằng cách nhập tên', async () => {
    const customAuthors = [
      { _id: 'auth-1', fullName: 'Nguyễn Văn A' },
      { _id: 'auth-2', fullName: 'Trần Thị B' },
    ]
    const wrapper = mount(BookFormModal, {
      props: { isOpen: true, faculties, authors: customAuthors, isSubmitting: false, serverError: null, serverFieldErrors: {} },
    })

    const searchInput = wrapper.get('input[name="authorSearch"]')
    await searchInput.trigger('focus')
    await searchInput.setValue('Nguyen')

    const options = wrapper.findAll('.author-option')
    expect(options.length).toBe(1)
    expect(options[0]!.text()).toContain('Nguyễn Văn A')

    await options[0]!.trigger('mousedown')
    expect(wrapper.findAll('.author-chip').length).toBe(1)
    expect(wrapper.get('.author-chip').text()).toContain('Nguyễn Văn A')

    await searchInput.setValue('Trần')
    await searchInput.trigger('keydown', { key: 'Enter' })
    expect(wrapper.findAll('.author-chip').length).toBe(2)

    await wrapper.find('.author-chip-remove').trigger('click')
    expect(wrapper.findAll('.author-chip').length).toBe(1)

    await wrapper.get('input[name="title"]').setValue('Kỹ thuật phần mềm')
    await wrapper.get('select[name="facultyId"]').setValue(faculties[0]!._id)
    await wrapper.get('input[name="totalCopies"]').setValue('3')
    await wrapper.get('input[name="coverPrice"]').setValue('50000')

    await wrapper.get('form').trigger('submit.prevent')

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted?.[0]?.[0]).toMatchObject({
      authorIds: ['auth-2'],
    })
  })
})

