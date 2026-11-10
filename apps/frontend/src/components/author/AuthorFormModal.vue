<script setup lang="ts">
import { reactive, watch, nextTick, computed, ref } from 'vue';
import type { Author, CreateAuthorPayload, UpdateAuthorPayload } from '../../types/author';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    authorToEdit?: Author | null;
    isSubmitting?: boolean;
    serverError?: string | null;
    serverFieldErrors?: Record<string, string>;
  }>(),
  {
    authorToEdit: null,
    isSubmitting: false,
    serverError: null,
    serverFieldErrors: () => ({}),
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: CreateAuthorPayload | UpdateAuthorPayload): void;
  (e: 'delete', authorId: string): void;
}>();

const isEditMode = computed(() => !!props.authorToEdit);
const titleText = computed(() => (isEditMode.value ? 'Chỉnh sửa tác giả' : 'Thêm tác giả'));

const form = reactive({
  fullName: '',
  affiliation: '',
  notes: '',
});

const errors = reactive<Record<string, string>>({});
const showDeleteConfirm = ref(false);
const dialogRef = ref<HTMLDialogElement | null>(null);

const displayAuthorCode = computed(() => {
  if (props.authorToEdit?._id) {
    return `TG-${props.authorToEdit._id.slice(-6).toUpperCase()}`;
  }
  return 'Tự cấp khi lưu';
});

function resetForm() {
  if (props.authorToEdit) {
    form.fullName = props.authorToEdit.fullName || '';
    form.affiliation = props.authorToEdit.affiliation || '';
    form.notes = props.authorToEdit.notes || '';
  } else {
    form.fullName = '';
    form.affiliation = '';
    form.notes = '';
  }
  showDeleteConfirm.value = false;
  Object.keys(errors).forEach((key) => delete errors[key]);
}

watch(
  () => [props.isOpen, props.authorToEdit],
  ([open]) => {
    if (open) {
      resetForm();
    }
  },
  { immediate: true }
);

watch(() => props.isOpen, async (open) => {
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
  dialog.querySelector<HTMLElement>('#author-dialog-title')?.focus();
}, { immediate: true });

function validate(): boolean {
  Object.keys(errors).forEach((key) => delete errors[key]);

  const trimmedName = form.fullName.trim();
  if (!trimmedName) {
    errors.fullName = 'Họ tên tác giả không được để trống';
  } else if (trimmedName.length > 50) {
    errors.fullName = 'Họ tên tác giả không được vượt quá 50 ký tự';
  }

  if (form.affiliation && form.affiliation.trim().length > 255) {
    errors.affiliation = 'Đơn vị công tác không được vượt quá 255 ký tự';
  }

  return Object.keys(errors).length === 0;
}

async function handleSubmit() {
  if (props.isSubmitting) return;

  if (!validate()) {
    await nextTick();
    const firstInvalid = document.querySelector<HTMLInputElement>('.dialog-body [aria-invalid="true"]');
    firstInvalid?.focus();
    return;
  }

  emit('submit', {
    fullName: form.fullName.trim(),
    affiliation: form.affiliation.trim() || undefined,
    notes: form.notes.trim() || undefined,
  });
}

function handleClose() {
  if (!props.isSubmitting) {
    emit('close');
  }
}

