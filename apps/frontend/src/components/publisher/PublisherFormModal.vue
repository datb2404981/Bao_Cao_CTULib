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

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget && !props.isSubmitting) {
    handleClose();
  }
}

function handleDialogClick(event: MouseEvent) {
  if (event.target !== event.currentTarget || !dialogRef.value) return;
  const bounds = dialogRef.value.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    handleClose();
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop"
    role="presentation"
    @click="handleBackdropClick"
  >
    <dialog
      ref="dialogRef"
      class="dialog narrow modern-dialog"
      aria-labelledby="publisher-dialog-title"
      aria-modal="true"
      @cancel.prevent="handleClose"
      @click="handleDialogClick"
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
              <span v-if="isSubmitting" class="spinner small" aria-hidden="true"></span>
              <span>{{ isSubmitting ? 'Đang lưu…' : isEditMode ? 'Lưu thay đổi' : 'Tạo mới' }}</span>
            </button>
          </div>
        </footer>
      </form>
    </div>
  </dialog>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modern-dialog {
  padding: 0;
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  background: var(--surface, #ffffff);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 100%;
  overflow: hidden;
  margin: auto;
}

.modern-dialog::backdrop {
  background: var(--backdrop-dialog, rgba(15, 23, 42, 0.45));
  backdrop-filter: blur(2px);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 24px;
  border-bottom: 1px solid var(--line-light, #e2e8f0);
}

.header-titles h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text, #0f172a);
  margin: 0;
}

.dialog-subtitle {
  font-size: 13px;
  color: var(--muted, #64748b);
  margin: 4px 0 0;
}

.close-button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted, #64748b);
  padding: 6px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}

.close-button:hover:not(:disabled) {
  background: var(--bg-hover, #f1f5f9);
  color: var(--text, #0f172a);
}

.dialog-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-height: calc(85vh - 130px);
  overflow-y: auto;
}

.alert.error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 13.5px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label span {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text, #0f172a);
}

.required {
  color: var(--danger, #ef4444);
}

.field input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid var(--line-light, #cbd5e1);
  border-radius: 8px;
  outline: none;
  background: #ffffff;
  color: var(--text, #0f172a);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input:focus {
  border-color: var(--primary, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.field input[aria-invalid='true'] {
  border-color: var(--danger, #ef4444);
}

.field input[aria-invalid='true']:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.field input:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.field-error {
  margin: 0;
  font-size: 12.5px;
  color: var(--danger, #dc2626);
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid var(--line-light, #e2e8f0);
  background: #f8fafc;
}

.footer-right {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.delete-warning-panel {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.delete-warning-text strong {
  color: #b91c1c;
  font-size: 13.5px;
}

.delete-warning-text p {
  color: #b91c1c;
  font-size: 12.5px;
  margin: 4px 0 0;
}

.delete-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.spinner.small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 6px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
