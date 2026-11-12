<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { currentUser } from '../services/auth';
import { canAccess } from '../middlewares/access';
import {
  getAllFaculties,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  FacultyApiError,
} from '../services/faculty';
import type { Faculty, CreateFacultyPayload, UpdateFacultyPayload } from '../types/faculty';
import FacultyTable from '../components/faculty/FacultyTable.vue';
import FacultyFormModal from '../components/faculty/FacultyFormModal.vue';

const isAuthorized = computed(() => {
  return canAccess(currentUser.value, 'faculty');
});

const faculties = ref<Faculty[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Search query
const searchQuery = ref('');

// Modal state
const isModalOpen = ref(false);
const editingFaculty = ref<Faculty | null>(null);
const isSubmitting = ref(false);
const serverError = ref<string | null>(null);
const serverFieldErrors = ref<Record<string, string>>({});

// Filtered faculties
const filteredFaculties = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return faculties.value;

  return faculties.value.filter((f) => {
    const nameMatch = f.facultyName.toLowerCase().includes(query);
    const idMatch = f._id.toLowerCase().includes(query);
    const codeMatch = (f.facultyCode || `kh-${f._id.slice(-6)}`).toLowerCase().includes(query);
    const descMatch = (f.description || '').toLowerCase().includes(query);
    return nameMatch || idMatch || codeMatch || descMatch;
  });
});

async function loadFaculties() {
  if (!isAuthorized.value) return;
  loading.value = true;
  error.value = null;
  try {
    const data = await getAllFaculties();
    faculties.value = data || [];
  } catch (err: unknown) {
    if (err instanceof FacultyApiError) {
      error.value = err.message;
    } else {
      error.value = 'Không thể tải danh sách Khoa/Viện. Vui lòng thử lại sau.';
    }
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingFaculty.value = null;
  serverError.value = null;
  serverFieldErrors.value = {};
  isModalOpen.value = true;
}

function openEditModal(faculty: Faculty) {
  editingFaculty.value = faculty;
  serverError.value = null;
  serverFieldErrors.value = {};
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingFaculty.value = null;
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

async function handleModalSubmit(payload: CreateFacultyPayload | UpdateFacultyPayload) {
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};

  try {
    if (editingFaculty.value) {
      // Update mode
      const updated = await updateFaculty(editingFaculty.value._id, payload);
      showSuccess(`Đã cập nhật thông tin khoa "${updated.facultyName}" thành công.`);
    } else {
      // Create mode
      const created = await createFaculty(payload);
      showSuccess(`Đã thêm khoa "${created.facultyName}" mới thành công.`);
    }

    closeModal();
    await loadFaculties();
  } catch (err: unknown) {
    if (err instanceof FacultyApiError) {
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

async function handleDeleteFaculty(facultyId: string) {
  isSubmitting.value = true;
  serverError.value = null;
  serverFieldErrors.value = {};

  try {
    const deleted = await deleteFaculty(facultyId);
    showSuccess(`Đã xóa khoa "${deleted?.facultyName || facultyId}" thành công.`);
    closeModal();
    await loadFaculties();
  } catch (err: unknown) {
    if (err instanceof FacultyApiError) {
      serverError.value = err.message;
    } else {
      serverError.value = 'Không thể xóa khoa này. Vui lòng thử lại sau.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  void loadFaculties();
});
</script>

<template>
  <div class="faculty-view container" data-screen="SC15">
    <!-- Cảnh báo nếu không có quyền quản lý -->
    <div v-if="!isAuthorized" class="notice warning" role="alert" style="margin-top: 24px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <strong>Giới hạn quyền thao tác (Yêu cầu đăng nhập nội bộ)</strong>
        <p>Bạn chỉ có thể xem danh mục Khoa/Viện. Để thêm, sửa hoặc xóa khoa, vui lòng đăng nhập với tài khoản Cán bộ thư viện hoặc Quản trị viên.</p>
      </div>
    </div>

    <!-- Header giao diện chuẩn SC15 -->
    <div class="page-head">
      <div>
        <h1>Khoa/Viện</h1>
        <p class="page-sub">Quản lý danh mục các Khoa, Viện chuyên môn thuộc Đại học Cần Thơ trong hệ thống CTULib.</p>
      </div>
      <button
        v-if="isAuthorized"
        class="btn primary add-btn"
        type="button"
        @click="openCreateModal"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Thêm khoa/viện</span>
      </button>
    </div>

    <!-- Thông báo thành công -->
    <div v-if="successMessage" class="notice success" role="status" style="margin-bottom: 20px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <div>
        <p>{{ successMessage }}</p>
      </div>
    </div>

    <!-- Thông báo lỗi load danh sách -->
    <div v-if="error" class="notice error" role="alert" style="margin-bottom: 20px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Thanh tìm kiếm lọc SC15 -->
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
              aria-label="Tìm theo tên hoặc mã khoa"
              placeholder="Tìm theo tên hoặc mã khoa…"
            />
          </div>
        </div>
      </div>
    </form>

    <!-- Bảng danh sách SC15 -->
    <FacultyTable
      :faculties="filteredFaculties"
      :loading="loading"
      :search-query="searchQuery"
      @edit="openEditModal"
    />

    <!-- Footer thống kê số lượng -->
    <div v-if="!loading" class="table-footer-info">
      <span>Hiển thị {{ filteredFaculties.length }} / {{ faculties.length }} khoa/viện</span>
    </div>

    <!-- Modal Form Thêm/Chỉnh sửa SC15 -->
    <FacultyFormModal
      :is-open="isModalOpen"
      :faculty-to-edit="editingFaculty"
      :is-submitting="isSubmitting"
      :server-error="serverError"
      :server-field-errors="serverFieldErrors"
      @close="closeModal"
      @submit="handleModalSubmit"
      @delete="handleDeleteFaculty"
    />
  </div>
</template>

<style scoped>
.faculty-view {
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