function handleConfirmDelete() {
  if (props.authorToEdit?._id) {
    emit('delete', props.authorToEdit._id);
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
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
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
      class="dialog narrow"
      aria-modal="true"
      :aria-labelledby="'author-dialog-title'"
      @cancel.prevent="handleClose"
      @click="handleDialogClick"
    >
      <header class="dialog-header">
        <h1 id="author-dialog-title" tabindex="-1">{{ titleText }}</h1>
        <button
          class="icon-btn"
          type="button"
          aria-label="Đóng"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div class="dialog-body">
        <!-- Thông báo lỗi chung từ máy chủ -->
        <div v-if="serverError" class="notice error" role="alert" style="margin-bottom: 16px">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p>{{ serverError }}</p>
          </div>
        </div>

        <form id="author-form" class="stack" novalidate @submit.prevent="handleSubmit">
          <!-- Mã tác giả (Readonly) -->
          <label class="field">
            <span>Mã tác giả</span>
            <input
              type="text"
              name="code"
              :value="displayAuthorCode"
              readonly
              class="code-input"
            />
          </label>

          <!-- Họ tên tác giả (Bắt buộc) -->
          <label class="field">
            <span>Họ tên tác giả <b class="required">*</b></span>
            <input
              v-model="form.fullName"
              type="text"
              name="fullName"
              placeholder="Nhập họ và tên tác giả"
              required
              maxlength="50"
              :aria-invalid="!!(errors.fullName || serverFieldErrors?.fullName)"
              :aria-describedby="errors.fullName || serverFieldErrors?.fullName ? 'author-fullName-error' : undefined"
              :disabled="isSubmitting"
              autofocus
            />
            <p v-if="errors.fullName || serverFieldErrors?.fullName" id="author-fullName-error" class="field-error">
              {{ errors.fullName || serverFieldErrors?.fullName }}
            </p>
          </label>

          <!-- Đơn vị công tác -->
          <label class="field">
            <span>Đơn vị công tác</span>
            <input
              v-model="form.affiliation"
              type="text"
              name="affiliation"
              placeholder="VD: Trường CNTT&TT - ĐH Cần Thơ"
              maxlength="255"
              :aria-invalid="!!(errors.affiliation || serverFieldErrors?.affiliation)"
              :aria-describedby="errors.affiliation || serverFieldErrors?.affiliation ? 'author-affiliation-error' : undefined"
              :disabled="isSubmitting"
            />
            <p v-if="errors.affiliation || serverFieldErrors?.affiliation" id="author-affiliation-error" class="field-error">
              {{ errors.affiliation || serverFieldErrors?.affiliation }}
            </p>
          </label>

          <!-- Ghi chú -->
          <label class="field">
            <span>Ghi chú</span>
            <textarea
              v-model="form.notes"
              name="notes"
              placeholder="Ghi chú thêm về tác giả (nếu có)…"
              rows="3"
              :disabled="isSubmitting"
            ></textarea>
          </label>
        </form>

        <!-- Khu vực Xóa Tác Giả (Chỉ hiện khi ở chế độ chỉnh sửa) -->
        <div v-if="isEditMode" class="delete-section">
          <details class="disclosure" :open="showDeleteConfirm">
            <summary @click.prevent="showDeleteConfirm = !showDeleteConfirm">
              Xóa tác giả
            </summary>
            <div class="disclosure-content">
              <p class="small muted">
                Chỉ xóa khi tác giả không còn sách nào liên kết trong hệ thống CTULib.
              </p>
              <div class="confirm-box">
                <p class="confirm-warning">
                  Bạn có chắc chắn muốn xóa tác giả <strong>{{ authorToEdit?.fullName }}</strong>? Thao tác này không thể hoàn tác.
                </p>
                <button
                  class="btn danger small"
                  type="button"
                  :disabled="isSubmitting"
                  @click="handleConfirmDelete"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Xác nhận xóa</span>
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>

      <footer class="dialog-footer">
        <button
          class="btn"
          type="button"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          Hủy bỏ
        </button>
        <button
          class="btn primary"
          form="author-form"
          type="submit"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting" class="spinner small" aria-hidden="true"></span>
          <span>{{ isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi' }}</span>
        </button>
      </footer>
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

.dialog.narrow {
  width: 100%;
  max-width: 500px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 0;
  overflow: hidden;
  margin: auto;
}

.dialog::backdrop {
  background: var(--backdrop-dialog, rgba(23, 32, 51, 0.45));
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--line-light, #e2e8f0);
}

.dialog-header h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--text, #0f172a);
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted, #64748b);
  display: grid;
  place-items: center;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: var(--bg-hover, #f1f5f9);
  color: var(--text, #0f172a);
}

.dialog-body {
  padding: 24px;
  max-height: calc(85vh - 130px);
  overflow-y: auto;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field > span {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text, #0f172a);
}

.required {
  color: var(--danger, #ef4444);
}

.field input,
.field textarea {
  width: 100%;
  padding: 9px 12px;
  font-size: 14px;
  border: 1px solid var(--line-light, #cbd5e1);
  border-radius: 8px;
  outline: none;
  background: #ffffff;
  color: var(--text, #0f172a);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--primary, #1e3a8a);
  box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.12);
}

.field input[readonly],
.code-input {
  background: #f8fafc;
  color: #64748b;
  cursor: not-allowed;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.field input[aria-invalid="true"],
.field textarea[aria-invalid="true"] {
  border-color: var(--danger, #ef4444);
}

.field-error {
  font-size: 12.5px;
  color: var(--danger, #ef4444);
  margin: 2px 0 0;
}

.delete-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px dashed var(--line-light, #e2e8f0);
}

.disclosure {
  border: 1px solid #fee2e2;
  border-radius: 8px;
  background: #fff5f5;
  overflow: hidden;
}

.disclosure summary {
  padding: 10px 14px;
  font-size: 13.5px;
  font-weight: 600;
  color: #b91c1c;
  cursor: pointer;
  user-select: none;
}

.disclosure-content {
  padding: 12px 14px;
  border-top: 1px solid #fecaca;
  background: #ffffff;
}

.confirm-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.confirm-warning {
  font-size: 13px;
  color: #7f1d1d;
  margin: 0;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--line-light, #e2e8f0);
  background: #f8fafc;
}

.spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
  display: inline-block;
  margin-right: 6px;
  vertical-align: middle;
}
</style>

