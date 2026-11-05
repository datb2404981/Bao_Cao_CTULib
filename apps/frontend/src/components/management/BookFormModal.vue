<script setup lang="ts">
import { reactive, watch, nextTick, computed } from 'vue';
import type { CreateBookPayload } from '../../types/book';

interface FacultyItem {
  _id?: string;
  facultyId?: string;
  facultyName: string;
}

interface AuthorItem {
  _id?: string;
  authorId?: string;
  fullName: string;
  affiliation?: string;
}

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    faculties: FacultyItem[];
    authors: AuthorItem[];
    initialData?: Partial<CreateBookPayload>;
    isSubmitting?: boolean;
    submitting?: boolean;
    serverError?: string | null;
    serverFieldErrors?: Record<string, string>;
  }>(),
  {
    isSubmitting: false,
    submitting: false,
    serverError: null,
    serverFieldErrors: () => ({}),
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: CreateBookPayload): void;
}>();

const isPending = computed(() => props.isSubmitting || props.submitting);

const form = reactive({
  title: '',
  bookType: 'TEXTBOOK' as 'TEXTBOOK' | 'REFERENCE',
  facultyId: '',
  authorIds: [] as string[],
  publisher: '',
  publicationYear: new Date().getFullYear(),
  coverPrice: 0,
  totalCopies: 1,
  coverImageUrl: '',
  isAvailableForCirculation: true,
});

const errors = reactive<Record<string, string>>({});

function getFacultyId(f: FacultyItem): string {
  return f._id || f.facultyId || '';
}

function getAuthorId(a: AuthorItem): string {
  return a._id || a.authorId || '';
}

function getAuthorName(a: AuthorItem): string {
  return a.fullName || '';
}

function resetForm() {
  form.title = props.initialData?.title || '';
  form.bookType = props.initialData?.bookType || 'TEXTBOOK';
  form.facultyId = props.initialData?.facultyId || '';
  form.authorIds = props.initialData?.authorIds ? [...props.initialData.authorIds] : [];
  form.publisher = props.initialData?.publisher || '';
  form.publicationYear = props.initialData?.publicationYear ?? new Date().getFullYear();
  form.coverPrice = props.initialData?.coverPrice ?? 0;
  form.totalCopies = props.initialData?.totalCopies ?? 1;
  form.coverImageUrl = props.initialData?.coverImageUrl || '';
  form.isAvailableForCirculation = props.initialData?.isAvailableForCirculation ?? true;
  Object.keys(errors).forEach((key) => delete errors[key]);
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) resetForm();
  },
  { immediate: true }
);

function validate(): boolean {
  Object.keys(errors).forEach((key) => delete errors[key]);

  if (!form.title || !form.title.trim()) {
    errors.title = 'Vui lòng nhập tên sách';
  }

  if (!form.facultyId) {
    errors.facultyId = 'Vui lòng chọn Khoa/Viện';
  }

  if (!form.authorIds || form.authorIds.length === 0) {
    errors.authorIds = 'Sách phải có ít nhất một tác giả';
  } else if (new Set(form.authorIds).size !== form.authorIds.length) {
    errors.authorIds = 'Danh sách tác giả không được trùng lặp';
  }

  const copies = Number(form.totalCopies);
  if (form.totalCopies === undefined || form.totalCopies === null || isNaN(copies)) {
    errors.totalCopies = 'Vui lòng nhập tổng số bản';
  } else if (!Number.isInteger(copies)) {
    errors.totalCopies = 'Tổng số bản phải là số nguyên';
  } else if (copies < 0) {
    errors.totalCopies = 'Tổng số bản không được âm';
  }

  const price = Number(form.coverPrice);
  if (form.coverPrice === undefined || form.coverPrice === null || isNaN(price)) {
    errors.coverPrice = 'Vui lòng nhập giá bìa';
  } else if (price < 0) {
    errors.coverPrice = 'Giá bìa không được âm';
  }

  const currentYear = new Date().getFullYear();
  const hasPublicationYear =
    form.publicationYear !== undefined &&
    form.publicationYear !== null &&
    String(form.publicationYear).trim() !== '';

  if (hasPublicationYear) {
    const year = Number(form.publicationYear);
    if (isNaN(year) || !Number.isInteger(year)) {
      errors.publicationYear = 'Năm xuất bản phải là số nguyên';
    } else if (year <= 0) {
      errors.publicationYear = 'Năm xuất bản phải là số dương';
    } else if (year > currentYear + 1) {
      errors.publicationYear = `Năm xuất bản không được lớn hơn ${currentYear + 1}`;
    }
  }

  if (form.coverImageUrl && form.coverImageUrl.trim()) {
    try {
      new URL(form.coverImageUrl.trim());
    } catch {
      errors.coverImageUrl = 'Đường dẫn ảnh bìa không hợp lệ';
    }
  }

  return Object.keys(errors).length === 0;
}

