<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { authenticate, AuthError, currentUser, logout, refreshSession, refreshAuthorization } from './services/auth'
import BookCatalogView from './views/BookCatalogView.vue'
import BookManagementView from './views/BookManagementView.vue'
import FacultyManagementView from './views/FacultyManagementView.vue'
import AuthorManagementView from './views/AuthorManagementView.vue'

import PeopleManagementView from './views/PeopleManagementView.vue'
import AccountsManagementView from './views/AccountsManagementView.vue'
import SettingsView from './views/SettingsView.vue'
import MyLoansView from './views/MyLoansView.vue'
import LoansManagementView from './views/LoansManagementView.vue'
import PenaltiesView from './views/PenaltiesView.vue'
import DashboardView from './views/DashboardView.vue'
import AccountProfile from './components/profile/AccountProfile.vue'
import './styles/loans.css'
import { canAccess, defaultViewForUser, guardView, protectedViews, viewFromPath, viewPaths } from './middlewares/access'
import type { AppView } from './middlewares/access'
export type { AppView } from './middlewares/access'
import type { Book } from './types/book'

// View routing state
const currentView = ref<AppView>('catalog')
const mobileMenuOpen = ref(false)
const profileDropdownOpen = ref(false)
const catalogViewRef = ref<InstanceType<typeof BookCatalogView> | null>(null)
const pendingBorrowBook = ref<Book | null>(null)

function clearPendingBorrowBook() {
  pendingBorrowBook.value = null
  try {
    sessionStorage.removeItem('ctulib_pending_borrow_book')
  } catch {
    // ignore
  }
}

function handleRequireLogin(book: Book) {
  pendingBorrowBook.value = book
  try {
    sessionStorage.setItem('ctulib_pending_borrow_book', JSON.stringify(book))
  } catch {
    // ignore
  }
  navigateTo('auth')
}

function openDirectLogin() {
  clearPendingBorrowBook()
  navigateTo('auth')
}

function toggleProfileDropdown() {
  profileDropdownOpen.value = !profileDropdownOpen.value
}

const isStaffUser = computed(() => !!currentUser.value && ['EMPLOYEE', 'ADMIN'].includes(currentUser.value.role))
const canManageBooks = computed(() => canAccess(currentUser.value, 'management'))
const canManageFaculties = computed(() => canAccess(currentUser.value, 'faculty'))
const canManageAuthors = computed(() => canAccess(currentUser.value, 'author'))
const canManagePeople = computed(() => canAccess(currentUser.value, 'reader'))
const canManageAccounts = computed(() => canAccess(currentUser.value, 'accounts'))
const canManageSettings = computed(() => canAccess(currentUser.value, 'settings'))
const canManageLoans = computed(() => canAccess(currentUser.value, 'loans'))
const canCollectPenalty = computed(() => canAccess(currentUser.value, 'penalties'))
const canViewDashboard = computed(() => canAccess(currentUser.value, 'dashboard'))
const canViewMyLoans = computed(() => canAccess(currentUser.value, 'my-loans'))
const checkingAccess = ref(false)
const navigationError = ref('')
let navigationId = 0
let intendedView: AppView | null = null

const userInitials = computed(() => {
  const id = currentUser.value?.ctuIdentifier || 'U'
  return id.slice(0, 2).toUpperCase()
})

async function syncViewFromPath(normalizeStaffLanding = false) {
  if (starting.value) return
  const id = ++navigationId
  const requested = viewFromPath(window.location.pathname)
  navigationError.value = ''
  checkingAccess.value = protectedViews.includes(requested)
  let target = requested
  if (protectedViews.includes(requested)) {
    intendedView = requested
    try { await refreshAuthorization() }
    catch (cause) {
      if (id !== navigationId) return
      navigationError.value = cause instanceof Error ? cause.message : 'Không thể kiểm tra quyền truy cập.'
      target = cause instanceof AuthError && cause.status === 401 ? 'auth' : 'forbidden'
    }
  }
  if (id !== navigationId) return
  if (normalizeStaffLanding && requested === 'catalog' && currentUser.value && ['EMPLOYEE', 'ADMIN'].includes(currentUser.value.role)) {
    target = defaultViewForUser(currentUser.value)
  }
  currentView.value = guardView(currentUser.value, target)
  checkingAccess.value = false
  if (currentView.value !== requested) window.history.replaceState(null, '', `/${viewPaths[currentView.value]}`)
}

