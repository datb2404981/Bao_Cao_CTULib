<script setup lang="ts">
import { reactive, watch, nextTick, computed, ref } from 'vue';
import type { Publisher, CreatePublisherPayload, UpdatePublisherPayload } from '../../types/publisher';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    publisherToEdit?: Publisher | null;
    isSubmitting?: boolean;
    serverError?: string | null;
    serverFieldErrors?: Record<string, string>;
  }>(),
  {
    publisherToEdit: null,
    isSubmitting: false,
    serverError: null,
    serverFieldErrors: () => ({}),
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: CreatePublisherPayload | UpdatePublisherPayload): void;
  (e: 'delete', publisherId: string): void;
}>();

const isEditMode = computed(() => !!props.publisherToEdit);
const titleText = computed(() => (isEditMode.value ? 'Chỉnh sửa Nhà xuất bản' : 'Thêm Nhà xuất bản'));

const form = reactive({
  publisherName: '',
  address: '',
});

const errors = reactive<Record<string, string>>({});
const showDeleteConfirm = ref(false);
const dialogRef = ref<HTMLDialogElement | null>(null);

function resetForm() {
  if (props.publisherToEdit) {
    form.publisherName = props.publisherToEdit.publisherName || '';
    form.address = props.publisherToEdit.address || '';
  } else {
    form.publisherName = '';
    form.address = '';
  }
  showDeleteConfirm.value = false;
  Object.keys(errors).forEach((key) => delete errors[key]);
}

watch(
  () => [props.isOpen, props.publisherToEdit],
  ([open]) => {
    if (open) {
      resetForm();
    }
  },
  { immediate: true }
);

watch(
  () => props.isOpen,
  async (open) => {
    if (!open) {
      dialogRef.value?.close?.();
      return;
    }
    await nextTick();
    const dialog = dialogRef.value;
    if (!props.isOpen || !dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    dialog.querySelector<HTMLElement>('#publisher-dialog-title')?.focus();
  },
  { immediate: true }
);

function validate(): boolean {
  Object.keys(errors).forEach((key) => delete errors[key]);

  const trimmedName = form.publisherName.trim();
  if (!trimmedName) {
    errors.publisherName = 'Tên nhà xuất bản không được để trống';
  } else if (trimmedName.length > 100) {
    errors.publisherName = 'Tên nhà xuất bản không được vượt quá 100 ký tự';
  }

  if (form.address && form.address.trim().length > 255) {
    errors.address = 'Địa chỉ không được vượt quá 255 ký tự';
  }

  return Object.keys(errors).length === 0;
}

async function handleSubmit() {
  if (props.isSubmitting) return;

  if (!validate()) {
    await nextTick();
    const firstInvalid = dialogRef.value?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
    return;
  }

  const payload: CreatePublisherPayload = {
    publisherName: form.publisherName.trim(),
    address: form.address.trim() || undefined,
  };

  emit('submit', payload);
}

function handleDeleteClick() {
  showDeleteConfirm.value = true;
}

function handleCancelDelete() {
  showDeleteConfirm.value = false;
}

function handleConfirmDelete() {
  if (props.publisherToEdit?._id) {
    emit('delete', props.publisherToEdit._id);
  }
}

function handleClose() {
  if (props.isSubmitting) return;
  emit('close');
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    handleClose();
  }
}
</script>

