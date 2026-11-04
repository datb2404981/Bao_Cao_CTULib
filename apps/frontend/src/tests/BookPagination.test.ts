import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookPagination from '../components/catalog/BookPagination.vue'

describe('BookPagination.vue', () => {
  it('disables previous button on page 1 boundary', () => {
    const wrapper = mount(BookPagination, {
      props: { currentPage: 1, totalPages: 2, totalItems: 12, limit: 10, isLoading: false },
    })
    const prevBtn = wrapper.find('button.btn-prev')
    expect(prevBtn.attributes('disabled')).toBeDefined()
    const nextBtn = wrapper.find('button.btn-next')
    expect(nextBtn.attributes('disabled')).toBeUndefined()
  })

  it('disables next button on last page boundary', () => {
    const wrapper = mount(BookPagination, {
      props: { currentPage: 2, totalPages: 2, totalItems: 12, limit: 10, isLoading: false },
    })
    const nextBtn = wrapper.find('button.btn-next')
    expect(nextBtn.attributes('disabled')).toBeDefined()
    const prevBtn = wrapper.find('button.btn-prev')
    expect(prevBtn.attributes('disabled')).toBeUndefined()
  })

  it('emits page-change with next page number', async () => {
    const wrapper = mount(BookPagination, {
      props: { currentPage: 1, totalPages: 2, totalItems: 12, limit: 10, isLoading: false },
    })
    await wrapper.find('button.btn-next').trigger('click')
    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
  })

  it('emits page-change with prev page number', async () => {
    const wrapper = mount(BookPagination, {
      props: { currentPage: 2, totalPages: 2, totalItems: 12, limit: 10, isLoading: false },
    })
    await wrapper.find('button.btn-prev').trigger('click')
    expect(wrapper.emitted('page-change')?.[0]).toEqual([1])
  })

  it('emits page-change when clicking direct page button', async () => {
    const wrapper = mount(BookPagination, {
      props: { currentPage: 1, totalPages: 3, totalItems: 30, limit: 10, isLoading: false },
    })
    const pageButtons = wrapper.findAll('button.page-num-btn')
    expect(pageButtons.length).toBe(3)
    await pageButtons[1]?.trigger('click')
    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
  })

  it('displays summary text with totalItems and pages', () => {
    const wrapper = mount(BookPagination, {
      props: { currentPage: 1, totalPages: 2, totalItems: 12, limit: 10, isLoading: false },
    })
    expect(wrapper.text()).toContain('12 sách')
    expect(wrapper.text()).toContain('Trang 1 / 2')
  })
})