function navigateTo(view: AppView) {
  mobileMenuOpen.value = false
  profileDropdownOpen.value = false
  const path = `/${viewPaths[view]}`
  if (window.location.pathname !== path) window.history.pushState(null, '', path)
  void syncViewFromPath()
}

function retryAccess() {
  navigateTo(intendedView || 'catalog')
}

function handleBrandHomeClick() {
  navigateTo('catalog')
  nextTick(() => {
    catalogViewRef.value?.resetAllAndScrollTop()
  })
}

function handleSearchNavClick() {
  navigateTo('catalog')
  nextTick(() => {
    catalogViewRef.value?.focusSearchInput()
  })
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    mobileMenuOpen.value = false
    profileDropdownOpen.value = false
  }
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
  else if (registering.value && password.value.trim().length < 8) fields.value.password = 'Mật khẩu phải có ít nhất 8 ký tự không tính khoảng trắng ở đầu/cuối.'
  if (registering.value && confirmation.value !== password.value) fields.value.confirmation = 'Mật khẩu nhập lại chưa khớp.'
  if (registering.value) {
    if (!email.value.trim()) fields.value.email = 'Vui lòng nhập địa chỉ email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) || !/[a-z]/i.test(email.value.trim().split('@')[1]?.split('.')[0] ?? '')) fields.value.email = 'Địa chỉ email không hợp lệ (tên miền phải có chữ cái).'
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

    let bookToBorrow = pendingBorrowBook.value
    if (!bookToBorrow) {
      try {
        const stored = sessionStorage.getItem('ctulib_pending_borrow_book')
        if (stored) {
          bookToBorrow = JSON.parse(stored)
        }
      } catch {
        // ignore
      }
    }

    if (bookToBorrow) {
      pendingBorrowBook.value = bookToBorrow
      try {
        sessionStorage.removeItem('ctulib_pending_borrow_book')
      } catch {
        // ignore
      }
      intendedView = null
      navigateTo('catalog')
      return
    }

    navigateTo(intendedView || (canViewMyLoans.value ? 'my-loans' : canViewDashboard.value ? 'dashboard' : canManagePeople.value ? 'reader' : canManageBooks.value ? 'management' : 'catalog'))
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
    intendedView = null
    clearPendingBorrowBook()
    navigateTo('catalog')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.' }
  finally { busy.value = false }
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target?.closest('.profile-menu-container')) {
    profileDropdownOpen.value = false
  }
}

function handlePopState() {
  mobileMenuOpen.value = false
  profileDropdownOpen.value = false
  void syncViewFromPath()
}

onMounted(async () => {
  if (window.location.hash.startsWith('#/')) {
    window.history.replaceState(null, '', window.location.hash.slice(1))
  }
  document.addEventListener('click', handleGlobalClick)
  document.addEventListener('keydown', handleEscape)
  window.addEventListener('popstate', handlePopState)
  try {
    const stored = sessionStorage.getItem('ctulib_pending_borrow_book')
    if (stored) {
      pendingBorrowBook.value = JSON.parse(stored)
    }
  } catch {
    // ignore
  }
  try { await refreshSession() }
  catch (cause) {
    if (!(cause instanceof AuthError && cause.status === 401)) error.value = cause instanceof Error ? cause.message : 'Không thể khôi phục phiên đăng nhập.'
  } finally {
    starting.value = false
    void syncViewFromPath(true)
  }
})

