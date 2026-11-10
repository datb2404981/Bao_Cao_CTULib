<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { currentUser } from '../../services/auth';
import { getBookById } from '../../services/book';
import type { Book } from '../../types/book';

const props = defineProps<{
  isOpen: boolean;
  bookId: string | null;
  initialBook?: Book | null;
  facultyName?: string;
  authorNames?: string;
  reserving?: boolean;
  reservationError?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'require-login'): void;
  (e: 'borrow', book: Book): void;
}>();

const activeBook = ref<Book | null>(props.initialBook || null);
const loading = ref(false);
const error = ref<string | null>(null);
const imageError = ref(false);
let detailRequestId = 0;

function handleImageError() {
  imageError.value = true;
}

const isLoggedIn = computed(() => !!currentUser.value);
const isReader = computed(() => currentUser.value?.role === 'READER');

const formattedPrice = computed(() => {
  if (
    !activeBook.value ||
    activeBook.value.coverPrice === undefined ||
    activeBook.value.coverPrice === null
  ) {
    return 'Chưa cập nhật';
  }
  return new Intl.NumberFormat('vi-VN').format(activeBook.value.coverPrice) + ' đồng';
});

const isAvailable = computed(() => {
  if (!activeBook.value) return false;
  return activeBook.value.availableCopies > 0 && activeBook.value.isAvailableForCirculation;
});

async function loadDetail(id: string) {
  const requestId = ++detailRequestId;
  loading.value = true;
  error.value = null;
  try {
    const fetched = await getBookById(id);
    if (requestId !== detailRequestId) return;
    activeBook.value = fetched;
  } catch (err: unknown) {
    if (requestId !== detailRequestId) return;
    const errorObj = err !== null && typeof err === 'object' ? err : null;
    if (errorObj && 'status' in errorObj && errorObj.status === 401 && props.initialBook) {
      activeBook.value = props.initialBook;
    } else {
      error.value = errorObj && 'message' in errorObj && typeof errorObj.message === 'string'
        ? errorObj.message
        : 'Không thể tải chi tiết sách.';
    }
  } finally {
    if (requestId === detailRequestId) loading.value = false;
  }
}

const modalRef = ref<HTMLDialogElement | null>(null);

