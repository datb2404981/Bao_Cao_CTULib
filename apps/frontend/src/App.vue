<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { authenticate, AuthError, currentUser, logout, refreshSession } from './services/auth'
import BookCatalogView from './views/BookCatalogView.vue'
import BookManagementView from './views/BookManagementView.vue'
import FacultyManagementView from './views/FacultyManagementView.vue'
import AuthorManagementView from './views/AuthorManagementView.vue'

export type AppView = 'catalog' | 'management' | 'faculty' | 'author' | 'auth'

// View routing state
const currentView = ref<AppView>('catalog')
const mobileMenuOpen = ref(false)
const profileDropdownOpen = ref(false)
const catalogViewRef = ref<InstanceType<typeof BookCatalogView> | null>(null)

function toggleProfileDropdown() {
  profileDropdownOpen.value = !profileDropdownOpen.value
}

const canManageBooks = computed(() => {
  return !!currentUser.value && currentUser.value.role !== 'READER'
})

const userInitials = computed(() => {
  const id = currentUser.value?.ctuIdentifier || 'U'
  return id.slice(0, 2).toUpperCase()
})

function syncViewFromHash() {
  const hash = window.location.hash.toLowerCase()
  if (hash === '#/manage' || hash === '#/management') {
    if (canManageBooks.value) {
      currentView.value = 'management'
    } else {
      currentView.value = 'catalog'
      window.location.hash = '#/catalog'
    }
  } else if (hash === '#/faculty' || hash === '#/faculties') {
    if (canManageBooks.value) {
      currentView.value = 'faculty'
    } else {
      currentView.value = 'catalog'
      window.location.hash = '#/catalog'
    }
  } else if (hash === '#/author' || hash === '#/authors') {
    if (canManageBooks.value) {
      currentView.value = 'author'
    } else {
      currentView.value = 'catalog'
      window.location.hash = '#/catalog'
    }
  } else if (hash === '#/auth' || hash === '#/login' || hash === '#/register') {
    currentView.value = 'auth'
  } else {
    currentView.value = 'catalog'
  }
}

function navigateTo(view: AppView) {
  if ((view === 'management' || view === 'faculty' || view === 'author') && !canManageBooks.value) {
    view = 'auth'
  }
  currentView.value = view
  mobileMenuOpen.value = false
  profileDropdownOpen.value = false
  if (view === 'catalog') window.location.hash = '#/catalog'
  else if (view === 'management') window.location.hash = '#/manage'
  else if (view === 'faculty') window.location.hash = '#/faculty'
  else if (view === 'author') window.location.hash = '#/author'
  else if (view === 'auth') window.location.hash = '#/auth'
}

function handleBrandHomeClick() {
  if (currentView.value !== 'catalog') {
    navigateTo('catalog')
  }
  nextTick(() => {
    catalogViewRef.value?.resetAllAndScrollTop()
  })
}

