<script setup lang="ts">
import { reactive, watch, nextTick, computed, ref } from 'vue';
import type { Faculty, CreateFacultyPayload, UpdateFacultyPayload } from '../../types/faculty';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    facultyToEdit?: Faculty | null;
    isSubmitting?: boolean;
    serverError?: string | null;
    serverFieldErrors?: Record<string, string>;
  }>(),
  {
    facultyToEdit: null,
    isSubmitting: false,
    serverError: null,
    serverFieldErrors: () => ({}),
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: CreateFacultyPayload | UpdateFacultyPayload): void;
  (e: 'delete', facultyId: string): void;
}>();

const isEditMode = computed(() => !!props.facultyToEdit);
const titleText = computed(() => (isEditMode.value ? 'Chỉnh sửa khoa/viện' : 'Thêm khoa/viện'));

const form = reactive({
  facultyName: '',
  description: '',
});

const errors = reactive<Record<string, string>>({});
const showDeleteConfirm = ref(false);

function resetForm() {
  if (props.facultyToEdit) {
    form.facultyName = props.facultyToEdit.facultyName || '';
    form.description = props.facultyToEdit.description || '';
  } else {
    form.facultyName = '';
    form.description = '';
  }
  showDeleteConfirm.value = false;
  Object.keys(errors).forEach((key) => delete errors[key]);
}

watch(
  () => [props.isOpen, props.facultyToEdit],
  ([open]) => {
    if (open) {
      resetForm();
    }
  },
  { immediate: true }
);

function validate(): boolean {
  Object.keys(errors).forEach((key) => delete errors[key]);

  const trimmedName = form.facultyName.trim();
  if (!trimmedName) {
    errors.facultyName = 'Tên khoa không được để trống';
  } else if (trimmedName.length > 100) {
    errors.facultyName = 'Tên khoa không được vượt quá 100 ký tự';
  }

  if (form.description && form.description.length > 1000) {
    errors.description = 'Mô tả không được vượt quá 1000 ký tự';
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
    facultyName: form.facultyName.trim(),
    description: form.description.trim() || undefined,
  });
}

function handleClose() {
  if (!props.isSubmitting) {
    emit('close');
  }
}

