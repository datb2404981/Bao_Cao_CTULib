<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
    disabled?: boolean;
    isLoading?: boolean;
  }>(),
  {
    disabled: false,
    isLoading: false,
  }
);

const emit = defineEmits<{
  (e: 'change-page', page: number): void;
  (e: 'page-change', page: number): void;
  (e: 'change-limit', limit: number): void;
}>();

const isDisabled = computed(() => props.disabled || props.isLoading);

const pages = computed(() => {
  const current = props.currentPage;
  const total = props.totalPages;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: (number | 'ellipsis')[] = [1];
  if (current > 3) result.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  if (current < total - 2) result.push('ellipsis');
  if (total > 1) result.push(total);
  return result;
});

function goToPage(page: number) {
  if (isDisabled.value || page < 1 || page > props.totalPages || page === props.currentPage) return;
  emit('change-page', page);
  emit('page-change', page);
}

function prevPage() {
  if (isDisabled.value || props.currentPage <= 1) return;
  const p = props.currentPage - 1;
  emit('change-page', p);
  emit('page-change', p);
}

function nextPage() {
  if (isDisabled.value || props.currentPage >= props.totalPages) return;
  const p = props.currentPage + 1;
  emit('change-page', p);
  emit('page-change', p);
}

function onLimitChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit('change-limit', Number(target.value));
}
</script>

<template>
  <div v-if="totalPages > 0" class="pagination-bar">
    <!-- Thông tin tóm tắt bên trái -->
    <div class="pagination-info">
      <div class="info-badge">
        <span>
          <strong class="num highlight-count">{{ totalItems }}</strong> sách
        </span>
      </div>
      <span class="info-divider">·</span>
      <span class="page-counter">
        Trang <strong class="num current-num">{{ currentPage }}</strong> / <strong class="num total-num">{{ totalPages }}</strong>
      </span>
    </div>

    <!-- Cụm điều khiển bên phải -->
    <div class="pagination-controls">
      <!-- Bộ chọn số lượng / trang -->
      <div class="limit-selector-wrapper">
        <label class="limit-selector" aria-label="Số sách mỗi trang">
          <select :value="limit" :disabled="isDisabled" @change="onLimitChange">
            <option :value="10">10 / trang</option>
            <option :value="12">12 / trang</option>
            <option :value="24">24 / trang</option>
            <option :value="48">48 / trang</option>
          </select>
          <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </label>
      </div>

      <!-- Dãy nút chuyển trang -->
      <nav class="pagination" aria-label="Phân trang">
        <!-- Nút Trang trước -->
        <button
          class="page-nav-btn btn-prev"
          type="button"
          aria-label="Trang trước"
          title="Trang trước"
          :disabled="isDisabled || currentPage <= 1"
          @click="prevPage"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <!-- Danh sách các số trang -->
        <template v-for="(p, idx) in pages" :key="idx">
          <span v-if="p === 'ellipsis'" class="page-ellipsis" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="page-num-btn num"
            :class="{ active: p === currentPage }"
            :aria-current="p === currentPage ? 'page' : undefined"
            :disabled="isDisabled"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
        </template>

        <!-- Nút Trang sau -->
        <button
          class="page-nav-btn btn-next"
          type="button"
          aria-label="Trang sau"
          title="Trang sau"
          :disabled="isDisabled || currentPage >= totalPages"
          @click="nextPage"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 24px;
  padding: 12px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  flex-wrap: wrap;
}

.info-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--ground);
  border: 1px solid var(--line);
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--text);
  font-weight: 500;
}

.highlight-count {
  font-variant-numeric: tabular-nums;
  color: var(--text);
  font-weight: 600;
}

.info-divider {
  color: var(--control);
}

.page-counter {
  color: var(--muted);
  font-size: 12.5px;
}

.current-num,
.total-num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--text);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.limit-selector-wrapper {
  position: relative;
}

.limit-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.limit-selector select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text);
  height: 32px;
  min-height: 32px;
  padding: 0 28px 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--control);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.limit-selector select:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--ground);
}

.limit-selector select:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.select-chevron {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}

.pagination {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  user-select: none;
}

.page-nav-btn,
.page-num-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.page-nav-btn {
  background: var(--surface);
  border: 1px solid var(--control);
  color: var(--text);
}

.page-nav-btn:hover:not(:disabled) {
  background: var(--ground);
  border-color: var(--accent);
}

.page-nav-btn:disabled {
  background: var(--ground);
  border-color: var(--line);
  color: var(--muted-light);
  cursor: not-allowed;
  opacity: 0.55;
}

.page-num-btn {
  font-variant-numeric: tabular-nums;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--muted);
}

.page-num-btn:hover:not(:disabled):not(.active) {
  background: var(--ground);
  border-color: var(--control);
  color: var(--text);
}

.page-num-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
  font-weight: 600;
  cursor: default;
}

.page-num-btn:disabled:not(.active) {
  background: var(--ground);
  border-color: var(--line);
  color: var(--muted-light);
  cursor: not-allowed;
}

.page-ellipsis {
  width: 22px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 640px) {
  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px 14px;
  }

  .pagination-info {
    justify-content: space-between;
  }

  .pagination-controls {
    justify-content: space-between;
  }
}
</style>
