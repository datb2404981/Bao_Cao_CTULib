<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { currentUser } from '../../services/auth';
import { getBookById } from '../../services/book';
import type { Book } from '../../types/book';

const props = defineProps<{
  isOpen: boolean;
  bookId: string | null;
  initialBook?: Book | null;
  facultyName?: string;
  authorNames?: string;
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

function handleImageError() {
  imageError.value = true;
}

const isLoggedIn = computed(() => !!currentUser.value);

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
  loading.value = true;
  error.value = null;
  try {
    const fetched = await getBookById(id);
    activeBook.value = fetched;
  } catch (err: unknown) {
    const errorObj = err as { status?: number; message?: string };
    if (errorObj?.status === 401 && props.initialBook) {
      activeBook.value = props.initialBook;
    } else {
      error.value = errorObj?.message || 'Không thể tải chi tiết sách.';
    }
  } finally {
    loading.value = false;
  }
}

const modalRef = ref<HTMLDialogElement | null>(null);

watch(
  [() => props.bookId, () => props.isOpen],
  ([newId, isOpen]) => {
    imageError.value = false;
    if (newId && isOpen) {
      if (props.initialBook) {
        activeBook.value = props.initialBook;
      }
      void loadDetail(newId);
    } else if (!isOpen) {
      if (modalRef.value?.open) {
        modalRef.value.close();
      }
      activeBook.value = null;
    }
  },
  { immediate: true }
);

function handleClose() {
  emit('close');
}