function handleConfirmDelete() {
  if (props.facultyToEdit?._id) {
    emit('delete', props.facultyToEdit._id);
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget && !props.isSubmitting) {
    handleClose();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && !props.isSubmitting) {
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
    @keydown="handleKeydown"
  >
    <dialog
      class="dialog narrow"
      open
      aria-modal="true"
      :aria-labelledby="'faculty-dialog-title'"
      tabindex="-1"
    >
      <header class="dialog-header">
        <h1 id="faculty-dialog-title">{{ titleText }}</h1>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p>{{ serverError }}</p>
          </div>
        </div>

        <form id="faculty-form" class="stack" novalidate @submit.prevent="handleSubmit">
          <!-- Hiển thị mã khoa / ID khi ở chế độ chỉnh sửa -->
          <div v-if="isEditMode && facultyToEdit" class="field">
            <span class="field-label">Mã định danh khoa (ID)</span>
            <input
              type="text"
              :value="facultyToEdit._id"
              readonly
              disabled
              class="readonly-id"
            />
          </div>

          <label class="field" :class="{ 'has-error': !!errors.facultyName || !!serverFieldErrors.facultyName }">
            <span class="field-label">
              Tên Khoa/Viện <b class="required">*</b>
            </span>
            <input
              v-model="form.facultyName"
              type="text"
              name="facultyName"
              placeholder="Ví dụ: Khoa Công nghệ Thông tin & Truyền thông"
              required
              :disabled="isSubmitting"
              :aria-invalid="!!errors.facultyName || !!serverFieldErrors.facultyName"
              aria-describedby="facultyName-error"
            />
            <span
              v-if="errors.facultyName || serverFieldErrors.facultyName"
              id="facultyName-error"
              class="error-text"
            >
              {{ errors.facultyName || serverFieldErrors.facultyName }}
            </span>
          </label>

          <label class="field" :class="{ 'has-error': !!errors.description || !!serverFieldErrors.description }">
            <span class="field-label">Mô tả</span>
            <textarea
              v-model="form.description"
              name="description"
              rows="4"
              placeholder="Nhập thông tin giới thiệu hoặc mô tả chuyên môn của Khoa/Viện..."
              :disabled="isSubmitting"
              :aria-invalid="!!errors.description || !!serverFieldErrors.description"
              aria-describedby="description-error"
            ></textarea>
            <span
              v-if="errors.description || serverFieldErrors.description"
              id="description-error"
              class="error-text"
            >
              {{ errors.description || serverFieldErrors.description }}
            </span>
          </label>
        </form>

        <!-- Phần xóa khoa/viện chỉ hiện khi chỉnh sửa -->
        <div v-if="isEditMode" class="delete-section" style="margin-top: 20px;">
          <details class="disclosure">
            <summary>Xóa khoa/viện</summary>
            <div class="disclosure-content">
              <p class="small muted" style="margin-bottom: 12px">
                Lưu ý: Chỉ nên xóa khoa khi không còn tài liệu sách hoặc bạn đọc liên kết. Thao tác này không thể hoàn tác.
              </p>
              
              <div v-if="!showDeleteConfirm">
                <button
                  class="btn danger small"
                  type="button"
                  :disabled="isSubmitting"
                  @click="showDeleteConfirm = true"
                >
                  Xóa khoa/viện này
                </button>
              </div>

              <div v-else class="delete-confirm-box">
                <p class="delete-warning">Bạn có chắc chắn muốn xóa khoa <strong>{{ facultyToEdit?.facultyName }}</strong>?</p>
                <div class="delete-actions">
                  <button
                    class="btn small"
                    type="button"
                    :disabled="isSubmitting"
                    @click="showDeleteConfirm = false"
                  >
                    Hủy
                  </button>
                  <button
                    class="btn danger small"
                    type="button"
                    :disabled="isSubmitting"
                    @click="handleConfirmDelete"
                  >
                    {{ isSubmitting ? 'Đang xóa…' : 'Xác nhận xóa' }}
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <footer class="dialog-footer">
        <button class="btn" type="button" :disabled="isSubmitting" @click="handleClose">
          Hủy bỏ
        </button>
        <button
          class="btn primary"
          form="faculty-form"
          type="submit"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting" class="spinner-small" aria-hidden="true"></span>
          <span>{{ isSubmitting ? 'Đang lưu…' : isEditMode ? 'Lưu thay đổi' : 'Thêm mới' }}</span>
        </button>
      </footer>
    </dialog>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--backdrop-dialog, rgba(23, 32, 51, 0.45));
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog {
  border: 1px solid var(--line-light, #e2e8f0);
  background: var(--surface, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-dialog, 0 12px 28px -6px rgba(23, 32, 51, 0.16));
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  margin: auto;
  padding: 0;
  overflow: hidden;
  width: 100%;
}

.dialog.narrow {
  max-width: 520px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
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
  padding: 6px;
  border-radius: var(--radius-sm, 6px);
  color: var(--muted, #64748b);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.icon-btn:hover:not(:disabled) {
  background: var(--ground, #f1f5f9);
  color: var(--text, #0f172a);
}

.dialog-body {
  padding: 20px;
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

.field-label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text, #0f172a);
}

.required {
  color: var(--negative, #dc2626);
}

.readonly-id {
  background-color: var(--ground, #f8fafc);
  color: var(--muted, #64748b);
  font-family: monospace;
  font-size: 13px;
  cursor: not-allowed;
}

.has-error input,
.has-error textarea {
  border-color: var(--negative, #dc2626) !important;
}

.error-text {
  font-size: 12px;
  color: var(--negative, #dc2626);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--line-light, #e2e8f0);
  background: var(--ground, #f8fafc);
}

.disclosure {
  border: 1px solid var(--line-light, #e2e8f0);
  border-radius: var(--radius-sm, 6px);
  padding: 10px 14px;
  background: var(--surface, #ffffff);
}

.disclosure summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--negative, #dc2626);
  user-select: none;
}

.disclosure-content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-light, #e2e8f0);
}

.delete-confirm-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 12px;
  border-radius: var(--radius-sm, 6px);
}

.delete-warning {
  font-size: 13px;
  color: #991b1b;
  margin-bottom: 10px;
}

.delete-actions {
  display: flex;
  gap: 8px;
}

.spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 6px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

