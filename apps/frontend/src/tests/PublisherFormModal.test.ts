import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PublisherFormModal from '../components/publisher/PublisherFormModal.vue';
import type { Publisher } from '../types/publisher';

const samplePublisher: Publisher = {
  _id: '67cabe960354ac17e1a6b001',
  publisherCode: 'NXB-CTU',
  publisherName: 'Nhà xuất bản Đại học Cần Thơ',
  address: 'Khu II ĐHCT',
};

describe('components/publisher/PublisherFormModal.vue - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MODAL-PUB-001: Không render dialog khi isOpen = false', () => {
    const wrapper = mount(PublisherFormModal, {
      props: {
        isOpen: false,
      },
    });

    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('MODAL-PUB-002: Render đúng tiêu đề và trường rỗng ở chế độ Thêm mới', () => {
    const wrapper = mount(PublisherFormModal, {
      props: {
        isOpen: true,
        publisherToEdit: null,
      },
    });

    expect(wrapper.find('h2').text()).toBe('Thêm Nhà xuất bản');
    const nameInput = wrapper.find<HTMLInputElement>('input[name="publisherName"]');
    expect(nameInput.exists()).toBe(true);
    expect(nameInput.element.value).toBe('');

    expect(wrapper.find('.btn.danger.outline').exists()).toBe(false);
  });

  it('MODAL-PUB-003: Render đúng thông tin ở chế độ Chỉnh sửa', () => {
    const wrapper = mount(PublisherFormModal, {
      props: {
        isOpen: true,
        publisherToEdit: samplePublisher,
      },
    });

    expect(wrapper.find('h2').text()).toBe('Chỉnh sửa Nhà xuất bản');
    const nameInput = wrapper.find<HTMLInputElement>('input[name="publisherName"]');
    expect(nameInput.element.value).toBe(samplePublisher.publisherName);

    const addrInput = wrapper.find<HTMLInputElement>('input[name="address"]');
    expect(addrInput.element.value).toBe(samplePublisher.address);

    expect(wrapper.find('.btn.danger.outline').exists()).toBe(true);
  });

  it('MODAL-PUB-004: Validate client-side: Báo lỗi khi tên NXB rỗng', async () => {
    const wrapper = mount(PublisherFormModal, {
      props: {
        isOpen: true,
        publisherToEdit: null,
      },
    });

    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.find('.field-error').exists()).toBe(true);
    expect(wrapper.find('.field-error').text()).toContain('Tên nhà xuất bản không được để trống');
    expect(wrapper.emitted('submit')).toBeFalsy();
  });

  it('MODAL-PUB-005: Submit thành công khi dữ liệu hợp lệ', async () => {
    const wrapper = mount(PublisherFormModal, {
      props: {
        isOpen: true,
        publisherToEdit: null,
      },
    });

    const nameInput = wrapper.find<HTMLInputElement>('input[name="publisherName"]');
    await nameInput.setValue('Nhà xuất bản Trẻ');

    const addrInput = wrapper.find<HTMLInputElement>('input[name="address"]');
    await addrInput.setValue('161B Lý Chính Thắng, Q3, TP.HCM');

    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      publisherName: 'Nhà xuất bản Trẻ',
      address: '161B Lý Chính Thắng, Q3, TP.HCM',
    });
  });

  it('MODAL-PUB-006: Phát ra sự kiện delete khi xác nhận xóa', async () => {
    const wrapper = mount(PublisherFormModal, {
      props: {
        isOpen: true,
        publisherToEdit: samplePublisher,
      },
    });

    const triggerDelBtn = wrapper.find('.btn.danger.outline');
    expect(triggerDelBtn.exists()).toBe(true);
    await triggerDelBtn.trigger('click');

    const confirmDelBtn = wrapper.find('.delete-actions .btn.danger');
    expect(confirmDelBtn.exists()).toBe(true);
    await confirmDelBtn.trigger('click');

    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')?.[0]?.[0]).toBe(samplePublisher._id);
  });
});
