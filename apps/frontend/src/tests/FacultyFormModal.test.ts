import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import FacultyFormModal from '../components/faculty/FacultyFormModal.vue';
import type { Faculty } from '../types/faculty';

const sampleFaculty: Faculty = {
  _id: '69cabe960354ac17e1a6b400',
  facultyName: 'Khoa Công nghệ Thông tin & Truyền thông',
  description: 'Mô tả khoa CNTT',
};

describe('FacultyFormModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MODAL-001: Không render dialog khi isOpen = false', () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: false,
      },
    });

    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('MODAL-002: Render đúng tiêu đề và trường rỗng ở chế độ Thêm mới', () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: true,
        facultyToEdit: null,
      },
    });

    expect(wrapper.find('h1').text()).toBe('Thêm khoa/viện');
    const nameInput = wrapper.find<HTMLInputElement>('input[name="facultyName"]');
    expect(nameInput.exists()).toBe(true);
    expect(nameInput.element.value).toBe('');
    expect(wrapper.find('.delete-section').exists()).toBe(false);
  });

  it('MODAL-003: Render đúng thông tin và vùng xóa ở chế độ Chỉnh sửa', () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: true,
        facultyToEdit: sampleFaculty,
      },
    });

    expect(wrapper.find('h1').text()).toBe('Chỉnh sửa khoa/viện');
    const nameInput = wrapper.find<HTMLInputElement>('input[name="facultyName"]');
    expect(nameInput.element.value).toBe(sampleFaculty.facultyName);
    const descTextarea = wrapper.find<HTMLTextAreaElement>('textarea[name="description"]');
    expect(descTextarea.element.value).toBe(sampleFaculty.description);

    expect(wrapper.find('.delete-section').exists()).toBe(true);
  });

  it('MODAL-004: Validate client-side: Báo lỗi khi tên khoa rỗng và không emit submit', async () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: true,
        facultyToEdit: null,
      },
    });

    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Tên khoa không được để trống');
  });

  it('MODAL-005: Validate client-side: Báo lỗi khi tên khoa vượt quá 100 ký tự', async () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: true,
        facultyToEdit: null,
      },
    });

    const longName = 'A'.repeat(101);
    await wrapper.find('input[name="facultyName"]').setValue(longName);
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Tên khoa không được vượt quá 100 ký tự');
  });

  it('MODAL-006: Submit hợp lệ emit event submit với payload chính xác', async () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: true,
        facultyToEdit: null,
      },
    });

    await wrapper.find('input[name="facultyName"]').setValue('Khoa Nông nghiệp');
    await wrapper.find('textarea[name="description"]').setValue('Đào tạo Nông nghiệp');
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('submit')![0]![0]).toEqual({
      facultyName: 'Khoa Nông nghiệp',
      description: 'Đào tạo Nông nghiệp',
    });
  });

  it('MODAL-007: Xác nhận xóa emit event delete với facultyId', async () => {
    const wrapper = mount(FacultyFormModal, {
      props: {
        isOpen: true,
        facultyToEdit: sampleFaculty,
      },
    });

    // Mở confirmation box
    await wrapper.find('.delete-section .btn.danger').trigger('click');
    expect(wrapper.find('.delete-confirm-box').exists()).toBe(true);

    // Bấm nút "Xác nhận xóa"
    const confirmButtons = wrapper.findAll('.delete-actions .btn.danger');
    await confirmButtons[0]!.trigger('click');

    expect(wrapper.emitted('delete')).toHaveLength(1);
    expect(wrapper.emitted('delete')![0]![0]).toBe(sampleFaculty._id);
  });
});