function handleBorrow() {
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
      open
      class="dialog"
      aria-labelledby="dialog-title"
      @keydown.esc="handleClose"
    >
      <!-- Header Hộp Thoại -->
      <header class="dialog-header">
        <div class="header-titles">
          <span class="header-eyebrow">
            <span class="eyebrow-spark"></span>
            Thông tin ấn phẩm
          </span>
          <h1 id="dialog-title" tabindex="-1">Chi tiết sách</h1>
        </div>
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

      <!-- Nội Dung Thân Hộp Thoại -->
      <div class="dialog-body">
        <div v-if="loading && !activeBook" class="loading-state">
          <span class="spinner"></span> Đang tải thông tin chi tiết…
        </div>

        <div v-else-if="error && !activeBook" class="notice error">
          <p>{{ error }}</p>
        </div>

        <template v-else-if="activeBook">
          <!-- KHỐI TIÊU ĐIỂM (HERO SHOWCASE): Bìa sách 3D + Phân loại + Tựa đề + Tác giả -->
          <div class="summary-block record-hero">
            <div
              class="cover large"
              :class="{
                'has-image': activeBook.coverImageUrl && !imageError,
                'is-reference': activeBook.bookType !== 'TEXTBOOK',
              }"
              :aria-label="activeBook.title"
            >
              <img
                v-if="activeBook.coverImageUrl && !imageError"
                :src="activeBook.coverImageUrl"
                :alt="activeBook.title"
                class="cover-image"
                @error="handleImageError"
              />
              <div v-else class="cover-fallback-large" role="img" :aria-label="activeBook.title">
                <div class="spine-accent-large"></div>
                <div class="fallback-large-inner">
                  <div class="large-crest">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </div>
                  <span class="fallback-brand">CTULIB</span>
                  <span class="fallback-type-pill">{{ activeBook.bookType === 'TEXTBOOK' ? 'GIÁO TRÌNH' : 'THAM KHẢO' }}</span>
                </div>
                <div class="large-edge-shadow"></div>
              </div>
            </div>

            <div class="record-hero-info">
              <!-- Cặp huy hiệu trạng thái tinh gọn -->
              <div class="hero-pills">
                <span class="badge" :class="activeBook.bookType === 'TEXTBOOK' ? 'blue' : 'orange'">
                  <span class="badge-dot"></span>
                  {{ activeBook.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Sách tham khảo' }}
                </span>
                <span class="badge" :class="activeBook.isAvailableForCirculation ? 'green' : 'red'">
                  <span class="badge-dot"></span>
                  {{ activeBook.isAvailableForCirculation ? 'Đang lưu hành' : 'Ngừng lưu hành' }}
                </span>
              </div>

              <!-- Tựa Đề Sách -->
              <h2>{{ activeBook.title }}</h2>

              <!-- Dòng Tác Giả -->
              <div class="record-author">
                <span class="author-chip-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </span>
                <span class="author-label">Tác giả:</span>
                <strong>{{ authorNames || 'Chưa rõ tác giả' }}</strong>
              </div>
            </div>
          </div>

          <!-- BẢNG BIÊN MỤC THƯ VIỆN HIỆN ĐẠI (BIBLIOGRAPHIC LEDGER) -->
          <div class="bibliographic-card">
            <dl class="detail-pairs">
              <!-- Dòng 1: Loại Sách & Khoa/Viện -->
              <div class="ledger-row">
                <div class="ledger-cell">
                  <dt>LOẠI SÁCH</dt>
                  <dd>{{ activeBook.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Sách tham khảo' }}</dd>
                </div>
                <div class="ledger-cell">
                  <dt>KHOA/VIỆN</dt>
                  <dd>{{ facultyName || 'Đại học Cần Thơ' }}</dd>
                </div>
              </div>

              <!-- Dòng 2: Nhà Xuất Bản & Năm Xuất Bản -->
              <div class="ledger-row">
                <div class="ledger-cell">
                  <dt>NHÀ XUẤT BẢN</dt>
                  <dd>{{ activeBook.publisher || 'NXB Đại học Cần Thơ' }}</dd>
                </div>
                <div class="ledger-cell">
                  <dt>NĂM XUẤT BẢN</dt>
                  <dd>{{ activeBook.publicationYear || 'Chưa cập nhật' }}</dd>
                </div>
              </div>

              <!-- Dòng 3: Giá Bìa (dd.num duy nhất cho test) & Khả Dụng -->
              <div class="ledger-row highlight-row">
                <div class="ledger-cell">
                  <dt>GIÁ BÌA</dt>
                  <dd class="num price-val">{{ formattedPrice }}</dd>
                </div>
                <div class="ledger-cell">
                  <dt>KHẢ DỤNG</dt>
                  <dd>
                    <span class="availability-status">
                      <span class="status-indicator" :class="{ empty: !isAvailable }"></span>
                      <span class="availability" :class="{ empty: !isAvailable }">
                        {{ isAvailable ? `${activeBook.availableCopies} bản` : 'Hết bản khả dụng' }}
                      </span>
                    </span>
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <!-- THẺ YÊU CẦU ĐĂNG NHẬP -->
          <div v-if="!isLoggedIn" class="notice info auth-prompt-box">
            <div class="auth-icon-badge" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div class="auth-prompt-text">
              <strong>Yêu cầu đăng nhập</strong>
              <p>Bạn cần đăng nhập tài khoản CTULib để thực hiện chức năng mượn sách.</p>
            </div>
          </div>
        </template>
      </div>

      <!-- Chân Hộp Thoại -->
      <footer class="dialog-footer">
        <button class="btn btn-close-modal" type="button" @click="handleClose">Đóng</button>
        <button
          v-if="activeBook"
          class="btn primary btn-borrow-action"
          type="button"
          :disabled="!isAvailable"
          @click="handleBorrow"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>{{ isLoggedIn ? 'Đặt mượn' : 'Đăng nhập để mượn' }}</span>
        </button>
      </footer>
    </dialog>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 20px;
}

.dialog {
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  width: min(740px, calc(100% - 32px));
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.28), 0 4px 16px -4px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  background: #ffffff;
}

/* ==========================================================================
   HEADER MODAL
   ========================================================================== */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 22px 28px 18px;
  border-bottom: 1px solid #f1f5f9;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.header-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  color: #1d4ed8;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.eyebrow-spark {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2563eb;
}

.dialog-header h1 {
  font-size: 22px;
  line-height: 1.25;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.dialog-body {
  padding: 24px 28px;
}

/* ==========================================================================
   KHỐI TIÊU ĐIỂM (RECORD HERO)
   ========================================================================== */
.record-hero {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 22px;
}

.cover.large {
  width: 108px;
  height: 152px;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: none;
  box-shadow:
    inset -1px 0 2px rgba(255, 255, 255, 0.8),
    0 8px 22px -4px rgba(15, 23, 42, 0.16),
    0 2px 6px -2px rgba(15, 23, 42, 0.06);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback-large {
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #f0f7ff 0%, #dceaff 100%);
  display: flex;
  position: relative;
  overflow: hidden;
}

.cover.large.is-reference .cover-fallback-large {
  background: linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%);
}

.spine-accent-large {
  width: 7px;
  height: 100%;
  background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%);
  flex-shrink: 0;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.1);
}

