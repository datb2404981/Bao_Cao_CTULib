<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { currentUser } from '../services/auth';
import { canAccess } from '../middlewares/access';
import {
  getAllPublishers,
  createPublisher,
  updatePublisher,
  deletePublisher,
  PublisherApiError,
} from '../services/publisher';
import type { Publisher, CreatePublisherPayload, UpdatePublisherPayload } from '../types/publisher';
import PublisherTable from '../components/publisher/PublisherTable.vue';
import PublisherFormModal from '../components/publisher/PublisherFormModal.vue';

const isAuthorized = computed(() => {
  return canAccess(currentUser.value, 'publisher');
});

const publishers = ref<Publisher[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Search query
const searchQuery = ref('');

// Modal state
const isModalOpen = ref(false);
const editingPublisher = ref<Publisher | null>(null);
const isSubmitting = ref(false);
const serverError = ref<string | null>(null);
const serverFieldErrors = ref<Record<string, string>>({});

// Filtered publishers
const filteredPublishers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return publishers.value;

  return publishers.value.filter((p) => {
    const nameMatch = p.publisherName.toLowerCase().includes(query);
    const idMatch = p._id.toLowerCase().includes(query);
    const addrMatch = (p.address || '').toLowerCase().includes(query);
    return nameMatch || idMatch || addrMatch;
  });
});

async function loadPublishers() {
  if (!isAuthorized.value) return;
  loading.value = true;
  error.value = null;
  try {
    const data = await getAllPublishers();
    publishers.value = data || [];
  } catch (err: unknown) {
    if (err instanceof PublisherApiError) {
      error.value = err.message;
    } else {
      error.value = 'Không thể tải danh sách Nhà xuất bản. Vui lòng thử lại sau.';
    }
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingPublisher.value = null;
  serverError.value = null;
  serverFieldErrors.value = {};
  isModalOpen.value = true;
}

function openEditModal(pub: Publisher) {
  editingPublisher.value = pub;
  serverError.value = null;
  serverFieldErrors.value = {};
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingPublisher.value = null;
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

async function handleModalSubmit(payload: CreatePublisherPayload | UpdatePublisherPayload) {
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};

  try {
    if (editingPublisher.value) {
      await updatePublisher(editingPublisher.value._id, payload);
      showSuccess(`Đã cập nhật nhà xuất bản "${payload.publisherName}" thành công.`);
    } else {
      await createPublisher(payload as CreatePublisherPayload);
      showSuccess(`Đã thêm nhà xuất bản "${payload.publisherName}" thành công.`);
    }
    closeModal();
    await loadPublishers();
  } catch (err: unknown) {
    if (err instanceof PublisherApiError) {
      serverError.value = err.message;
      if (err.fields) {
        serverFieldErrors.value = err.fields;
      }
    } else {
      serverError.value = 'Đã có lỗi xảy ra khi lưu thông tin. Vui lòng thử lại.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function handleModalDelete(publisherId: string) {
  isSubmitting.value = true;
  serverError.value = null;

  try {
    await deletePublisher(publisherId);
    showSuccess('Đã xóa nhà xuất bản thành công.');
    closeModal();
    await loadPublishers();
  } catch (err: unknown) {
    if (err instanceof PublisherApiError) {
      serverError.value = err.message;
    } else {
      serverError.value = 'Không thể xóa nhà xuất bản này. Vui lòng thử lại sau.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  if (isAuthorized.value) {
    void loadPublishers();
  }
});
</script>

<template>
  <div class="publisher-management-view container">
    <!-- Unauthenticated or Unauthorized Warning -->
    <div v-if="!isAuthorized" class="notice warning" role="alert">
      <h3>Giới hạn quyền truy cập</h3>
      <p>Bạn không có quyền quản lý Nhà xuất bản. Vui lòng liên hệ Quản trị viên để được cấp quyền.</p>
    </div>

    <!-- Main Workspace Content -->
    <template v-else>
      <!-- Page Header -->
      <div class="page-head publisher-hero-banner">
        <div class="hero-left">
          <div class="hero-icon-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div class="hero-banner-content">
            <div class="hero-subtitle">QUẢN TRỊ HỌC LIỆU · CTULIB</div>
            <h1>Quản lý Nhà xuất bản</h1>
            <p>Quản lý danh sách nhà xuất bản và đối tác ấn hành tài liệu học thuật tại Thư viện Đại học Cần Thơ.</p>
          </div>
        </div>

        <div class="hero-actions">
          <button
            class="btn primary create-publisher-btn"
            type="button"
            @click="openCreateModal"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Thêm Nhà xuất bản</span>
          </button>
        </div>
      </div>

      <!-- Toast Feedback -->
      <div v-if="successMessage" class="alert success" role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="error" class="alert error" role="alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ error }}</span>
        <button class="btn small retry-btn" type="button" @click="loadPublishers">Thử lại</button>
      </div>

      <!-- Action & Search Bar -->
      <div class="panel toolbar-panel">
        <div class="search-input-wrap">
          <svg
            class="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Tìm kiếm theo tên hoặc địa chỉ nhà xuất bản…"
            aria-label="Tìm kiếm nhà xuất bản"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="clear-search-btn"
            aria-label="Xóa từ khóa"
            @click="searchQuery = ''"
          >
            ×
          </button>
        </div>

        <div class="toolbar-stats">
          <span class="count-badge">
            Tổng cộng: <strong>{{ filteredPublishers.length }}</strong> / {{ publishers.length }} nhà xuất bản
          </span>
        </div>
      </div>

      <!-- Table Component -->
      <PublisherTable
        :publishers="filteredPublishers"
        :loading="loading"
        :search-query="searchQuery"
        @edit="openEditModal"
      />

      <!-- Create / Edit Form Modal -->
      <PublisherFormModal
        :is-open="isModalOpen"
        :publisher-to-edit="editingPublisher"
        :is-submitting="isSubmitting"
        :server-error="serverError"
        :server-field-errors="serverFieldErrors"
        @close="closeModal"
        @submit="handleModalSubmit"
        @delete="handleModalDelete"
      />
    </template>
  </div>
</template>

<style scoped>
.publisher-management-view {
  padding-bottom: 60px;
}

.publisher-hero-banner {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px 26px;
  margin-bottom: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  box-shadow: var(--shadow-sm);
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.hero-icon-mark {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.hero-banner-content h1 {
  font-size: 20px;
  font-weight: 750;
  color: var(--text);
  margin: 0 0 2px;
}

.hero-subtitle {
  font-size: 11px;
  font-weight: 700;
  color: #1d4ed8;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.hero-banner-content p {
  font-size: 13.5px;
  color: var(--muted);
  margin: 0;
}

.create-publisher-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  margin-bottom: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.search-input-wrap {
  position: relative;
  flex: 1;
  max-width: 420px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 36px;
  padding-right: 32px;
  font-size: 13.5px;
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
}

.clear-search-btn:hover {
  color: var(--text);
}

.count-badge {
  font-size: 13px;
  color: var(--muted);
}

.count-badge strong {
  color: var(--text);
}

@media (max-width: 768px) {
  .publisher-hero-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-actions {
    width: 100%;
  }

  .create-publisher-btn {
    width: 100%;
    justify-content: center;
  }

  .toolbar-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input-wrap {
    max-width: 100%;
  }
}
</style>