async function handleSubmit() {
  if (!validate()) {
    await nextTick();
    const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
    return;
  }

  const hasPublicationYear =
    form.publicationYear !== undefined &&
    form.publicationYear !== null &&
    String(form.publicationYear).trim() !== '';

  const payload: CreateBookPayload = {
    title: form.title.trim(),
    facultyId: form.facultyId,
    authorIds: [...form.authorIds],
    bookType: form.bookType,
    totalCopies: Number(form.totalCopies),
    coverPrice: Number(form.coverPrice),
    publicationYear: hasPublicationYear ? Number(form.publicationYear) : undefined,
    publisher: form.publisher.trim() || undefined,
    coverImageUrl: form.coverImageUrl.trim() || undefined,
    isAvailableForCirculation: form.isAvailableForCirculation,
  };

  emit('submit', payload);
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="emit('close')">
    <dialog
      open
      class="dialog wide"
      aria-labelledby="form-dialog-title"
      @keydown.esc="emit('close')"
    >
      <header class="dialog-header">
        <div>
          <h1 id="form-dialog-title" tabindex="-1">Thêm sách mới</h1>
        </div>
        <button
          class="icon-btn"
          type="button"
          aria-label="Đóng hộp thoại"
          @click="emit('close')"
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
        <div v-if="serverError" class="notice error" style="margin-bottom: 16px" role="alert">
          {{ serverError }}
        </div>

        <form id="book-form" novalidate @submit.prevent="handleSubmit">
          <label class="field" style="margin-bottom: 16px">
            <span>Mã sách</span>
            <input type="text" name="code" value="Tự cấp khi lưu" readonly />
          </label>

          <div class="form-section">
            <div class="grid2">
              <div class="full">
                <label class="field">
                  <span>Tên sách <b class="required">*</b></span>
                  <input
                    v-model="form.title"
                    type="text"
                    name="title"
                    placeholder="Nhập tên sách"
                    required
                    :aria-invalid="!!(errors.title || serverFieldErrors?.title)"
                  />
                  <p v-if="errors.title || serverFieldErrors?.title" class="field-error">
                    {{ errors.title || serverFieldErrors?.title }}
                  </p>
                </label>
              </div>

              <label class="field">
                <span>Loại sách <b class="required">*</b></span>
                <select v-model="form.bookType" name="bookType" required>
                  <option value="TEXTBOOK">Giáo trình</option>
                  <option value="REFERENCE">Sách tham khảo</option>
                </select>
              </label>

              <label class="field">
                <span>Khoa/Viện <b class="required">*</b></span>
                <select
                  v-model="form.facultyId"
                  name="facultyId"
                  required
                  :aria-invalid="!!(errors.facultyId || serverFieldErrors?.facultyId)"
                >
                  <option value="">Chọn Khoa/Viện</option>
                  <option
                    v-for="faculty in faculties"
                    :key="getFacultyId(faculty)"
                    :value="getFacultyId(faculty)"
                  >
                    {{ faculty.facultyName }}
                  </option>
                </select>
                <p v-if="errors.facultyId || serverFieldErrors?.facultyId" class="field-error">
                  {{ errors.facultyId || serverFieldErrors?.facultyId }}
                </p>
              </label>

              <div class="full">
                <label class="field">
                  <span>Tác giả <b class="required">*</b></span>
                  <select
                    v-model="form.authorIds"
                    name="authorIds"
                    multiple
                    size="4"
                    required
                    :aria-invalid="!!(errors.authorIds || serverFieldErrors?.authorIds)"
                  >
                    <option
                      v-for="author in authors"
                      :key="getAuthorId(author)"
                      :value="getAuthorId(author)"
                    >
                      {{ getAuthorName(author) }}
                    </option>
                  </select>
                  <p v-if="errors.authorIds || serverFieldErrors?.authorIds" class="field-error">
                    {{ errors.authorIds || serverFieldErrors?.authorIds }}
                  </p>
                </label>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3>Xuất bản và kho</h3>
            <div class="grid2">
              <label class="field">
                <span>Nhà xuất bản</span>
                <input
                  v-model="form.publisher"
                  type="text"
                  name="publisher"
                  placeholder="NXB Đại học Cần Thơ"
                />
              </label>

              <label class="field">
                <span>Năm xuất bản</span>
                <input
                  v-model="form.publicationYear"
                  type="number"
                  name="publicationYear"
                  min="1"
                  step="1"
                  :aria-invalid="!!(errors.publicationYear || serverFieldErrors?.publicationYear)"
                />
                <p v-if="errors.publicationYear || serverFieldErrors?.publicationYear" class="field-error">
                  {{ errors.publicationYear || serverFieldErrors?.publicationYear }}
                </p>
              </label>

              <label class="field">
                <span>Giá bìa (đồng) <b class="required">*</b></span>
                <input
                  v-model="form.coverPrice"
                  type="number"
                  name="coverPrice"
                  min="0"
                  step="1000"
                  required
                  :aria-invalid="!!(errors.coverPrice || serverFieldErrors?.coverPrice)"
                />
                <p v-if="errors.coverPrice || serverFieldErrors?.coverPrice" class="field-error">
                  {{ errors.coverPrice || serverFieldErrors?.coverPrice }}
                </p>
              </label>

              <label class="field">
                <span>Tổng số bản ban đầu <b class="required">*</b></span>
                <input
                  v-model="form.totalCopies"
                  type="number"
                  name="totalCopies"
                  min="0"
                  step="1"
                  required
                  :aria-invalid="!!(errors.totalCopies || serverFieldErrors?.totalCopies)"
                />
                <p v-if="errors.totalCopies || serverFieldErrors?.totalCopies" class="field-error">
                  {{ errors.totalCopies || serverFieldErrors?.totalCopies }}
                </p>
              </label>

              <label class="field">
                <span>Khả dụng ban đầu</span>
                <input
                  type="text"
                  name="availableCopies"
                  :value="form.totalCopies"
                  readonly
                  disabled
                />
                <span class="hint">Tự động bằng tổng số bản (server quản lý).</span>
              </label>

              <div class="full">
                <label class="field">
                  <span>Đường dẫn ảnh bìa</span>
                  <input
                    v-model="form.coverImageUrl"
                    type="url"
                    name="coverImageUrl"
                    placeholder="https://lib.ctu.edu.vn/covers/giaotrinh-web.jpg"
                    :aria-invalid="!!errors.coverImageUrl"
                  />
                  <p v-if="errors.coverImageUrl" class="field-error">{{ errors.coverImageUrl }}</p>
                </label>
              </div>
            </div>

            <label class="checkline" style="margin-top: 14px">
              <input
                v-model="form.isAvailableForCirculation"
                type="checkbox"
                name="isAvailableForCirculation"
              />
              <span>Cho phép lưu hành</span>
            </label>
          </div>

          <div class="form-actions" style="margin-top: 24px">
            <button class="btn" type="button" :disabled="isPending" @click="emit('close')">
              Hủy bỏ
            </button>
            <button class="btn primary" type="submit" :disabled="isPending">
              {{ isPending ? 'Đang lưu…' : 'Lưu sách' }}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--backdrop-dialog, rgba(23, 32, 51, 0.45));
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 20px;
}

.dialog {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-dialog, 0 12px 44px #17203318);
}

.dialog-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.dialog-body {
  overflow-y: auto;
  flex: 1;
  padding: 20px 24px;
}

.form-section {
  background: var(--color-page);
  padding: 16px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  margin-bottom: 16px;
}

.form-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

select[multiple] {
  min-height: 104px;
  padding: 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

select[multiple]:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
  border-color: var(--color-focus);
}

select[multiple] option {
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
}

select[multiple] option:checked {
  background: var(--bg-primary-subtle);
  color: var(--color-primary);
  font-weight: 600;
}

.checkline {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkline input {
  cursor: pointer;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-subtle);
}
</style>