.cover.large.is-reference .spine-accent-large {
  background: linear-gradient(180deg, #d97706 0%, #b45309 100%);
}

.fallback-large-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #1d4ed8;
  z-index: 2;
}

.cover.large.is-reference .fallback-large-inner {
  color: #b45309;
}

.large-crest {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ffffff;
  display: grid;
  place-items: center;
  box-shadow: 0 3px 8px rgba(29, 78, 216, 0.15);
}

.cover.large.is-reference .large-crest {
  box-shadow: 0 3px 8px rgba(217, 119, 6, 0.18);
}

.fallback-brand {
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.14em;
  color: #1e3a8a;
}

.cover.large.is-reference .fallback-brand {
  color: #78350f;
}

.fallback-type-pill {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #3b82f6;
}

.cover.large.is-reference .fallback-type-pill {
  color: #b45309;
}

.large-edge-shadow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.06));
  pointer-events: none;
}

.record-hero-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.record-hero-info h2 {
  font-size: 22px;
  line-height: 1.32;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.018em;
}

.record-author {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1e3a8a;
}

.author-chip-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: #eff6ff;
  color: #2563eb;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}

.author-label {
  font-size: 13.5px;
  color: #64748b;
  font-weight: 500;
}

.record-author strong {
  font-weight: 700;
  color: #1e3a8a;
}

/* ==========================================================================
   BẢNG BIÊN MỤC THƯ VIỆN (BIBLIOGRAPHIC LEDGER CARD)
   Thay thế 6 ô xám thô bằng bảng thông số tinh tế, sang trọng
   ========================================================================== */
.bibliographic-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.02);
}

.detail-pairs {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.ledger-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #edf2f7;
}

.ledger-row:last-child {
  border-bottom: none;
}

.ledger-cell {
  padding: 13px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-right: 1px solid #edf2f7;
}

.ledger-cell:last-child {
  border-right: none;
}

.ledger-cell dt {
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #64748b;
}

.ledger-cell dd {
  margin: 0;
  font-size: 14.5px;
  line-height: 21px;
  font-weight: 650;
  color: #0f172a;
}

/* Hàng nổi bật: Giá bìa & Khả dụng */
.highlight-row {
  background: #ffffff;
}

.price-val {
  color: #1d4ed8 !important;
  font-size: 16px !important;
  font-weight: 750 !important;
}

.availability-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18);
}

.status-indicator.empty {
  background: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18);
}

.availability {
  font-weight: 700;
  color: #15803d;
}

.availability.empty {
  color: #b91c1c;
}

/* ==========================================================================
   THẺ YÊU CẦU ĐĂNG NHẬP (AUTH PROMPT CALLOUT)
   ========================================================================== */
.auth-prompt-box {
  margin-top: 18px;
  border-radius: 14px;
  padding: 14px 18px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  display: flex;
  align-items: center;
  gap: 14px;
}

.auth-icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #ffffff;
  color: #1d4ed8;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(29, 78, 216, 0.1);
}

.auth-prompt-text strong {
  display: block;
  font-size: 14px;
  color: #1e3a8a;
  margin-bottom: 2px;
}

.auth-prompt-text p {
  margin: 0;
  font-size: 13.5px;
  color: #334155;
}

/* ==========================================================================
   FOOTER MODAL
   ========================================================================== */
.dialog-footer {
  padding: 18px 28px;
  background: #ffffff;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-close-modal {
  min-height: 42px;
  padding: 9px 20px;
  border-radius: 10px;
}

.btn-borrow-action {
  min-height: 42px;
  padding: 9px 22px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14.5px;
}

@media (max-width: 640px) {
  .record-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .ledger-row {
    grid-template-columns: 1fr;
  }

  .ledger-cell {
    border-right: none;
    border-bottom: 1px solid #edf2f7;
  }

  .dialog-footer {
    padding: 16px 20px;
  }

  .btn-borrow-action, .btn-close-modal {
    flex: 1;
  }
}
</style>