onUnmounted(() => {
  navigationId++
  document.removeEventListener('click', handleGlobalClick)
  document.removeEventListener('keydown', handleEscape)
  window.removeEventListener('popstate', handlePopState)
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
          :aria-label="mobileMenuOpen ? 'Đóng điều hướng' : 'Mở điều hướng'"
          :aria-expanded="mobileMenuOpen"
          aria-controls="main-navigation"
          @click="toggleMobileMenu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        <a class="brand" href="/catalog" @click.prevent="handleBrandHomeClick" aria-label="CTULib - Thư viện Đại học Cần Thơ">
          <img src="/ctu-logo.png" alt="Logo Đại học Cần Thơ" class="brand-logo" />
          <div class="brand-meta">
            <strong><span class="brand-ctu">CTU</span><span class="brand-lib">Lib</span></strong>
            <span class="brand-sub">Đại học Cần Thơ</span>
          </div>
        </a>

        <nav id="main-navigation" aria-label="Điều hướng chính" class="topnav" :class="{ 'is-open': mobileMenuOpen }">
          <a
            v-if="!isStaffUser"
            :class="{ active: currentView === 'catalog' }"
            href="/catalog"
            @click.prevent="handleSearchNavClick"
          >
            Tìm sách
          </a>
          <a v-if="canViewDashboard" href="/dashboard" :class="{ active: currentView === 'dashboard' }" :aria-current="currentView === 'dashboard' ? 'page' : undefined" @click.prevent="navigateTo('dashboard')">Tổng quan</a>
          <a
            v-if="canManageBooks"
            :class="{ active: currentView === 'management' }"
            href="/manage"
            @click.prevent="navigateTo('management')"
          >
            Quản lý sách
          </a>
          <a v-if="canViewMyLoans" href="/my-loans" :class="{ active: currentView === 'my-loans' }" @click.prevent="navigateTo('my-loans')">Phiếu mượn của tôi</a>
          <a v-if="canManageLoans" href="/loans" :class="{ active: currentView === 'loans' }" @click.prevent="navigateTo('loans')">Mượn – trả</a>
          <a v-if="canCollectPenalty" href="/penalties" :class="{ active: currentView === 'penalties' }" :aria-current="currentView === 'penalties' ? 'page' : undefined" @click.prevent="navigateTo('penalties')">Phiếu phạt</a>
          <a
            v-if="canManageFaculties"
            :class="{ active: currentView === 'faculty' }"
            href="/faculty"
            @click.prevent="navigateTo('faculty')"
          >
            Khoa/Viện
          </a>
          <a
            v-if="canManageAuthors"
            :class="{ active: currentView === 'author' }"
            href="/author"
            @click.prevent="navigateTo('author')"
          >
            Tác giả
          </a>
          <a v-if="canManagePeople" href="/reader" :class="{ active: currentView === 'reader' }" @click.prevent="navigateTo('reader')">Độc giả</a>
          <a v-if="canManagePeople" href="/employee" :class="{ active: currentView === 'employee' }" @click.prevent="navigateTo('employee')">Nhân viên</a>
          <a v-if="canManagePeople" href="/permission" :class="{ active: currentView === 'permission' }" @click.prevent="navigateTo('permission')">Quyền chức năng</a>
          <a v-if="canManageAccounts" href="/accounts" :class="{ active: currentView === 'accounts' }" :aria-current="currentView === 'accounts' ? 'page' : undefined" @click.prevent="navigateTo('accounts')">Quản lý tài khoản</a>
          <a v-if="canManageSettings" href="/settings" :class="{ active: currentView === 'settings' }" :aria-current="currentView === 'settings' ? 'page' : undefined" @click.prevent="navigateTo('settings')">Cài đặt hệ thống</a>
        </nav>
      </div>

      <div class="topbar-right">
        <!-- Profile Menu Dropdown khi đã đăng nhập -->
        <div v-if="currentUser" class="profile-menu-container">
          <button
            class="profile"
            type="button"
            aria-label="Mở menu tài khoản"
            aria-haspopup="true"
            :aria-expanded="profileDropdownOpen"
            @click="toggleProfileDropdown"
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
          </button>

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
              <button v-if="canViewDashboard" type="button" class="dropdown-item" @click="navigateTo('dashboard')">Tổng quan thư viện</button>
              <button v-if="canViewMyLoans" type="button" class="dropdown-item" @click="navigateTo('my-loans')">Phiếu mượn của tôi</button>
              <button v-if="canManageLoans" type="button" class="dropdown-item" @click="navigateTo('loans')">Quản lý mượn – trả</button>
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
                v-if="canManageFaculties"
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
                v-if="canManageAuthors"
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
          @click="openDirectLogin"
        >
          <span>Đăng nhập</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace Content according to Hash View -->
    <main class="main-content">
      <!-- 1. Catalog View (SC02) -->
      <div v-if="starting || checkingAccess" class="container" role="status" aria-live="polite" style="padding-top: 40px">{{ starting ? 'Đang khôi phục phiên đăng nhập…' : 'Đang kiểm tra quyền truy cập…' }}</div>
      <section v-else-if="currentView === 'catalog'" aria-label="Tra cứu sách">
        <BookCatalogView
          ref="catalogViewRef"
          :initial-book="pendingBorrowBook"
          @navigate="navigateTo"
          @require-login="handleRequireLogin"
          @clear-initial-book="clearPendingBorrowBook"
        />
      </section>

      <section v-else-if="currentView === 'my-loans' && canViewMyLoans" aria-label="Phiếu mượn của tôi">
        <MyLoansView />
      </section>

      <section v-else-if="currentView === 'dashboard' && canViewDashboard" aria-label="Tổng quan thư viện">
        <DashboardView @navigate="navigateTo" />
      </section>

      <section v-else-if="currentView === 'loans' && canManageLoans" aria-label="Quản lý mượn trả">
        <LoansManagementView />
      </section>

      <section v-else-if="currentView === 'penalties' && canCollectPenalty" aria-label="Quản lý phiếu phạt">
        <PenaltiesView />
      </section>

      <!-- 2. Management View (SC12) -->
      <section v-else-if="currentView === 'management' && canAccess(currentUser, 'management')" aria-label="Quản lý kho sách">
        <BookManagementView />
      </section>

      <!-- 3. Faculty Management View (SC15) -->
      <section v-else-if="currentView === 'faculty' && canAccess(currentUser, 'faculty')" aria-label="Quản lý Khoa/Viện">
        <FacultyManagementView />
      </section>

      <!-- 4. Author Management View (SC16) -->
      <section v-else-if="currentView === 'author' && canAccess(currentUser, 'author')" aria-label="Quản lý Tác giả">
        <AuthorManagementView />
      </section>

      <section v-else-if="(currentView === 'reader' || currentView === 'employee' || currentView === 'permission') && canManagePeople" :aria-label="currentView === 'reader' ? 'Quản lý độc giả' : currentView === 'employee' ? 'Quản lý nhân viên' : 'Quản lý quyền'">
        <PeopleManagementView :key="currentView" :resource="currentView" />
      </section>
      <section v-else-if="currentView === 'accounts' && canManageAccounts" aria-label="Quản lý tài khoản">
        <AccountsManagementView />
      </section>
      <section v-else-if="currentView === 'settings' && canManageSettings" aria-label="Cài đặt hệ thống">
        <SettingsView />
      </section>
      <section v-else-if="currentView === 'forbidden' || (protectedViews.includes(currentView) && !canAccess(currentUser, currentView))" class="container" style="padding-top: 40px" aria-labelledby="access-denied-title">
        <div class="notice warning" role="alert"><div><h1 id="access-denied-title">Không có quyền truy cập</h1><p>{{ navigationError || 'Tài khoản hiện tại chưa được cấp quyền truy cập màn hình này.' }}</p></div></div>
        <div class="row"><button class="btn primary" @click="navigateTo('catalog')">Về tìm sách</button><button class="btn" @click="retryAccess">Kiểm tra lại quyền</button></div>
      </section>

      <!-- 3. Auth Layout (SC01) -->
      <!-- 3. Auth Layout (SC01) -->
      <AccountProfile v-else-if="currentView === 'auth' && currentUser && !starting" :busy="busy" :sign-out-error="error" @sign-out="signOut" />
      <div v-else-if="currentView === 'auth'" class="auth-layout">
        <section class="intro" aria-labelledby="intro-title">
          <div class="intro-brand">
            <img src="/ctu-logo.png" alt="Logo Đại học Cần Thơ" class="intro-ctu-logo" />
            <div class="intro-brand-text">
              <span class="intro-org-title">ĐẠI HỌC CẦN THƠ</span>
              <span class="intro-suborg-title">THƯ VIỆN</span>
            </div>
          </div>

          <h1 id="intro-title">Hệ thống Thư viện CTULib</h1>
          <p class="intro-lead">
            Cổng tra cứu học liệu số, mục lục giáo trình chính quy và tài nguyên nghiên cứu khoa học dành cho cán bộ, giảng viên và sinh viên.
          </p>

          <div class="intro-quick-meta">
            <div class="intro-meta-item">
              <span class="intro-meta-label">Giờ phục vụ</span>
              <strong>07:00 – 21:00</strong>
              <span class="intro-meta-sub">Tất cả các ngày trong tuần</span>
            </div>
            <div class="intro-meta-item">
              <span class="intro-meta-label">Địa điểm</span>
              <strong>Tòa nhà Thư viện (Khu II)</strong>
              <span class="intro-meta-sub">Đường 3/2, Q. Ninh Kiều, Cần Thơ</span>
            </div>
            <div class="intro-meta-item">
              <span class="intro-meta-label">Hỗ trợ kỹ thuật</span>
              <strong>(0292) 3832 663</strong>
              <span class="intro-meta-sub">thuvien@ctu.edu.vn</span>
            </div>
          </div>

          <div class="intro-notice-tip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Bạn đọc sử dụng tài khoản <strong>MSSV</strong> hoặc <strong>MSCB</strong> do nhà trường cung cấp để tra cứu và đặt mượn tài liệu trực tuyến.</span>
          </div>
        </section>

        <section class="form-panel" aria-label="Xác thực tài khoản">
          <div v-if="starting" class="loading-state" role="status">
            <span class="spinner"></span> Đang kiểm tra phiên đăng nhập…
          </div>

          <template v-else>
            <div class="auth-form-header">
              <h2>{{ registering ? 'Đăng ký tài khoản bạn đọc' : 'Đăng nhập tài khoản' }}</h2>
              <span class="auth-portal-tag">{{ registering ? 'Thành viên mới hệ thống thư viện' : 'Học liệu số & tra cứu tài liệu Đại học Cần Thơ' }}</span>
            </div>

            <div v-if="error" class="alert error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                  <label for="email">Địa chỉ email</label>
                  <div class="input-control">
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
                    <input
                      id="password"
                      v-model="password"
                      :type="visible ? 'text' : 'password'"
                      name="password"
                      :autocomplete="registering ? 'new-password' : 'current-password'"
                      :placeholder="registering ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'"
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
                <button class="auth-submit-btn" type="submit">
                  <span>{{ busy ? 'Đang xử lý…' : registering ? 'Tạo tài khoản' : 'Đăng nhập' }}</span>
                  <span v-if="busy" class="spinner" aria-hidden="true"></span>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </fieldset>
            </form>

            <div class="auth-form-switch">
              <span v-if="!registering">
                Chưa có tài khoản?
                <button type="button" class="auth-text-link" :disabled="busy" @click="switchMode('register')">
                  Đăng ký tài khoản
                </button>
              </span>
              <span v-else>
                Đã có tài khoản bạn đọc?
                <button type="button" class="auth-text-link" :disabled="busy" @click="switchMode('login')">
                  Đăng nhập
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
        href="/catalog"
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
        href="/manage"
        @click.prevent="navigateTo('management')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z" />
          <path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z" />
        </svg>
        <span>Quản lý</span>
      </a>
      <a
        v-if="canManageFaculties"
        :class="{ active: currentView === 'faculty' }"
        href="/faculty"
        @click.prevent="navigateTo('faculty')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
        </svg>
        <span>Khoa/Viện</span>
      </a>
      <a
        :class="{ active: currentView === 'auth' }"
        href="/auth"
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

.topnav a { white-space: nowrap; }
@media (max-width: 768px) {
  .topbar { position: sticky; }
  .menu-button { display: block; }
  .topnav { display: none; }
  .topnav.is-open {
    display: flex; position: absolute; top: 100%; left: 0; right: 0;
    flex-direction: column; align-items: stretch; gap: 6px;
    padding: 16px 24px; max-height: calc(100dvh - 70px); overflow-y: auto;
    background: var(--surface); border-bottom: 1px solid var(--line);
    box-shadow: 0 12px 24px #17203312;
  }
}

</style>
