<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { currentUser } from '../services/auth';
import { canAccess } from '../middlewares/access';
import { getAllBooks, createBook, updateBook, adjustBookInventory, BookApiError } from '../services/book';
import { getAllAuthors } from '../services/author';
import { getAllFaculties } from '../services/faculty';
import type { Book, CreateBookPayload, PaginationMeta } from '../types/book';
import type { Author } from '../types/author';
import type { Faculty } from '../types/faculty';
import { FACULTIES, AUTHORS } from '../types/book';
import BookManagementTable from '../components/management/BookManagementTable.vue';
import BookFormModal from '../components/management/BookFormModal.vue';
import BookPagination from '../components/catalog/BookPagination.vue';
import BookDetailModal from '../components/catalog/BookDetailModal.vue';

const isAuthorized = computed(() => {
  return canAccess(currentUser.value, 'management');
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
const editingBook = ref<Book | null>(null);

// View detail modal state
const selectedBook = ref<Book | null>(null);
const isDetailModalOpen = ref(false);
const inventoryBook = ref<Book | null>(null);
const inventoryDialog = ref<HTMLDialogElement | null>(null);
const inventoryDelta = ref('1');
const inventoryReason = ref('');
const inventoryError = ref('');
const inventorySaving = ref(false);
let inventoryReturnFocus: HTMLElement | null = null;

// Dynamic catalog options
const dynamicAuthors = ref<Author[]>([]);
const dynamicFaculties = ref<Faculty[]>([]);
const catalogLoading = ref(true);
const catalogError = ref('');
const catalogReady = computed(() => !catalogLoading.value && !catalogError.value && dynamicFaculties.value.length > 0 && dynamicAuthors.value.length > 0);
let booksRequestId = 0;
let catalogRequestId = 0;

const facultyOptions = computed(() => {
  return dynamicFaculties.value.map((f) => ({
    _id: f._id,
    facultyName: f.facultyName,
  }));
});

const authorOptions = computed(() => {
  return dynamicAuthors.value.map((a) => ({
    _id: a._id,
    fullName: a.fullName,
    affiliation: a.affiliation,
  }));
});

const facultiesMap = computed(() => {
  const map: Record<string, string> = {};
  for (const f of FACULTIES) {
    map[f.facultyId] = f.facultyName;
  }
  for (const f of dynamicFaculties.value) {
    map[f._id] = f.facultyName;
  }
  return map;
});

const authorsMap = computed(() => {
  const map: Record<string, string> = {};
  for (const a of AUTHORS) {
    map[a.authorId] = a.fullName;
  }
  for (const a of dynamicAuthors.value) {
    map[a._id] = a.fullName;
  }
  return map;
});

async function loadCatalogs() {
  const requestId = ++catalogRequestId;
  catalogLoading.value = true;
  catalogError.value = '';
  const [fetchedAuthors, fetchedFaculties] = await Promise.allSettled([
      getAllAuthors(),
      getAllFaculties(),
  ]);
  if (requestId !== catalogRequestId) return;
  dynamicAuthors.value = fetchedAuthors.status === 'fulfilled' && Array.isArray(fetchedAuthors.value) ? fetchedAuthors.value : [];
  dynamicFaculties.value = fetchedFaculties.status === 'fulfilled' && Array.isArray(fetchedFaculties.value) ? fetchedFaculties.value : [];
  if (fetchedAuthors.status === 'rejected' || fetchedFaculties.status === 'rejected') {
    catalogError.value = 'Không thể tải danh mục khoa/viện hoặc tác giả từ hệ thống. Hãy thử tải lại trước khi lưu sách.';
  } else if (!dynamicAuthors.value.length || !dynamicFaculties.value.length) {
    catalogError.value = 'Chưa có khoa/viện hoặc tác giả trong hệ thống. Hãy bổ sung danh mục trước khi tạo sách.';
  }
  catalogLoading.value = false;
}

async function loadManagementBooks() {
  if (!isAuthorized.value) return;
  const requestId = ++booksRequestId;
  loading.value = true;
  error.value = null;
  try {
    const res = await getAllBooks({
      page: pagination.currentPage,
      limit: pagination.limit,
    });
    if (requestId !== booksRequestId) return;
    books.value = res.items || [];
    pagination.totalItems = res.meta?.totalItems ?? res.items.length;
    pagination.totalPages = res.meta?.totalPages ?? 1;
    pagination.currentPage = res.meta?.currentPage ?? 1;
  } catch (err: unknown) {
    if (requestId !== booksRequestId) return;
    const errObj = err as { message?: string };
    error.value = errObj?.message || 'Không thể tải danh sách quản lý.';
  } finally {
    if (requestId === booksRequestId) loading.value = false;
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
  if (!catalogReady.value) return;
  editingBook.value = null;
  serverError.value = null;
  serverFieldErrors.value = {};
  isFormModalOpen.value = true;
}

function closeAddBookModal(force = false) {
  if (isSubmitting.value && !force) return;
  isFormModalOpen.value = false;
  serverError.value = null;
  serverFieldErrors.value = {};
  editingBook.value = null;
}

function openEditBookModal(book: Book) {
  if (!catalogReady.value) return;
  editingBook.value = book;
  serverError.value = null;
  serverFieldErrors.value = {};
  isFormModalOpen.value = true;
}

async function handleCreateBook(payload: CreateBookPayload) {
  if (isSubmitting.value) return;
  if (!catalogReady.value) {
    serverError.value = 'Danh mục khoa/viện và tác giả chưa sẵn sàng. Vui lòng tải lại.';
    return;
  }
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};
  try {
    if (editingBook.value) {
      const { totalCopies: _ignored, ...metadata } = payload;
      await updateBook(editingBook.value.bookId, metadata);
      successMessage.value = `Đã cập nhật thông tin sách "${payload.title}".`;
    } else {
      await createBook(payload);
      successMessage.value = `Đã thêm sách "${payload.title}" thành công vào hệ thống.`;
    }
    closeAddBookModal(true);
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
      serverError.value = 'Đã xảy ra lỗi khi lưu thông tin sách.';
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

async function openInventory(book: Book) {
  inventoryReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  inventoryBook.value = book;
  inventoryDelta.value = '1';
  inventoryReason.value = '';
  inventoryError.value = '';
  await nextTick();
  inventoryDialog.value?.showModal();
  inventoryDialog.value?.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
}

function closeInventory() {
  if (inventorySaving.value) return;
  inventoryDialog.value?.close();
  inventoryBook.value = null;
  nextTick(() => inventoryReturnFocus?.focus());
}

async function saveInventory() {
  const book = inventoryBook.value;
  if (!book || inventorySaving.value) return;
  const delta = Number(inventoryDelta.value);
  if (!String(inventoryDelta.value).trim() || !Number.isSafeInteger(delta) || delta === 0) {
    inventoryError.value = 'Nhập số nguyên khác 0 (dùng dấu trừ để giảm kho).';
    return;
  }
  if (delta < 0 && -delta > book.availableCopies) {
    inventoryError.value = `Chỉ có ${book.availableCopies} bản khả dụng để giảm kho.`;
    return;
  }
  if (inventoryReason.value.trim().length < 5) {
    inventoryError.value = 'Lý do điều chỉnh phải có ít nhất 5 ký tự.';
    return;
  }
  inventorySaving.value = true;
  inventoryError.value = '';
  try {
    await adjustBookInventory(book.bookId, delta, inventoryReason.value.trim());
    successMessage.value = `Đã ${delta > 0 ? 'tăng' : 'giảm'} ${Math.abs(delta)} bản sách "${book.title}".`;
    inventorySaving.value = false;
    closeInventory();
    await loadManagementBooks();
  } catch (cause) {
    inventoryError.value = cause instanceof Error ? cause.message : 'Không thể điều chỉnh tồn kho.';
  } finally { inventorySaving.value = false; }
}

onMounted(() => {
  if (isAuthorized.value) {
    void loadManagementBooks();
    void loadCatalogs();
  }
});

onBeforeUnmount(() => {
  booksRequestId++;
  catalogRequestId++;
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
          <h1>Quản lý danh mục sách & lưu thông</h1>
          <p>Xem toàn bộ ấn phẩm trong kho, theo dõi số bản khả dụng và thêm mới sách vào hệ thống.</p>
        </div>
        <button class="btn primary" type="button" :disabled="!catalogReady" @click="openAddBookModal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm sách mới
        </button>
      </div>

      <div v-if="catalogLoading" class="notice" role="status">Đang tải danh mục khoa/viện và tác giả…</div>
      <div v-else-if="catalogError" class="notice warning" role="alert">
        {{ catalogError }}
        <button class="btn small" type="button" @click="loadCatalogs">Tải lại danh mục</button>
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
        :current-page="pagination.currentPage"
        :page-size="pagination.limit"
        :error="error"
        @view="onViewBook"
        @edit="openEditBookModal"
        @inventory="openInventory"
      />
      <button v-if="error && !loading" class="btn" type="button" @click="loadManagementBooks">Thử tải lại danh sách sách</button>

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
        :edit-mode="!!editingBook"
        :initial-data="editingBook || undefined"
        :faculties="facultyOptions"
        :authors="authorOptions"
        :is-submitting="isSubmitting"
        :server-error="serverError"
        :server-field-errors="serverFieldErrors"
        @close="closeAddBookModal()"
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

      <dialog v-if="inventoryBook" ref="inventoryDialog" class="dialog inventory-dialog" aria-labelledby="inventory-title" @cancel.prevent="closeInventory">
        <header class="dialog-header"><h2 id="inventory-title">Điều chỉnh tồn kho</h2><button type="button" class="btn small" :disabled="inventorySaving" @click="closeInventory">Đóng</button></header>
        <form novalidate @submit.prevent="saveInventory">
          <div class="dialog-body">
            <p><strong>{{ inventoryBook.title }}</strong></p>
            <p class="muted">Hiện có {{ inventoryBook.totalCopies }} bản, trong đó {{ inventoryBook.availableCopies }} bản khả dụng. Chỉ giảm tối đa số bản khả dụng.</p>
            <p v-if="inventoryError" class="notice error" role="alert">{{ inventoryError }}</p>
            <label class="field"><span>Số lượng thay đổi <b class="required">*</b></span><input v-model="inventoryDelta" type="number" step="1" required :disabled="inventorySaving" :aria-invalid="!!inventoryError" placeholder="Ví dụ: 3 hoặc -2"><small class="muted">Nhập số dương để bổ sung, số âm để giảm.</small></label>
            <label class="field"><span>Lý do điều chỉnh <b class="required">*</b></span><textarea v-model="inventoryReason" rows="3" minlength="5" maxlength="500" required :disabled="inventorySaving" placeholder="Ví dụ: Kiểm kê bổ sung sách" :aria-invalid="!!inventoryError"></textarea></label>
          </div>
          <footer class="dialog-footer"><button class="btn" type="button" :disabled="inventorySaving" @click="closeInventory">Hủy</button><button class="btn primary" type="submit" :disabled="inventorySaving">{{ inventorySaving ? 'Đang lưu…' : 'Xác nhận điều chỉnh' }}</button></footer>
        </form>
      </dialog>
    </template>
  </div>
</template>

<style scoped>
.inventory-dialog { position: fixed; inset: 0; margin: auto; width: min(520px, calc(100vw - 24px)); max-height: 90dvh; overflow-y: auto; }
.inventory-dialog:not([open]) { display: none; }
.inventory-dialog .field { margin-top: 14px; }
</style>