function handleSearchNavClick() {
  if (currentView.value !== 'catalog') {
    navigateTo('catalog')
  }
  nextTick(() => {
    catalogViewRef.value?.focusSearchInput()
  })
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

// Existing authentication state
const mode = ref<'login' | 'register'>('login')
const identifier = ref('')
const email = ref('')
const password = ref('')
const confirmation = ref('')
const visible = ref(false)
const busy = ref(false)
const starting = ref(true)
const error = ref('')
const fields = ref<Record<string, string>>({})
const registering = computed(() => mode.value === 'register')
const role = computed(() => ({ READER: 'Bạn đọc', EMPLOYEE: 'Nhân viên', ADMIN: 'Quản trị viên' })[currentUser.value?.role || ''] || currentUser.value?.role)

function switchMode(next: 'login' | 'register') {
  mode.value = next
  password.value = confirmation.value = error.value = ''
  visible.value = false
  fields.value = {}
}

async function togglePassword() {
  const input = document.getElementById('password') as HTMLInputElement | null
  const start = input?.selectionStart ?? 0
  const end = input?.selectionEnd ?? 0
  visible.value = !visible.value
  await nextTick()
  input?.focus()
  input?.setSelectionRange(start, end)
}

async function submit() {
  if (busy.value) return
  error.value = ''
  fields.value = {}
  const ctuIdentifier = identifier.value.trim().toUpperCase()
  if (!ctuIdentifier) fields.value.ctuIdentifier = 'Vui lòng nhập mã định danh.'
  if (registering.value && !/^(B\d{7}|CB\d{5}|ADMIN\d*)$/.test(ctuIdentifier)) fields.value.ctuIdentifier = 'Mã số sinh viên hoặc cán bộ không hợp lệ.'
  if (ctuIdentifier.length > 10 && registering.value) fields.value.ctuIdentifier = 'Mã định danh không được vượt quá 10 ký tự.'
  if (!password.value) fields.value.password = 'Vui lòng nhập mật khẩu.'
  else if (registering.value && password.value.length < 8) fields.value.password = 'Mật khẩu phải từ 8 kí tự.'
  if (registering.value && confirmation.value !== password.value) fields.value.confirmation = 'Mật khẩu nhập lại chưa khớp.'
  if (registering.value) {
    if (!email.value.trim()) fields.value.email = 'Vui lòng nhập địa chỉ email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) fields.value.email = 'Địa chỉ email không hợp lệ.'
    if (!confirmation.value) fields.value.confirmation = 'Vui lòng xác nhận mật khẩu.'
  }
  if (Object.keys(fields.value).length) {
    await nextTick()
    document.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus()
    return
  }
  busy.value = true
  try {
    await authenticate(mode.value, { ctuIdentifier, password: password.value, ...(registering.value ? { email: email.value.trim() } : {}) })
    password.value = confirmation.value = ''
    visible.value = false
    if (canManageBooks.value) {
      navigateTo('management')
    } else {
      navigateTo('catalog')
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
    if (cause instanceof AuthError) fields.value = cause.fields
  } finally { busy.value = false }
}

async function signOut() {
  busy.value = true
  error.value = ''
  profileDropdownOpen.value = false
  try {
    await logout()
    switchMode('login')
    if (currentView.value === 'management') {
      navigateTo('catalog')
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.' }
  finally { busy.value = false }
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target?.closest('.profile-menu-container')) {
    profileDropdownOpen.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleGlobalClick)
  syncViewFromHash()
  window.addEventListener('hashchange', syncViewFromHash)
  try { await refreshSession() }
  catch (cause) {
    if (!(cause instanceof AuthError && cause.status === 401)) error.value = cause instanceof Error ? cause.message : 'Không thể khôi phục phiên đăng nhập.'
  } finally {
    starting.value = false
    syncViewFromHash()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  window.removeEventListener('hashchange', syncViewFromHash)
})
</script>

<template>
  <div class="page-shell">
    <!-- Topbar Navigation -->
    <header class="topbar">
      <div class="topbar-left">
        <button
          class="menu-button"
          type="button"
          aria-label="Mở điều hướng"
          @click="toggleMobileMenu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        <a class="brand" href="#/catalog" @click.prevent="handleBrandHomeClick">
          <strong>CTULib</strong>
        </a>

        <nav class="topnav" :class="{ 'is-open': mobileMenuOpen }">
          <a
            :class="{ active: currentView === 'catalog' }"
            href="#/catalog"
            @click.prevent="handleSearchNavClick"
          >
            Tìm sách
          </a>
          <a
            v-if="canManageBooks"
            :class="{ active: currentView === 'management' }"
            href="#/manage"
            @click.prevent="navigateTo('management')"
          >
            Quản lý sách
          </a>
          <a
            v-if="canManageBooks"
            :class="{ active: currentView === 'faculty' }"
            href="#/faculty"
            @click.prevent="navigateTo('faculty')"
          >
            Khoa/Viện
          </a>
          <a
            v-if="canManageBooks"
            :class="{ active: currentView === 'author' }"
            href="#/author"
            @click.prevent="navigateTo('author')"
          >
            Tác giả
          </a>
          <a
            v-if="currentUser"
            :class="{ active: currentView === 'auth' }"
            href="#/auth"
            @click.prevent="navigateTo('auth')"
          >
            Tài khoản
          </a>
        </nav>
      </div>

      <div class="topbar-right">
        <!-- Profile Menu Dropdown khi đã đăng nhập -->
        <div v-if="currentUser" class="profile-menu-container">
          <div
            class="profile"
            role="button"
            tabindex="0"
            aria-haspopup="true"
            :aria-expanded="profileDropdownOpen"
            @click="toggleProfileDropdown"
            @keydown.enter="toggleProfileDropdown"
            @keydown.space.prevent="toggleProfileDropdown"
          >
            <span class="avatar">{{ userInitials }}</span>
            <span class="profile-name">{{ currentUser.ctuIdentifier }}</span>
            <span class="badge blue small">{{ role }}</span>
            <svg
              class="dropdown-chevron"
              :class="{ open: profileDropdownOpen }"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <!-- Dropdown Card -->
          <div v-if="profileDropdownOpen" class="profile-dropdown-card">
            <div class="dropdown-user-header">
              <span class="avatar large">{{ userInitials }}</span>
              <div class="user-meta">
                <span class="user-identifier">{{ currentUser.ctuIdentifier }}</span>
                <span v-if="currentUser.email" class="user-email">{{ currentUser.email }}</span>
                <span class="badge blue small user-role-pill">{{ role }}</span>
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <div class="dropdown-actions">
              <button
                class="dropdown-item"
                type="button"
                @click="navigateTo('auth')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Thông tin cá nhân</span>
              </button>

              <button
                v-if="canManageBooks"
                class="dropdown-item"
                type="button"
                @click="navigateTo('management')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <span>Quản lý kho sách</span>
              </button>

              <button
                v-if="canManageBooks"
                class="dropdown-item"
                type="button"
                @click="navigateTo('faculty')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
                </svg>
                <span>Quản lý Khoa/Viện</span>
              </button>

              <button
                v-if="canManageBooks"
                class="dropdown-item"
                type="button"
                @click="navigateTo('author')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="8" r="3"/>
                  <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>
                </svg>
                <span>Quản lý Tác giả</span>
              </button>

              <button
                class="dropdown-item logout-btn"
                type="button"
                :disabled="busy"
                @click="signOut"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>{{ busy ? 'Đang đăng xuất…' : 'Đăng xuất' }}</span>
              </button>
            </div>
          </div>
        </div>

        <button
          v-else
          class="btn small primary btn-login-top"
          type="button"
          @click="navigateTo('auth')"
        >
          <span>Đăng nhập</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace Content according to Hash View -->
    <main class="main-content">
      <!-- 1. Catalog View (SC02) -->
      <section v-if="currentView === 'catalog'" aria-label="Tra cứu sách">
        <BookCatalogView ref="catalogViewRef" @navigate="navigateTo" />
      </section>

      <!-- 2. Management View (SC12) -->
      <section v-else-if="currentView === 'management'" aria-label="Quản lý kho sách">
        <BookManagementView />
      </section>

      <!-- 3. Faculty Management View (SC15) -->
      <section v-else-if="currentView === 'faculty'" aria-label="Quản lý Khoa/Viện">
        <FacultyManagementView />
      </section>

      <!-- 4. Author Management View (SC16) -->
      <section v-else-if="currentView === 'author'" aria-label="Quản lý Tác giả">
        <AuthorManagementView />
      </section>

      <!-- 3. Auth Layout (SC01) -->
      <div v-else-if="currentView === 'auth'" class="auth-layout">
        <section class="intro" aria-labelledby="intro-title">
          <div class="intro-badge">
            <span class="badge-dot"></span>
            <span>Thư viện Số · Đại học Cần Thơ</span>
          </div>

          <h1 id="intro-title">
            Không gian Tri thức<br />& Học thuật Hiện đại
          </h1>

          <p class="intro-lead">
            Cổng kết nối nguồn tài nguyên học liệu số, giáo trình chính quy và tài liệu nghiên cứu chuyên sâu phục vụ cộng đồng giảng viên, sinh viên Đại học Cần Thơ.
          </p>

          <!-- 3 Thẻ thống kê tài nguyên học thuật -->
          <div class="academic-stats-grid">
            <div class="stat-card">
              <span class="stat-num">50.000+</span>
              <span class="stat-label">Học liệu & Giáo trình</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">16</span>
              <span class="stat-label">Khoa & Viện chuyên môn</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">24/7</span>
              <span class="stat-label">Mục lục trực tuyến OPAC</span>
            </div>
          </div>

          <!-- Danh sách tiện ích học thuật -->
          <ul class="academic-features-list">
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Tra cứu mục lục liên thông chính xác theo mã chuyên ngành & tác giả</span>
            </li>
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Đặt mượn và theo dõi tình trạng ấn phẩm trực tuyến bằng tài khoản CTU ID</span>
            </li>
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Hỗ trợ học tập, nghiên cứu khoa học và phát triển học liệu số bền vững</span>
            </li>
          </ul>

          <!-- Dòng cam kết học thuật Đại học Cần Thơ -->
          <div class="intro-motto">
            <span class="motto-line"></span>
            <span class="motto-text">HỌC TẬP · NGHIÊN CỨU · PHỤNG SỰ CỘNG ĐỒNG</span>
          </div>
        </section>

        <section class="form-panel" aria-label="Xác thực tài khoản">
          <div v-if="starting" class="loading-state" role="status">
            <span class="spinner"></span> Đang kiểm tra phiên đăng nhập…
          </div>

          <template v-else-if="currentUser">
            <div class="auth-header-crest">
              <div class="auth-icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div class="auth-header-text">
                <h2>Hồ sơ tài khoản</h2>
                <p class="form-description">Phiên đăng nhập Thư viện Đại học Cần Thơ</p>
              </div>
            </div>

            <div class="account-details-ledger">
              <div class="ledger-item">
                <dt>Mã định danh</dt>
                <dd>{{ currentUser.ctuIdentifier }}</dd>
              </div>
              <div v-if="currentUser.email" class="ledger-item">
                <dt>Địa chỉ email</dt>
                <dd>{{ currentUser.email }}</dd>
              </div>
              <div class="ledger-item">
                <dt>Vai trò người dùng</dt>
                <dd><span class="role-badge">{{ role }}</span></dd>
              </div>
            </div>

            <p v-if="error" class="alert error" role="alert">{{ error }}</p>

            <button class="submit-btn btn-logout" type="button" :disabled="busy" @click="signOut">
              <span>{{ busy ? 'Đang đăng xuất…' : 'Đăng xuất khỏi hệ thống' }}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </template>

          <template v-else>
            <div class="auth-header-crest">
              <div class="auth-icon-badge">
                <svg v-if="!registering" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
              </div>
              <div class="auth-header-text">
                <h2>{{ registering ? 'Tạo tài khoản mới' : 'Đăng nhập CTULib' }}</h2>
                <p class="form-description">{{ registering ? 'Đăng ký tài khoản bạn đọc thư viện Đại học Cần Thơ.' : 'Truy cập cổng học liệu số bằng tài khoản CTU ID.' }}</p>
              </div>
            </div>

            <div v-if="error" class="alert error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 1px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{{ error }}</span>
            </div>

            <form novalidate @submit.prevent="submit">
              <fieldset :disabled="busy">
                <!-- Mã định danh CTU -->
                <div class="field">
                  <label for="identifier">Mã số sinh viên / cán bộ</label>
                  <div class="input-control">
                    <span class="field-icon-lead">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="identifier"
                      v-model="identifier"
                      name="ctuIdentifier"
                      autocomplete="username"
                      placeholder="VD: B2101234 hoặc CB01234"
                      required
                      :aria-invalid="!!fields.ctuIdentifier"
                      aria-describedby="identifier-error"
                    />
                  </div>
                  <p v-if="fields.ctuIdentifier" id="identifier-error" class="field-error" aria-live="polite">
                    {{ fields.ctuIdentifier }}
                  </p>
                </div>

                <!-- Email (chỉ hiện khi đăng ký) -->
                <div v-if="registering" class="field">
                  <label for="email">Địa chỉ email Đại học Cần Thơ</label>
                  <div class="input-control">
                    <span class="field-icon-lead">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    </span>
                    <input
                      id="email"
                      v-model="email"
                      type="email"
                      name="email"
                      autocomplete="email"
                      placeholder="sinhvien@student.ctu.edu.vn"
                      required
                      :aria-invalid="!!fields.email"
                      aria-describedby="email-error"
                    />
                  </div>
                  <p v-if="fields.email" id="email-error" class="field-error" aria-live="polite">
                    {{ fields.email }}
                  </p>
                </div>

                <!-- Mật khẩu -->
                <div class="field">
                  <label for="password">Mật khẩu</label>
                  <div class="input-control password-input">
                    <span class="field-icon-lead">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </span>
                    <input
                      id="password"
                      v-model="password"
                      :type="visible ? 'text' : 'password'"
                      name="password"
                      :autocomplete="registering ? 'new-password' : 'current-password'"
                      :placeholder="registering ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu của bạn'"
                      required
                      :aria-invalid="!!fields.password"
                      aria-describedby="password-error"
                    />
                    <button
                      type="button"
                      class="password-toggle-btn"
                      :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                      :aria-pressed="visible"
                      @mousedown.prevent
                      @click="togglePassword"
                    >
                      <svg v-if="!visible" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    </button>
                  </div>
                  <p v-if="fields.password" id="password-error" class="field-error" aria-live="polite">
                    {{ fields.password }}
                  </p>
                </div>

                <!-- Xác nhận mật khẩu khi đăng ký -->
                <div v-if="registering" class="field">
                  <label for="confirmation">Xác nhận lại mật khẩu</label>
                  <div class="input-control password-input">
                    <span class="field-icon-lead">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    </span>
                    <input
                      id="confirmation"
                      v-model="confirmation"
                      :type="visible ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="Nhập lại mật khẩu vừa đặt"
                      required
                      :aria-invalid="!!fields.confirmation"
                      aria-describedby="confirmation-error"
                    />
                  </div>
                  <p v-if="fields.confirmation" id="confirmation-error" class="field-error" aria-live="polite">
                    {{ fields.confirmation }}
                  </p>
                </div>

                <!-- Submit Button -->
                <button class="submit-btn primary-button" type="submit">
                  <span>{{ busy ? 'Đang xử lý…' : registering ? 'Tạo tài khoản thư viện' : 'Đăng nhập vào hệ thống' }}</span>
                  <span v-if="busy" class="spinner" aria-hidden="true"></span>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </fieldset>
            </form>

            <div class="auth-switch-footer">
              <span v-if="!registering" class="auth-switch-text">
                Chưa có tài khoản?
                <button type="button" class="auth-switch-link" :disabled="busy" @click="switchMode('register')">
                   Đăng ký
                </button>
              </span>
              <span v-else class="auth-switch-text">
                Đã có tài khoản thư viện?
                <button type="button" class="auth-switch-link" :disabled="busy" @click="switchMode('login')">
                  Đăng nhập ngay
                </button>
              </span>
            </div>
          </template>
        </section>
      </div>
    </main>

    <!-- Mobile Navigation Bar (< 768px) -->
    <nav class="mobile-nav" aria-label="Điều hướng trên điện thoại">
      <a
        :class="{ active: currentView === 'catalog' }"
        href="#/catalog"
        @click.prevent="navigateTo('catalog')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <span>Tìm sách</span>
      </a>
      <a
        v-if="canManageBooks"
        :class="{ active: currentView === 'management' }"
        href="#/manage"
        @click.prevent="navigateTo('management')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z" />
          <path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z" />
        </svg>
        <span>Quản lý</span>
      </a>
      <a
        v-if="canManageBooks"
        :class="{ active: currentView === 'faculty' }"
        href="#/faculty"
        @click.prevent="navigateTo('faculty')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
        </svg>
        <span>Khoa/Viện</span>
      </a>
      <a
        :class="{ active: currentView === 'auth' }"
        href="#/auth"
        @click.prevent="navigateTo('auth')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 8 0v2" />
        </svg>
        <span>{{ currentUser ? 'Tài khoản' : 'Đăng nhập' }}</span>
      </a>
    </nav>

    <!-- Footer -->
    <footer class="footer">
      <span>© {{ new Date().getFullYear() }} CTULib · Đại học Cần Thơ</span>
      <span>Đồng hành cùng hành trình tri thức của bạn.</span>
    </footer>
  </div>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  color: var(--text);
}

.profile-menu-container {
  position: relative;
}

.profile {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px 5px 7px;
  background: var(--surface);
  border: 1px solid #dbe4f0;
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.profile:hover {
  background: #f8fafc;
  border-color: #93c5fd;
  box-shadow: 0 4px 10px -2px rgba(29, 78, 216, 0.08);
}

.profile-name {
  font-weight: 700;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.dropdown-chevron {
  color: var(--muted);
  transition: transform 0.15s ease;
  margin-left: 2px;
}

.dropdown-chevron.open {
  transform: rotate(180deg);
  color: var(--text);
}

.profile-dropdown-card {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 264px;
  background: #ffffff;
  border: 1px solid #dbe4f0;
  border-radius: 16px;
  box-shadow: 0 18px 36px -8px rgba(15, 23, 42, 0.16), 0 4px 12px -4px rgba(15, 23, 42, 0.06); /* taste-skill-ignore: floating menu */
  padding: 14px;
  z-index: 100;
}

.dropdown-user-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px;
}

.avatar.large {
  width: 36px;
  height: 36px;
  font-size: 13px;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-identifier {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.user-email {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role-pill {
  align-self: flex-start;
  margin-top: 2px;
}

.dropdown-divider {
  height: 1px;
  background: var(--line-light);
  margin: 10px 0 6px;
}

.dropdown-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.dropdown-item:hover {
  background: var(--ground);
  color: var(--text);
}

.dropdown-item svg {
  color: var(--muted);
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.dropdown-item:hover svg {
  color: var(--text);
}

.dropdown-item.logout-btn {
  color: var(--negative);
  margin-top: 4px;
  border-top: 1px solid var(--line-light);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.dropdown-item.logout-btn:hover {
  background: var(--pill-negative-bg);
  color: var(--pill-negative-ink);
}

.dropdown-item.logout-btn:hover svg {
  color: var(--pill-negative-ink);
}
</style>
