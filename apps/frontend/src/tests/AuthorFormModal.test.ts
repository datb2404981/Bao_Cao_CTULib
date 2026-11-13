import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthorFormModal from '../components/author/AuthorFormModal.vue';
import type { Author } from '../types/author';

const sampleAuthor: Author = {
  _id: '67cabe960354ac17e1a6b001',
  fullName: 'Nguyễn Văn An',
  affiliation: 'Trường Đại học Cần Thơ',
  notes: 'Tác giả sách giáo trình',
};

describe('components/author/AuthorFormModal.vue - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MODAL-AUT-001: Không render dialog khi isOpen = false', () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: false,
      },
    });

    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('MODAL-AUT-002: Render đúng tiêu đề và trường rỗng ở chế độ Thêm mới', () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: true,
        authorToEdit: null,
      },
    });

    expect(wrapper.find('h1').text()).toBe('Thêm tác giả');
    const nameInput = wrapper.find<HTMLInputElement>('input[name="fullName"]');
    expect(nameInput.exists()).toBe(true);
    expect(nameInput.element.value).toBe('');

    expect(wrapper.find('input[name="code"]').exists()).toBe(false);

    expect(wrapper.find('.delete-section').exists()).toBe(false);
  });

  it('MODAL-AUT-003: Render đúng thông tin ở chế độ Chỉnh sửa và không hiện mã thực thể DB', () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: true,
        authorToEdit: sampleAuthor,
      },
    });

    expect(wrapper.find('h1').text()).toBe('Chỉnh sửa tác giả');
    const nameInput = wrapper.find<HTMLInputElement>('input[name="fullName"]');
    expect(nameInput.element.value).toBe(sampleAuthor.fullName);

    const affInput = wrapper.find<HTMLInputElement>('input[name="affiliation"]');
    expect(affInput.element.value).toBe(sampleAuthor.affiliation);

    expect(wrapper.find('input[name="code"]').exists()).toBe(false);

    expect(wrapper.find('.delete-section').exists()).toBe(true);
  });

  it('MODAL-AUT-004: Validate client-side: Báo lỗi khi họ tên tác giả rỗng', async () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: true,
        authorToEdit: null,
      },
    });

    const form = wrapper.find('form');
    await form.trigger('submit');

    expect(wrapper.text()).toContain('Họ tên tác giả không được để trống');
    expect(wrapper.emitted('submit')).toBeFalsy();
  });

  it('MODAL-AUT-005: Validate client-side: Báo lỗi khi họ tên tác giả vượt quá 50 ký tự', async () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: true,
        authorToEdit: null,
      },
    });

    const nameInput = wrapper.find('input[name="fullName"]');
    await nameInput.setValue('a'.repeat(51));

    const form = wrapper.find('form');
    await form.trigger('submit');

    expect(wrapper.text()).toContain('Họ tên tác giả không được vượt quá 50 ký tự');
    expect(wrapper.emitted('submit')).toBeFalsy();
  });

  it('MODAL-AUT-006: Emit sự kiện submit với payload hợp lệ', async () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: true,
        authorToEdit: null,
      },
    });

    await wrapper.find('input[name="fullName"]').setValue('Trần Minh Hòa');
    await wrapper.find('input[name="affiliation"]').setValue('Khoa Kinh tế');
    await wrapper.find('textarea[name="notes"]').setValue('Tiến sĩ Kinh tế');

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      fullName: 'Trần Minh Hòa',
      affiliation: 'Khoa Kinh tế',
      notes: 'Tiến sĩ Kinh tế',
    });
  });

  it('MODAL-AUT-007: Phát ra sự kiện delete khi bấm xác nhận xóa ở chế độ chỉnh sửa', async () => {
    const wrapper = mount(AuthorFormModal, {
      props: {
        isOpen: true,
        authorToEdit: sampleAuthor,
      },
    });

    const deleteBtn = wrapper.find('.btn.danger');
    expect(deleteBtn.exists()).toBe(true);

    await deleteBtn.trigger('click');

    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')?.[0]?.[0]).toBe(sampleAuthor._id);
  });
});