watch(
  [() => props.bookId, () => props.isOpen],
  ([newId, isOpen]) => {
    imageError.value = false;
    if (newId && isOpen) {
      detailRequestId++;
      activeBook.value = props.initialBook || null;
      error.value = null;
      loading.value = false;
      // Khách xem dữ liệu đã có ở trang danh mục; endpoint chi tiết yêu cầu đăng nhập.
      if (isLoggedIn.value || !props.initialBook) void loadDetail(newId);
      void nextTick(() => {
        if (!props.isOpen || !modalRef.value) return;
        if (typeof modalRef.value.showModal === 'function' && !modalRef.value.open) {
          modalRef.value.showModal();
        }
        modalRef.value.querySelector<HTMLElement>('#dialog-title')?.focus();
      });
    } else if (!isOpen) {
      detailRequestId++;
      if (modalRef.value?.open && typeof modalRef.value.close === 'function') {
        modalRef.value.close();
      }
      activeBook.value = null;
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => { detailRequestId++; });

function handleClose() {
  emit('close');
}

function handleDialogClick(event: MouseEvent) {
  if (event.target !== event.currentTarget || !modalRef.value) return;
  const rect = modalRef.value.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) {
    handleClose();
  }
}

function handleBorrow() {
  if (props.reserving || (isLoggedIn.value && !isReader.value)) return;
  if (!isLoggedIn.value) {
    emit('require-login');
    return;
  }
  if (activeBook.value) {
    emit('borrow', activeBook.value);
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="handleClose">
    <dialog
      ref="modalRef"
      class="dialog"
      aria-labelledby="dialog-title"
      @cancel.prevent="handleClose"
      @click="handleDialogClick"
    >
      <header class="dialog-header">
        <h1 id="dialog-title" tabindex="-1">Chi tiết sách</h1>
        <button
          class="icon-btn"
          type="button"
          aria-label="Đóng hộp thoại"
          @click="handleClose"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div class="dialog-body">
        <div v-if="loading && !activeBook" class="loading-state">
          <span class="spinner"></span> Đang tải thông tin chi tiết…
        </div>

        <div v-else-if="error && !activeBook" class="notice error">
          <p>{{ error }}</p>
        </div>

        <template v-else-if="activeBook">
          <div class="summary-block record-hero">
            <div
              class="cover large"
              :class="{ 'has-image': activeBook.coverImageUrl && !imageError }"
              :aria-label="activeBook.title"
            >
              <img
                v-if="activeBook.coverImageUrl && !imageError"
                :src="activeBook.coverImageUrl"
                :alt="activeBook.title"
                class="cover-image"
                @error="handleImageError"
              />
              <div v-else class="cover-fallback-large" role="img" :aria-label="`Chưa có ảnh bìa của ${activeBook.title}`">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span>Chưa có ảnh bìa</span>
              </div>
            </div>

            <div class="record-hero-info">
              <h2>{{ activeBook.title }}</h2>
              <p class="record-author">
                <span class="author-label">Tác giả</span>
                <strong>{{ authorNames || 'Chưa rõ tác giả' }}</strong>
              </p>
              <p class="circulation-status" :class="{ inactive: !activeBook.isAvailableForCirculation }">
                <span class="status-indicator" :class="{ empty: !activeBook.isAvailableForCirculation }" aria-hidden="true"></span>
                {{ activeBook.isAvailableForCirculation ? 'Đang lưu hành' : 'Ngừng lưu hành' }}
              </p>
            </div>
          </div>

          <section class="bibliographic-card" aria-label="Thông tin xuất bản và số lượng">
            <div class="detail-pairs">
              <div class="ledger-row">
                <dl class="ledger-cell">
                  <dt>Loại sách</dt>
                  <dd>{{ activeBook.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Sách tham khảo' }}</dd>
                </dl>
                <dl class="ledger-cell">
                  <dt>Khoa/Viện</dt>
                  <dd>{{ facultyName || 'Đại học Cần Thơ' }}</dd>
                </dl>
              </div>

              <div class="ledger-row">
                <dl class="ledger-cell">
                  <dt>Nhà xuất bản</dt>
                  <dd>{{ activeBook.publisher || 'NXB Đại học Cần Thơ' }}</dd>
                </dl>
                <dl class="ledger-cell">
                  <dt>Năm xuất bản</dt>
                  <dd>{{ activeBook.publicationYear || 'Chưa cập nhật' }}</dd>
                </dl>
              </div>

              <div class="ledger-row">
                <dl class="ledger-cell">
                  <dt>Giá bìa</dt>
                  <dd class="num price-val">{{ formattedPrice }}</dd>
                </dl>
                <dl class="ledger-cell">
                  <dt>Khả dụng</dt>
                  <dd>
                    <span class="availability-status">
                      <span class="status-indicator" :class="{ empty: !isAvailable }"></span>
                      <span class="availability" :class="{ empty: !isAvailable }">
                        {{ isAvailable ? `${activeBook.availableCopies} bản` : 'Hết bản khả dụng' }}
                      </span>
                    </span>
                  </dd>
                </dl>
              </div>
            </div>
          </section>

          <div v-if="!isLoggedIn" class="notice info auth-prompt-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p>Bạn cần đăng nhập tài khoản CTULib để thực hiện chức năng mượn sách.</p>
          </div>
        </template>
      </div>

      <footer class="dialog-footer">
        <p v-if="reservationError" role="alert" class="notice error" style="flex: 1">{{ reservationError }}</p>
        <button class="btn btn-close-modal" type="button" @click="handleClose">Đóng</button>
        <button
          v-if="activeBook"
          class="btn primary btn-borrow-action"
          type="button"
          :disabled="!isAvailable || reserving || (isLoggedIn && !isReader)"
          @click="handleBorrow"
        >
          <span>{{ reserving ? 'Đang đặt…' : !isLoggedIn ? 'Đăng nhập để mượn' : isReader ? 'Đặt mượn' : 'Chỉ dành cho độc giả' }}</span>
        </button>
      </footer>
    </dialog>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: transparent;
}

.dialog {
  width: min(720px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  overflow: hidden;
  background: #fff;
  color: #172033;
  border: 1px solid #dfe5ec;
  border-radius: 14px;
  box-shadow: 0 20px 56px -16px rgba(15, 23, 42, 0.22);
}

.dialog[open] {
  display: flex;
  flex-direction: column;
}

.dialog::backdrop {
  background: rgba(15, 23, 42, 0.5);
}

.dialog-header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  padding: 20px 28px;
  background: #fff;
  border-bottom: 1px solid #e9edf2;
}

.dialog-header h1 {
  margin: 0;
  color: #172033;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.02em;
}

.dialog-header .icon-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  cursor: pointer;
}

.dialog-header .icon-btn:focus-visible,
.dialog-footer .btn:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 2px;
}

.dialog-body {
  min-height: 0;
  overflow-y: auto;
  padding: 28px;
}

.record-hero {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}

.cover.large {
  flex: none;
  width: 116px;
  height: 162px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #f1f4f8;
  border: 1px solid #dce3eb;
  border-radius: 5px;
  box-shadow: none;
}

.cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback-large {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
  text-align: center;
}

.cover-fallback-large svg {
  width: 28px;
  height: 28px;
  color: #8090a5;
}

.cover-fallback-large span {
  width: 80px;
  font-size: 11px;
  line-height: 1.45;
}

.record-hero-info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

.record-hero-info h2 {
  margin: 0 0 14px;
  color: #111827;
  font-size: 24px;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}

.record-author {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 10px;
  row-gap: 2px;
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

.author-label {
  color: #64748b;
}

.record-author strong {
  color: #334155;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.circulation-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 0;
  color: #166534;
  font-size: 13px;
  font-weight: 550;
}

.circulation-status.inactive {
  color: #b91c1c;
}

.bibliographic-card {
  border-top: 1px solid #e2e8f0;
}

.detail-pairs {
  margin: 0;
}

.ledger-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid #edf0f4;
}

.ledger-row:last-child {
  border-bottom: 0;
}

.ledger-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 14px 20px 14px 0;
}

.ledger-cell:nth-child(2) {
  padding-left: 24px;
}

.ledger-cell dt {
  color: #64748b;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.5;
}

.ledger-cell dd {
  margin: 0;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ledger-cell .price-val {
  font-variant-numeric: tabular-nums;
}

.availability-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #16a34a;
  box-shadow: none;
}

.status-indicator.empty {
  background: #dc2626;
  box-shadow: none;
}

.availability {
  color: #166534;
}

.availability.empty {
  color: #b91c1c;
}

.auth-prompt-box.notice.info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 22px;
  padding: 12px 14px;
  color: #475569;
  background: #f8fafc;
  border: 0;
  border-radius: 8px;
}

