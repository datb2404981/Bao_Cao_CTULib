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
    // Nếu API trả 401 do chưa đăng nhập, sử dụng initialBook nếu có
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
      <header class="dialog-header">
        <div>
          <h1 id="dialog-title" tabindex="-1">Chi tiết sách</h1>
        </div>
        <button
          class="icon-btn"
          type="button"
          aria-label="Đóng hộp thoại"
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
        <div v-if="loading && !activeBook" class="loading-state">
          <span class="spinner"></span> Đang tải thông tin chi tiết…
        </div>

        <div v-else-if="error && !activeBook" class="notice error">
          <p>{{ error }}</p>
        </div>

        <template v-else-if="activeBook">
          <div class="summary-block">
            <div class="cover">
              <img
                v-if="activeBook.coverImageUrl"
                :src="activeBook.coverImageUrl"
                :alt="activeBook.title"
                class="cover-image"
              />
              <svg
                v-else
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
                <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z" />
                <path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z" />
              </svg>
            </div>
            <div>
              <h2>{{ activeBook.title }}</h2>
              <p class="subline">
                {{ activeBook.bookId }} · {{ authorNames || 'Chưa rõ tác giả' }}
              </p>
            </div>
          </div>

          <hr class="divider" />

          <dl class="detail-pairs">
            <div>
              <dt>Loại sách</dt>
              <dd>{{ activeBook.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Sách tham khảo' }}</dd>
            </div>
            <div>
              <dt>Khoa/Viện</dt>
              <dd>{{ facultyName || 'Đại học Cần Thơ' }}</dd>
            </div>
            <div>
              <dt>Nhà xuất bản</dt>
              <dd>{{ activeBook.publisher || 'NXB Đại học Cần Thơ' }}</dd>
            </div>
            <div>
              <dt>Năm xuất bản</dt>
              <dd>{{ activeBook.publicationYear || 'Chưa cập nhật' }}</dd>
            </div>
            <div>
              <dt>Giá bìa</dt>
              <dd class="num">{{ formattedPrice }}</dd>
            </div>
            <div>
              <dt>Khả dụng</dt>
              <dd>
                <span class="availability" :class="{ empty: !isAvailable }">
                  {{ isAvailable ? `${activeBook.availableCopies} bản` : 'Hết bản khả dụng' }}
                </span>
              </dd>
            </div>
          </dl>

          <div v-if="!isLoggedIn" class="notice info" style="margin-top:20px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div>
              <p>Bạn cần đăng nhập tài khoản CTULib để thực hiện chức năng mượn sách.</p>
            </div>
          </div>
        </template>
      </div>

      <footer class="dialog-footer">
        <button class="btn" type="button" @click="handleClose">Đóng</button>
        <button
          v-if="activeBook"
          class="btn primary"
          type="button"
          :disabled="!isAvailable"
          @click="handleBorrow"
        >
          {{ isLoggedIn ? 'Đặt mượn' : 'Đăng nhập để mượn' }}
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
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 16px;
}
.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
