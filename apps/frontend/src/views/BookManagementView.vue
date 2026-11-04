<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { currentUser } from '../services/auth';
import { getAllBooks, createBook, BookApiError } from '../services/book';
import type { Book, CreateBookPayload, PaginationMeta } from '../types/book';
import { FACULTIES, AUTHORS } from '../types/book';
import BookManagementTable from '../components/management/BookManagementTable.vue';
import BookFormModal from '../components/management/BookFormModal.vue';
import BookPagination from '../components/catalog/BookPagination.vue';
import BookDetailModal from '../components/catalog/BookDetailModal.vue';

const isAuthorized = computed(() => {
  return currentUser.value && currentUser.value.role !== 'READER';
});

const books = ref<Book[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const pagination = reactive<PaginationMeta>({
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  limit: 10,
});

// Modal state
const isFormModalOpen = ref(false);
const isSubmitting = ref(false);
const serverError = ref<string | null>(null);
const serverFieldErrors = ref<Record<string, string>>({});

// View detail modal state
const selectedBook = ref<Book | null>(null);
const isDetailModalOpen = ref(false);

const facultyOptions = computed(() => {
  return FACULTIES.map((f) => ({
    _id: f.facultyId,
    facultyName: f.facultyName,
  }));
});

const authorOptions = computed(() => {
  return AUTHORS.map((a) => ({
    _id: a.authorId,
    fullName: a.fullName,
    affiliation: a.affiliation,
  }));
});

const facultiesMap = computed(() => {
  const map: Record<string, string> = {};
  for (const f of FACULTIES) {
    map[f.facultyId] = f.facultyName;
  }
  return map;
});

const authorsMap = computed(() => {
  const map: Record<string, string> = {};
  for (const a of AUTHORS) {
    map[a.authorId] = a.fullName;
  }
  return map;
});

async function loadManagementBooks() {
  if (!isAuthorized.value) return;
  loading.value = true;
  error.value = null;
  try {
    const res = await getAllBooks({
      page: pagination.currentPage,
      limit: pagination.limit,
    });
    books.value = res.items || [];
    pagination.totalItems = res.meta?.totalItems ?? res.items.length;
    pagination.totalPages = res.meta?.totalPages ?? 1;
    pagination.currentPage = res.meta?.currentPage ?? 1;
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    error.value = errObj?.message || 'Không thể tải danh sách quản lý.';
  } finally {
    loading.value = false;
  }
}

function onPageChange(page: number) {
  pagination.currentPage = page;
  void loadManagementBooks();
}

function onLimitChange(newLimit: number) {
  pagination.limit = newLimit;
  pagination.currentPage = 1;
  void loadManagementBooks();
}

function openAddBookModal() {
  serverError.value = null;
  serverFieldErrors.value = {};
  isFormModalOpen.value = true;
}

function closeAddBookModal() {
  isFormModalOpen.value = false;
  serverError.value = null;
  serverFieldErrors.value = {};
}

async function handleCreateBook(payload: CreateBookPayload) {
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};
  try {
    await createBook(payload);
    successMessage.value = `Đã thêm sách "${payload.title}" thành công vào hệ thống.`;
    closeAddBookModal();
    void loadManagementBooks();
    setTimeout(() => {
      successMessage.value = null;
    }, 5000);
  } catch (err: unknown) {
    if (err instanceof BookApiError) {
      serverError.value = err.message;
      if (err.fields) {
        serverFieldErrors.value = err.fields;
      }
    } else {
      serverError.value = 'Đã xảy ra lỗi khi tạo sách mới.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

function onViewBook(book: Book) {
  selectedBook.value = book;
  isDetailModalOpen.value = true;
}

function closeDetailModal() {
  isDetailModalOpen.value = false;
  selectedBook.value = null;
}

onMounted(() => {
  if (isAuthorized.value) {
    void loadManagementBooks();
  }
});
</script>

<template>
  <div class="management-view container">
    <!-- Trường hợp không có quyền -->
    <div v-if="!isAuthorized" class="notice warning" role="alert" style="margin-top: 32px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <strong>Giới hạn quyền truy cập (403 Forbidden)</strong>
        <p>Khu vực này chỉ dành cho Cán bộ thư viện hoặc Quản trị viên (vai trò EMPLOYEE hoặc ADMIN). Vui lòng đăng nhập bằng tài khoản nội bộ để quản lý kho sách.</p>
      </div>
    </div>

    <!-- Màn hình quản lý khi có quyền -->
    <template v-else>
      <div class="page-head">
        <div>
          <p class="eyebrow">QUẢN TRỊ THƯ VIỆN</p>
          <h1>Quản lý danh mục sách & lưu thông</h1>
          <p>Xem toàn bộ ấn phẩm trong kho, theo dõi số bản khả dụng và thêm mới sách vào hệ thống.</p>
        </div>
        <button class="btn primary" type="button" @click="openAddBookModal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm sách mới
        </button>
      </div>

      <!-- Thông báo thành công -->
      <div v-if="successMessage" class="notice success" style="margin-bottom: 20px" role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div>
          <p>{{ successMessage }}</p>
        </div>
      </div>

      <!-- Bảng quản lý SC12 -->
      <BookManagementTable
        :books="books"
        :loading="loading"
        :faculties-map="facultiesMap"
        @view="onViewBook"
      />

      <!-- Phân trang -->
      <BookPagination
        v-if="!loading && pagination.totalPages > 1"
        :current-page="pagination.currentPage"
        :total-pages="pagination.totalPages"
        :total-items="pagination.totalItems"
        :limit="pagination.limit"
        :is-loading="loading"
        @page-change="onPageChange"
        @change-limit="onLimitChange"
      />

      <!-- Modal thêm sách SC13 -->
      <BookFormModal
        :is-open="isFormModalOpen"
        :faculties="facultyOptions"
        :authors="authorOptions"
        :is-submitting="isSubmitting"
        :server-error="serverError"
        :server-field-errors="serverFieldErrors"
        @close="closeAddBookModal"
        @submit="handleCreateBook"
      />

      <!-- Modal xem chi tiết sách SC05 -->
      <BookDetailModal
        :is-open="isDetailModalOpen"
        :book-id="selectedBook?.bookId || null"
        :initial-book="selectedBook"
        :faculty-name="selectedBook ? facultiesMap[selectedBook.facultyId] : undefined"
        :author-names="selectedBook?.authorIds ? selectedBook.authorIds.map(id => authorsMap[id] || id).join(', ') : undefined"
        @close="closeDetailModal"
      />
    </template>
  </div>
</template>