<template>
  <dialog
    v-if="isOpen"
    ref="dialogRef"
    class="dialog modern-dialog"
    aria-labelledby="publisher-dialog-title"
    aria-modal="true"
    @keydown="handleKeyDown"
  >
    <div class="dialog-content">
      <header class="dialog-header">
        <div class="header-titles">
          <h2 id="publisher-dialog-title" tabindex="-1">{{ titleText }}</h2>
          <p class="dialog-subtitle">
            {{ isEditMode ? 'Cập nhật thông tin chi tiết của Nhà xuất bản' : 'Thêm đối tác xuất bản sách vào hệ thống thư viện' }}
          </p>
        </div>
        <button
          type="button"
          class="btn-icon close-button"
          aria-label="Đóng hộp thoại"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <form novalidate @submit.prevent="handleSubmit">
        <div class="dialog-body">
          <div v-if="serverError" class="alert error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{{ serverError }}</span>
          </div>

          <!-- Tên NXB -->
          <div class="field">
            <label for="pub-name">
              <span>Tên Nhà xuất bản <b class="required">*</b></span>
            </label>
            <input
              id="pub-name"
              v-model="form.publisherName"
              type="text"
              name="publisherName"
              placeholder="VD: NXB Đại học Cần Thơ, NXB Giáo dục…"
              :disabled="isSubmitting"
              :aria-invalid="!!(errors.publisherName || serverFieldErrors?.publisherName)"
              aria-describedby="pub-name-error"
            />
            <p v-if="errors.publisherName || serverFieldErrors?.publisherName" id="pub-name-error" class="field-error">
              {{ errors.publisherName || serverFieldErrors?.publisherName }}
            </p>
          </div>

          <!-- Địa chỉ -->
          <div class="field">
            <label for="pub-address">
              <span>Địa chỉ</span>
            </label>
            <input
              id="pub-address"
              v-model="form.address"
              type="text"
              name="address"
              placeholder="Khu II, Đường 3/2, P. Xuân Khánh, Q. Ninh Kiều, TP. Cần Thơ"
              :disabled="isSubmitting"
              :aria-invalid="!!(errors.address || serverFieldErrors?.address)"
              aria-describedby="pub-address-error"
            />
            <p v-if="errors.address || serverFieldErrors?.address" id="pub-address-error" class="field-error">
              {{ errors.address || serverFieldErrors?.address }}
            </p>
          </div>

          <!-- Xác nhận xóa -->
          <div v-if="showDeleteConfirm" class="delete-warning-panel" role="alert">
            <div class="delete-warning-text">
              <strong>Xác nhận xóa Nhà xuất bản này?</strong>
              <p>Hành động này không thể hoàn tác. Các sách liên kết với nhà xuất bản này sẽ cần được cập nhật.</p>
            </div>
            <div class="delete-actions">
              <button
                type="button"
                class="btn small"
                :disabled="isSubmitting"
                @click="handleCancelDelete"
              >
                Hủy
              </button>
              <button
                type="button"
                class="btn small danger"
                :disabled="isSubmitting"
                @click="handleConfirmDelete"
              >
                {{ isSubmitting ? 'Đang xóa…' : 'Xóa vĩnh viễn' }}
              </button>
            </div>
          </div>
        </div>

        <footer class="dialog-footer">
          <div class="footer-left">
            <button
              v-if="isEditMode && !showDeleteConfirm"
              type="button"
              class="btn danger outline"
              :disabled="isSubmitting"
              @click="handleDeleteClick"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Xóa</span>
            </button>
          </div>

          <div class="footer-right">
            <button
              type="button"
              class="btn"
              :disabled="isSubmitting"
              @click="handleClose"
            >
              Hủy
            </button>
            <button
              type="submit"
              class="btn primary"
              :disabled="isSubmitting"
            >
              <span>{{ isSubmitting ? 'Đang lưu…' : isEditMode ? 'Lưu thay đổi' : 'Tạo mới' }}</span>
            </button>
          </div>
        </footer>
      </form>
    </div>
  </dialog>
</template>

<style scoped>
.modern-dialog {
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-dialog);
  max-width: 520px;
  width: 90vw;
}

.modern-dialog::backdrop {
  background: var(--backdrop-dialog);
  backdrop-filter: blur(4px);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid var(--line-light);
}

.header-titles h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.dialog-subtitle {
  font-size: 13px;
  color: var(--muted);
  margin: 4px 0 0;
}

.close-button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
}

.close-button:hover {
  background: var(--ground);
  color: var(--text);
}

.dialog-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field label span {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}

.field input {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid var(--line-light);
  background: #f8fafc;
}

.footer-right {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.delete-warning-panel {
  background: var(--bg-danger-subtle);
  border: 1px solid var(--border-danger-subtle);
  border-radius: var(--radius-sm);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.delete-warning-text strong {
  color: var(--color-danger);
  font-size: 13.5px;
}

.delete-warning-text p {
  color: var(--color-danger);
  font-size: 12.5px;
  margin: 4px 0 0;
}

.delete-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