.auth-prompt-box svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: #64748b;
}

.auth-prompt-box p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
}

.dialog-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  gap: 10px;
  padding: 16px 28px;
  background: #fff;
  border-top: 1px solid #e9edf2;
}

.btn-close-modal {
  min-height: 42px;
  padding: 9px 16px;
  background: transparent;
  border-color: transparent;
  color: #475569;
  border-radius: 8px;
}

.btn-close-modal:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: transparent;
}

.btn-borrow-action {
  min-height: 42px;
  padding: 9px 22px;
  border-radius: 8px;
  font-size: 14px;
}

.btn-borrow-action.primary:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
  box-shadow: none;
}

.btn-borrow-action.primary:hover:not(:disabled) {
  background: #1e40af;
  border-color: #1e40af;
  box-shadow: none;
}

@media (max-width: 600px) {
  .dialog {
    width: calc(100% - 16px);
    max-height: calc(100dvh - 16px);
    border-radius: 12px;
  }

  .dialog-header {
    padding: 16px 20px;
  }

  .dialog-body {
    padding: 22px 20px;
  }

  .record-hero {
    gap: 16px;
    margin-bottom: 24px;
  }

  .cover.large {
    width: 94px;
    height: 132px;
  }

  .record-hero-info h2 {
    font-size: 20px;
  }

  .ledger-cell:nth-child(2) {
    padding-left: 16px;
  }

  .dialog-footer {
    padding: 14px 20px;
  }
}

@media (max-width: 440px) {
  .ledger-row {
    grid-template-columns: 1fr;
    border-bottom: 0;
  }

  .ledger-cell,
  .ledger-cell:nth-child(2) {
    padding: 12px 0;
    border-bottom: 1px solid #edf0f4;
  }

  .ledger-row:last-child .ledger-cell:last-child {
    border-bottom: 0;
  }

  .cover.large {
    width: 82px;
    height: 116px;
  }

  .record-hero-info h2 {
    font-size: 18px;
  }

  .record-author {
    font-size: 13px;
  }

  .btn-borrow-action {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-footer .btn,
  .dialog-header .icon-btn {
    transition: none;
  }
}
</style>
