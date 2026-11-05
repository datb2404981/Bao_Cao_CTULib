<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { currentUser } from '../services/auth';
import {
  getAllAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  AuthorApiError,
} from '../services/author';
import type { Author, CreateAuthorPayload, UpdateAuthorPayload } from '../types/author';
import AuthorTable from '../components/author/AuthorTable.vue';
import AuthorFormModal from '../components/author/AuthorFormModal.vue';

const isAuthorized = computed(() => {
  return currentUser.value && currentUser.value.role !== 'READER';
});

const authors = ref<Author[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Search query
const searchQuery = ref('');

// Modal state
const isModalOpen = ref(false);
const editingAuthor = ref<Author | null>(null);
const isSubmitting = ref(false);
const serverError = ref<string | null>(null);
const serverFieldErrors = ref<Record<string, string>>({});

// Filtered authors
const filteredAuthors = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return authors.value;

  return authors.value.filter((a) => {
    const nameMatch = a.fullName.toLowerCase().includes(query);
    const idMatch = a._id.toLowerCase().includes(query);
    const codeMatch = `tg-${a._id.slice(-6)}`.toLowerCase().includes(query);
    const affMatch = (a.affiliation || '').toLowerCase().includes(query);
    const notesMatch = (a.notes || '').toLowerCase().includes(query);
    return nameMatch || idMatch || codeMatch || affMatch || notesMatch;
  });
});

async function loadAuthors() {
  loading.value = true;
  error.value = null;
  try {
    const data = await getAllAuthors();
    authors.value = data || [];
  } catch (err: unknown) {
    if (err instanceof AuthorApiError) {
      error.value = err.message;
    } else {
      error.value = 'Không thể tải danh sách Tác giả. Vui lòng thử lại sau.';
    }
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingAuthor.value = null;
  serverError.value = null;
  serverFieldErrors.value = {};
  isModalOpen.value = true;
}

function openEditModal(author: Author) {
  editingAuthor.value = author;
  serverError.value = null;
  serverFieldErrors.value = {};
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingAuthor.value = null;
  serverError.value = null;
  serverFieldErrors.value = {};
}

function showSuccess(msg: string) {
  successMessage.value = msg;
  setTimeout(() => {
    if (successMessage.value === msg) {
      successMessage.value = null;
    }
  }, 5000);
}

async function handleModalSubmit(payload: CreateAuthorPayload | UpdateAuthorPayload) {
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};

  try {
    if (editingAuthor.value) {
      // Update mode
      const updated = await updateAuthor(editingAuthor.value._id, payload);
      showSuccess(`Đã cập nhật thông tin tác giả "${updated.fullName}" thành công.`);
    } else {
      // Create mode
      const created = await createAuthor(payload);
      showSuccess(`Đã thêm tác giả "${created.fullName}" mới thành công.`);
    }

    closeModal();
    await loadAuthors();
  } catch (err: unknown) {
    if (err instanceof AuthorApiError) {
      serverError.value = err.message;
      if (err.fields) {
        serverFieldErrors.value = err.fields;
      }
    } else {
      serverError.value = 'Đã có lỗi xảy ra khi lưu thông tin. Vui lòng kiểm tra lại.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDeleteAuthor(authorId: string) {
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};

  try {
    const deleted = await deleteAuthor(authorId);
    showSuccess(`Đã xóa tác giả "${deleted?.fullName || authorId}" thành công.`);
    closeModal();
    await loadAuthors();
  } catch (err: unknown) {
    if (err instanceof AuthorApiError) {
      serverError.value = err.message;
    } else {
      serverError.value = 'Không thể xóa tác giả này. Vui lòng thử lại sau.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  void loadAuthors();
});
</script>

<template>
  <div class="author-view container" data-screen="SC16">
    <!-- Cảnh báo nếu không có quyền quản lý -->
    <div v-if="!isAuthorized" class="notice warning" role="alert" style="margin-top: 24px">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <strong>Giới hạn quyền thao tác (Yêu cầu đăng nhập nội bộ)</strong>
        <p>Bạn chỉ có thể xem danh mục Tác giả. Để thêm, sửa hoặc xóa tác giả, vui lòng đăng nhập với tài khoản Cán bộ thư viện hoặc Quản trị viên.</p>
      </div>
    </div>

    <!-- Header giao diện chuẩn SC16 -->
    <div class="page-head">
      <div>
        <h1>Tác giả</h1>
        <p class="page-sub">Quản lý danh mục các tác giả và đơn vị công tác trong hệ thống CTULib.</p>
      </div>
      <button
        v-if="isAuthorized"
        class="btn primary add-btn"
        type="button"
        @click="openCreateModal"
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
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Thêm tác giả</span>
      </button>
    </div>

    <!-- Thông báo thành công -->
    <div v-if="successMessage" class="notice success" role="status" style="margin-bottom: 20px">
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
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <div>
        <p>{{ successMessage }}</p>
      </div>
    </div>

    <!-- Thông báo lỗi load danh sách -->
    <div v-if="error" class="notice error" role="alert" style="margin-bottom: 20px">
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
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Thanh tìm kiếm lọc SC16 -->
    <form class="filters" @submit.prevent>
      <div class="filter-row">
        <div class="field search-field">
          <div class="search-box">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              name="search"
              aria-label="Tìm theo tên hoặc mã tác giả"
              placeholder="Tìm theo tên hoặc mã tác giả…"
            />
          </div>
        </div>
      </div>
    </form>

    <!-- Bảng danh sách SC16 -->
    <AuthorTable
      :authors="filteredAuthors"
      :loading="loading"
      :search-query="searchQuery"
      @edit="openEditModal"
    />

    <!-- Footer thống kê số lượng -->
    <div v-if="!loading" class="table-footer-info">
      <span>Hiển thị {{ filteredAuthors.length }} / {{ authors.length }} tác giả</span>
    </div>

    <!-- Modal Form Thêm/Chỉnh sửa SC16 -->
    <AuthorFormModal
      :is-open="isModalOpen"
      :author-to-edit="editingAuthor"
      :is-submitting="isSubmitting"
      :server-error="serverError"
      :server-field-errors="serverFieldErrors"
      @close="closeModal"
      @submit="handleModalSubmit"
      @delete="handleDeleteAuthor"
    />
  </div>
</template>

<style scoped>
.author-view {
  padding-bottom: 48px;
}

.page-sub {
  color: var(--muted, #64748b);
  margin-top: 4px;
  font-size: 14px;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.filters {
  margin-bottom: 20px;
}

.search-field {
  flex: 1;
  max-width: 480px;
}

.table-footer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 4px;
  font-size: 13px;
  color: var(--muted, #64748b);
}
</style>

