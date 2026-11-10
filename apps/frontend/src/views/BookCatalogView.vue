<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { getAllBooks } from '@/services/book';
import type { Book, PaginationMeta } from '../types/book';
import { FACULTIES, AUTHORS } from '../types/book';
import { getAllFaculties } from '../services/faculty';
import { getAllAuthors } from '../services/author';
import type { Faculty } from '../types/faculty';
import type { Author } from '../types/author';
import BookFilters from '../components/catalog/BookFilters.vue';
import BookGrid from '../components/catalog/BookGrid.vue';
import BookPagination from '../components/catalog/BookPagination.vue';
import BookDetailModal from '../components/catalog/BookDetailModal.vue';
import { reserveBook } from '../services/loan';
import type { LoanRecord } from '../types/loan';
import ReservationDialog from '../components/catalog/ReservationDialog.vue';

const emit = defineEmits<{
  (e: 'navigate', view: 'catalog' | 'management' | 'auth' | 'my-loans'): void;
}>();

const books = ref<Book[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const dynamicFaculties = ref<Faculty[]>([]);
const dynamicAuthors = ref<Author[]>([]);
const catalogError = ref('');
let catalogRequestId = 0;

const pagination = reactive<PaginationMeta>({
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  limit: 12,
});

const filters = reactive({
  search: '',
  facultyId: '',
  bookType: '',
});

let activeRequestId = 0;
let pendingRequestKey: string | null = null;

// Modal state
const selectedBook = ref<Book | null>(null);
const isDetailModalOpen = ref(false);
const reservationBusy = ref(false);
const reservationError = ref('');
const reservationStep = ref<'idle' | 'confirm' | 'success'>('idle');
const reservationLoan = ref<LoanRecord | null>(null);

const facultyOptions = computed(() => {
  return dynamicFaculties.value.map((f) => ({
    _id: f._id,
    facultyName: f.facultyName,
  }));
});

const facultiesMap = computed(() => {
  const map: Record<string, string> = {};
  for (const f of FACULTIES) {
    map[f.facultyId] = f.facultyName;
  }
  for (const f of dynamicFaculties.value) map[f._id] = f.facultyName;
  return map;
});

const authorsMap = computed(() => {
  const map: Record<string, string> = {};
  for (const a of AUTHORS) {
    map[a.authorId] = a.fullName;
  }
  for (const a of dynamicAuthors.value) map[a._id] = a.fullName;
  return map;
});

async function loadCatalogs() {
  const requestId = ++catalogRequestId;
  catalogError.value = '';
  const [faculties, authors] = await Promise.allSettled([getAllFaculties(), getAllAuthors()]);
  if (requestId !== catalogRequestId) return;
  const facultiesValid = faculties.status === 'fulfilled' && Array.isArray(faculties.value);
  const authorsValid = authors.status === 'fulfilled' && Array.isArray(authors.value);
  dynamicFaculties.value = facultiesValid ? faculties.value : [];
  dynamicAuthors.value = authorsValid ? authors.value : [];
  if (!facultiesValid || !authorsValid) {
    catalogError.value = 'Không tải được toàn bộ danh mục khoa/viện và tác giả.';
  }
}

watch(
  () => filters.search,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      pagination.currentPage = 1;
      void loadBooks();
    }
  }
);

async function loadBooks() {
  const params = {
    page: pagination.currentPage,
    limit: pagination.limit,
    search: filters.search.trim() || undefined,
    facultyId: filters.facultyId || undefined,
    bookType: filters.bookType === 'TEXTBOOK' || filters.bookType === 'REFERENCE' ? filters.bookType : undefined,
  } as const;
  const key = JSON.stringify(params);
  if (pendingRequestKey === key) return;
  const requestId = ++activeRequestId;
  pendingRequestKey = key;
  loading.value = true;
  error.value = null;
  try {
    const res = await getAllBooks(params);
    if (requestId !== activeRequestId) return;
    const items = res.items || [];
    books.value = items;
    pagination.totalItems = res.meta?.totalItems ?? items.length;
    pagination.totalPages = res.meta?.totalPages ?? (items.length ? 1 : 0);
    pagination.currentPage = res.meta?.currentPage ?? 1;
  } catch (err: unknown) {
    if (requestId !== activeRequestId) return;
    error.value = err instanceof Error ? err.message : 'Không thể tải danh sách sách.';
    books.value = [];
  } finally {
    if (requestId === activeRequestId) {
      pendingRequestKey = null;
      loading.value = false;
    }
  }
}

function onSearch() {
  pagination.currentPage = 1;
  void loadBooks();
}

function onResetFilters() {
  filters.search = '';
  filters.facultyId = '';
  filters.bookType = '';
  pagination.currentPage = 1;
  void loadBooks();
}

function resetAllAndScrollTop() {
  onResetFilters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function focusSearchInput() {
  const el = document.getElementById('catalog-search-input');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
  }
}

defineExpose({
  resetAllAndScrollTop,
  focusSearchInput,
});

function onPageChange(page: number) {
  pagination.currentPage = page;
  void loadBooks();
}

function onLimitChange(newLimit: number) {
  pagination.limit = newLimit;
  pagination.currentPage = 1;
  void loadBooks();
}

function openDetailModal(book: Book) {
  reservationError.value = '';
  reservationStep.value = 'idle';
  reservationLoan.value = null;
  selectedBook.value = book;
  isDetailModalOpen.value = true;
}

function closeDetailModal() {
  isDetailModalOpen.value = false;
  selectedBook.value = null;
}

