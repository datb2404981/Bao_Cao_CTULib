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
})

