import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookFilters from '../components/catalog/BookFilters.vue'

describe('BookFilters.vue', () => {
  const mockFaculties = [
    { _id: 'ee584419975de7543b8c2fd2', facultyName: 'Khoa Kỹ thuật Phần mềm' },
    { _id: '7b8bb20178062966c9ee3fa6', facultyName: 'Khoa Khoa học Máy tính' },
  ]

  it('populates faculty select options properly', () => {
    const wrapper = mount(BookFilters, {
      props: {
        search: '',
        facultyId: '',
        bookType: '',
        faculties: mockFaculties,
        isLoading: false,
      },
    })
    const options = wrapper.findAll('select.faculty-select option')
    expect(options.length).toBe(3) // 1 Tất cả + 2 khoa
    expect(options[1]?.text()).toBe('Khoa Kỹ thuật Phần mềm')
  })

  it('emits update:search and submit when user triggers search', async () => {
    const wrapper = mount(BookFilters, {
      props: {
        search: '',
        facultyId: '',
        bookType: '',
        faculties: mockFaculties,
        isLoading: false,
      },
    })
    const input = wrapper.find('input[type="search"]')
    await input.setValue('Node.js')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('update:search')?.[0]).toEqual(['Node.js'])
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('emits reset event when clicking "Xóa bộ lọc"', async () => {
    const wrapper = mount(BookFilters, {
      props: {
        search: 'Lập trình',
        facultyId: 'ee584419975de7543b8c2fd2',
        bookType: '',
        faculties: mockFaculties,
        isLoading: false,
      },
    })
    const resetBtn = wrapper.find('button.btn-reset')
    await resetBtn.trigger('click')
    expect(wrapper.emitted('reset')).toBeTruthy()
    expect(wrapper.emitted('update:search')?.[0]).toEqual([''])
  })

  it('keeps filters editable while an older request is loading', async () => {
    const wrapper = mount(BookFilters, {
      props: {
        search: '',
        facultyId: '',
        bookType: '',
        faculties: mockFaculties,
        isLoading: true,
      },
    })
    expect(wrapper.find('button.btn-search').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('input[type="search"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('input[type="search"]').setValue('Một truy vấn mới')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.emitted('update:search')?.at(-1)).toEqual(['Một truy vấn mới'])
  })

  it('emits update:facultyId on faculty change', async () => {
    const wrapper = mount(BookFilters, {
      props: {
        search: '',
        facultyId: '',
        bookType: '',
        faculties: mockFaculties,
        isLoading: false,
      },
    })
    const select = wrapper.find('select.faculty-select')
    await select.setValue(mockFaculties[0]!._id)
    expect(wrapper.emitted('update:facultyId')?.[0]).toEqual([mockFaculties[0]!._id])
  })

  it('updates advanced filters immediately with one explicit search action', async () => {
    const wrapper = mount(BookFilters, { props: { faculties: mockFaculties } })

    expect(wrapper.findAll('button[type="submit"]')).toHaveLength(1)
    expect(wrapper.get('button.btn-search').text()).toContain('Tìm kiếm')
    expect(wrapper.get('.filter-update-note').text()).toContain('Kết quả tự cập nhật')

    await wrapper.get('select.faculty-select').setValue(mockFaculties[0]!._id)
    await wrapper.get('select.kind-select').setValue('REFERENCE')

    expect(wrapper.emitted('update:facultyId')?.at(-1)).toEqual([mockFaculties[0]!._id])
    expect(wrapper.emitted('update:bookType')?.at(-1)).toEqual(['REFERENCE'])
    expect(wrapper.get('details summary').text()).toContain('Đang lọc 2 tiêu chí')

    await wrapper.get('form').trigger('submit.prevent')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('clears every active filter even while an older request is loading', async () => {
    const wrapper = mount(BookFilters, {
      props: {
        faculties: mockFaculties,
        search: 'Lập trình',
        facultyId: mockFaculties[0]!._id,
        bookType: 'TEXTBOOK',
        isLoading: true,
      },
    })

    const reset = wrapper.get('button.btn-reset')
    expect(reset.attributes('disabled')).toBeUndefined()
    await reset.trigger('click')

    expect(wrapper.get('input[type="search"]').element).toHaveProperty('value', '')
    expect(wrapper.get('select.faculty-select').element).toHaveProperty('value', '')
    expect(wrapper.get('select.kind-select').element).toHaveProperty('value', '')
    expect(wrapper.get('details summary').text()).not.toContain('Đang lọc')
    expect(wrapper.emitted('update:search')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('update:facultyId')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('update:bookType')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