function onRequireLogin() {
  closeDetailModal();
  emit('navigate', 'auth');
}

function beginReservation(book: Book) {
  if (reservationBusy.value || reservationStep.value !== 'idle') return;
  selectedBook.value = book;
  isDetailModalOpen.value = false;
  reservationError.value = '';
  reservationStep.value = 'confirm';
}

function closeReservation() {
  if (reservationBusy.value) return;
  reservationStep.value = 'idle';
  selectedBook.value = null;
  reservationLoan.value = null;
  reservationError.value = '';
}

function backToDetail() {
  if (reservationBusy.value || !selectedBook.value) return;
  reservationStep.value = 'idle';
  isDetailModalOpen.value = true;
  reservationError.value = '';
}

async function confirmReservation() {
  const book = selectedBook.value;
  if (!book || reservationBusy.value || reservationStep.value !== 'confirm') return;
  reservationBusy.value = true;
  reservationError.value = '';
  try {
    const loan = await reserveBook(book.bookId);
    reservationLoan.value = loan;
    reservationStep.value = 'success';
    void loadBooks();
  } catch (cause) {
    reservationError.value = cause instanceof Error ? cause.message : 'Không thể đặt giữ chỗ.';
  } finally { reservationBusy.value = false; }
}

onMounted(() => {
  void loadBooks();
  void loadCatalogs();
});

onBeforeUnmount(() => {
  activeRequestId++;
  catalogRequestId++;
  pendingRequestKey = null;
});
</script>

<template>
  <div class="catalog-view container">
    <!-- Hero Header: Tối giản, thanh lịch, chuẩn nhận diện Đại học Cần Thơ -->
    <div class="page-head catalog-hero-banner">
      <div class="hero-left">
        <div class="hero-brand-mark">
          <img src="/ctu-logo.png" alt="Logo Đại học Cần Thơ" class="ctu-crest-img" />
        </div>
        <div class="hero-banner-content">
          <div class="hero-subtitle">Mục lục trực tuyến OPAC · Đại học Cần Thơ</div>
          <h1>Tra cứu Học liệu & Giáo trình</h1>
          <p>
            Cổng kết nối nguồn học liệu số, giáo trình chính quy và tài liệu nghiên cứu chuyên sâu.
          </p>
        </div>
      </div>
    </div>

    <div v-if="catalogError" class="notice warning" role="alert">
      {{ catalogError }} <button class="btn small" type="button" @click="loadCatalogs">Thử lại</button>
    </div>

    <BookFilters
      v-model:search="filters.search"
      v-model:faculty-id="filters.facultyId"
      v-model:book-type="filters.bookType"
      :faculties="facultyOptions"
      :is-loading="loading"
      @submit="onSearch"
      @reset="onResetFilters"
    />

    <p v-if="!loading && !error" class="results-line">
      Tìm thấy <strong class="num">{{ pagination.totalItems }}</strong> ấn phẩm phù hợp.
    </p>

    <BookGrid
      :books="books"
      :loading="loading"
      :error="error"
      :faculties-map="facultiesMap"
      :authors-map="authorsMap"
      @select-book="openDetailModal"
      @retry="loadBooks"
      @reset-filters="onResetFilters"
    />

    <BookPagination
      v-if="!loading && !error && pagination.totalPages > 1"
      :current-page="pagination.currentPage"
      :total-pages="pagination.totalPages"
      :total-items="pagination.totalItems"
      :limit="pagination.limit"
      :is-loading="loading"
      @page-change="onPageChange"
      @change-limit="onLimitChange"
    />

    <BookDetailModal
      :is-open="isDetailModalOpen"
      :book-id="selectedBook?.bookId || null"
      :initial-book="selectedBook"
      :faculty-name="selectedBook ? facultiesMap[selectedBook.facultyId] : undefined"
      :author-names="selectedBook?.authorIds ? selectedBook.authorIds.map(id => authorsMap[id] || id).join(', ') : undefined"
      :reserving="reservationBusy"
      :reservation-error="reservationError"
      @close="closeDetailModal"
      @require-login="onRequireLogin"
      @borrow="beginReservation"
    />
    <ReservationDialog
      :step="reservationStep"
      :book="selectedBook"
      :loan="reservationLoan"
      :busy="reservationBusy"
      :error="reservationError"
      @close="closeReservation"
      @back="backToDetail"
      @confirm="confirmReservation"
      @my-loans="emit('navigate', 'my-loans')"
    />
  </div>
</template>

<style scoped>
.catalog-hero-banner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 22px 26px;
  margin-bottom: 22px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.hero-brand-mark {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  padding: 6px;
}

.ctu-crest-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero-banner-content {
  min-width: 0;
}

.hero-subtitle {
  font-size: 12.5px;
  font-weight: 600;
  color: #1d4ed8;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.hero-banner-content h1 {
  font-size: 22px;
  line-height: 1.3;
  font-weight: 750;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin: 0 0 4px;
}

.hero-banner-content p {
  font-size: 13.5px;
  line-height: 1.5;
  color: #64748b;
  margin: 0;
  max-width: 680px;
}

@media (max-width: 640px) {
  .catalog-hero-banner {
    padding: 16px;
  }

  .hero-left {
    gap: 14px;
  }

  .hero-brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    padding: 5px;
  }

  .hero-banner-content h1 {
    font-size: 19px;
  }

  .hero-banner-content p {
    font-size: 12.5px;
  }
}
</style>
