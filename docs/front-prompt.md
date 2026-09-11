# 🎨 Step-by-Step Frontend Build Guide
## Enterprise Cloud-Based POS & Shop Management System — Client Application

**Reference Documents:** [`prompt.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/docs/prompt.md) · [`api-spec.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/docs/api-spec.md) · [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/docs/PRD.md) · [`architecture.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/docs/architecture.md)

> **⚠️ IMPORTANT:** The backend server is **fully built** and running at `http://localhost:5000/api/v1`. All API endpoints documented in [`api-spec.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/docs/api-spec.md) are ready to consume. This guide focuses **exclusively** on building the frontend client application.

---

## 📌 Frontend Technology Stack

| Layer | Technology |
|:---|:---|
| **Framework** | Next.js 14 (App Router) with TypeScript |
| **Styling** | Tailwind CSS 3.4 with custom design tokens |
| **State Management** | TanStack React Query v5 (server state) + React Context (auth/UI state) |
| **Icons** | Lucide React |
| **Real-time** | Socket.io Client |
| **Offline** | IndexedDB via custom offline-queue |
| **Charts** | Recharts (lightweight, composable) |
| **Barcode** | JsBarcode (SVG/Canvas barcode generation) |
| **Print** | ESC/POS binary builder + CSS `@media print` fallback |
| **Utilities** | clsx, tailwind-merge |
| **Font** | Inter (Google Fonts) |

---

## 🎨 UI Design Reference & Style Guide

> **Design Inspiration:** The UI follows a modern POS dashboard style with **colorful metric cards**, **collapsible sidebar**, **data-rich tables**, and **chart panels**. The overall theme is **dark mode** (`bg-slate-950`) with vibrant colored accents.

### Color Palette & Design Tokens

```
Primary:         #3b82f6 (Blue-500) — Primary actions, active states
Success:         #22c55e (Green-500) — Positive metrics, stock OK
Warning:         #f59e0b (Amber-500) — Alerts, expiry warnings
Danger:          #ef4444 (Red-500) — Errors, low stock, delete actions
Info:            #06b6d4 (Cyan-500) — Informational badges
Purple:          #8b5cf6 (Violet-500) — Analytics, reports accent

Background:      #020617 (Slate-950) — Page background
Surface:         #0f172a (Slate-900) — Cards, panels
Surface-Alt:     #1e293b (Slate-800) — Table rows, inputs
Border:          #334155 (Slate-700) — Dividers, borders
Text-Primary:    #f1f5f9 (Slate-100) — Headings, primary text
Text-Secondary:  #94a3b8 (Slate-400) — Labels, secondary text
Text-Muted:      #64748b (Slate-500) — Placeholders, disabled
```

### Dashboard Card Colors (Metro-Style Quick Links)
| Card | Background | Icon Color |
|:---|:---|:---|
| POS | `bg-red-500` | White |
| Products | `bg-emerald-500` | White |
| Sales | `bg-amber-500` | White |
| Invoices | `bg-blue-500` | White |
| Categories | `bg-teal-500` | White |
| Gift Cards | `bg-orange-500` | White |
| Customers | `bg-sky-500` | White |
| Settings | `bg-indigo-500` | White |
| Reports | `bg-purple-500` | White |
| Users | `bg-green-600` | White |
| Backup | `bg-gray-600` | White |
| Stores | `bg-lime-600` | White |

### Typography
```
Heading 1:    text-3xl font-bold
Heading 2:    text-2xl font-semibold
Heading 3:    text-xl font-semibold
Body:         text-sm font-normal
Label:        text-xs font-medium uppercase tracking-wider
Badge:        text-xs font-semibold px-2 py-0.5 rounded-full
```

### Component Patterns
- **Cards:** `bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6`
- **Tables:** `bg-slate-900 rounded-xl` with alternating `bg-slate-800/50` rows
- **Inputs:** `bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500`
- **Buttons Primary:** `bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 font-medium transition-all`
- **Buttons Danger:** `bg-red-600 hover:bg-red-700 text-white rounded-lg`
- **Modals:** `bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-sm`
- **Sidebar:** `bg-slate-900 border-r border-slate-800 w-64` (collapsed: `w-16`)
- **Header:** `bg-slate-900/80 backdrop-blur-md border-b border-slate-800 h-16`

---

## 📁 Frontend Directory Structure

```
client/
├── src/
│   ├── app/
│   │   ├── globals.css                    # Tailwind base + custom tokens
│   │   ├── print.css                      # @media print styles (thermal + A4)
│   │   ├── layout.tsx                     # Root layout (Inter font, AuthProvider, dark mode)
│   │   ├── page.tsx                       # Landing redirect → /login or /dashboard
│   │   ├── login/
│   │   │   └── page.tsx                   # Login page
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                 # Dashboard shell (Sidebar + Header + ProtectedRoute)
│   │   │   ├── dashboard/page.tsx         # Dashboard KPI cards + charts
│   │   │   ├── products/page.tsx          # Product catalog list
│   │   │   ├── products/[id]/page.tsx     # Product detail/edit
│   │   │   ├── categories/page.tsx        # Category tree CRUD
│   │   │   ├── brands/page.tsx            # Brand list CRUD
│   │   │   ├── inventory/page.tsx         # Stock levels + alerts
│   │   │   ├── purchase-orders/page.tsx   # PO list
│   │   │   ├── purchase-orders/new/page.tsx    # Create PO
│   │   │   ├── purchase-orders/[id]/page.tsx   # PO detail + GRN
│   │   │   ├── sales/page.tsx             # Sales history list
│   │   │   ├── sales/[id]/page.tsx        # Invoice detail
│   │   │   ├── customers/page.tsx         # Customer directory
│   │   │   ├── customers/[id]/ledger/page.tsx  # Bakir Khata ledger
│   │   │   ├── suppliers/page.tsx         # Supplier directory
│   │   │   ├── suppliers/[id]/ledger/page.tsx  # Supplier payable ledger
│   │   │   ├── shifts/page.tsx            # Shift history
│   │   │   ├── shifts/[id]/z-report/page.tsx   # Z-Report view
│   │   │   ├── expenses/page.tsx          # Expense list
│   │   │   ├── accounts/page.tsx          # Financial accounts
│   │   │   ├── accounts/[id]/ledger/page.tsx   # Account transaction log
│   │   │   ├── barcode-labels/page.tsx    # Barcode label generator
│   │   │   ├── reports/page.tsx           # Report hub
│   │   │   ├── reports/sales/page.tsx     # Sales report
│   │   │   ├── reports/inventory/page.tsx # Inventory valuation
│   │   │   ├── reports/pnl/page.tsx       # Profit & Loss
│   │   │   ├── reports/customer-aging/page.tsx   # Customer due aging
│   │   │   ├── reports/supplier-payable/page.tsx # Supplier payable
│   │   │   ├── reports/purchases/page.tsx # Purchase summary
│   │   │   ├── reports/wastage/page.tsx   # Inventory wastage
│   │   │   ├── users/page.tsx             # User management
│   │   │   ├── users/[id]/page.tsx        # Edit user
│   │   │   ├── roles/page.tsx             # Role & permissions
│   │   │   ├── audit-logs/page.tsx        # Audit log viewer
│   │   │   └── settings/page.tsx          # Shop settings
│   │   └── (pos)/
│   │       └── pos/page.tsx               # Full-screen POS terminal
│   │
│   ├── components/
│   │   ├── ui/                            # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── Toast.tsx
│   │   ├── Sidebar.tsx                    # Collapsible sidebar navigation
│   │   ├── Header.tsx                     # Top header bar
│   │   ├── ProtectedRoute.tsx             # Auth guard wrapper
│   │   ├── NotificationBell.tsx           # Real-time notification dropdown
│   │   ├── modals/                        # Feature-specific modals
│   │   │   ├── CreateUserModal.tsx
│   │   │   ├── ProductFormModal.tsx
│   │   │   ├── BarcodeLabelModal.tsx
│   │   │   ├── CategoryFormModal.tsx
│   │   │   ├── BrandFormModal.tsx
│   │   │   ├── SupplierFormModal.tsx
│   │   │   ├── SupplierPaymentModal.tsx
│   │   │   ├── CustomerFormModal.tsx
│   │   │   ├── PayDueModal.tsx
│   │   │   ├── GRNModal.tsx
│   │   │   ├── OpenShiftModal.tsx
│   │   │   ├── CloseShiftModal.tsx
│   │   │   ├── PettyCashModal.tsx
│   │   │   ├── ExpenseFormModal.tsx
│   │   │   ├── AccountFormModal.tsx
│   │   │   ├── FundTransferModal.tsx
│   │   │   ├── StockAdjustmentModal.tsx
│   │   │   ├── ReturnModal.tsx
│   │   │   └── ManagerOverrideModal.tsx
│   │   ├── pos/                           # POS terminal components
│   │   │   ├── BarcodeSearchInput.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── CartPanel.tsx
│   │   │   ├── CustomerSelector.tsx
│   │   │   ├── PaymentModal.tsx
│   │   │   ├── HoldCartBar.tsx
│   │   │   ├── TerminalLockScreen.tsx
│   │   │   ├── ReceiptPreview.tsx
│   │   │   └── DiscountField.tsx
│   │   └── reports/                       # Report components
│   │       ├── ReportToolbar.tsx
│   │       └── PrintableReport.tsx
│   │
│   ├── hooks/                             # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePOSHotkeys.ts
│   │   ├── useRealTimeNotifications.ts
│   │   ├── useOfflineSync.ts
│   │   ├── useDebounce.ts
│   │   └── useMediaQuery.ts
│   │
│   └── lib/                               # Core libraries & utilities
│       ├── api-client.ts                  # Fetch/Axios wrapper with JWT
│       ├── auth-context.tsx               # AuthContext + AuthProvider
│       ├── constants.ts                   # API_BASE_URL, CURRENCY_SYMBOL
│       ├── offline-queue.ts               # IndexedDB offline cart buffer
│       ├── escpos-builder.ts              # ESC/POS receipt command builder
│       ├── cash-drawer.ts                 # Cash drawer pulse trigger
│       ├── socket-client.ts               # Socket.io client instance
│       └── utils.ts                       # formatCurrency, formatDate, cn()
│
├── public/
│   └── logo.svg                           # Shop logo placeholder
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
└── package.json
```

---

# ═══════════════════════════════════════════════════
# PHASE 1: Frontend Foundation & Design System Setup
# ═══════════════════════════════════════════════════

> **Goal:** Install all required frontend dependencies, configure Tailwind design tokens, create reusable UI primitives (Button, Input, Modal, DataTable, etc.), and set up the API client, auth context, and utility functions.

---

## Step 1.1 — Install Frontend Dependencies

**What to do:**
The Next.js project is already initialized at `client/`. Install all additional packages needed for the complete frontend.

**Commands:**
```bash
cd client

# Core UI & Data Fetching
npm install @tanstack/react-query recharts jsbarcode

# Date handling
npm install date-fns

# Form handling (optional but recommended)
npm install react-hook-form @hookform/resolvers zod

# Already installed: lucide-react, clsx, tailwind-merge, socket.io-client, next, react, react-dom
```

**Acceptance Criteria:**
- [ ] All dependencies installed without errors
- [ ] `npm run dev` starts Next.js on port 3000 without compilation errors
- [ ] TanStack React Query, Recharts, JsBarcode available for import

---

## Step 1.2 — Configure Tailwind Design Tokens & Global Styles

**What to do:**
Extend `tailwind.config.ts` with custom color palette, font settings, and animation utilities.

**File:** `client/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f172a',    // Slate-900
          alt: '#1e293b',        // Slate-800
          hover: '#334155',      // Slate-700
        },
        accent: {
          blue: '#3b82f6',
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
          cyan: '#06b6d4',
          violet: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        slideIn: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
      },
    },
  },
  plugins: [],
};
export default config;
```

**File:** `client/src/app/globals.css` — Extend with custom utility classes and scrollbar styling.

**Acceptance Criteria:**
- [ ] Custom colors available as Tailwind classes (e.g., `bg-surface`, `text-accent-blue`)
- [ ] Animations work (`animate-slide-in`, `animate-fade-in`)
- [ ] Custom scrollbar styles applied globally

---

## Step 1.3 — Create Reusable UI Primitives

**What to build:**
Create a library of reusable UI components that all pages will use. Every component must follow the dark theme design tokens.

**Files to create:**

### 1. `client/src/components/ui/Button.tsx`
- Variants: `primary`, `secondary`, `danger`, `ghost`, `outline`
- Sizes: `sm`, `md`, `lg`
- States: `loading` (with spinner), `disabled`
- Accepts `leftIcon`, `rightIcon` props

### 2. `client/src/components/ui/Input.tsx`
- Variants: `default`, `error`
- Supports `label`, `helperText`, `errorMessage` props
- Left/right icon slots
- Password toggle visibility button

### 3. `client/src/components/ui/Select.tsx`
- Custom styled dropdown matching dark theme
- Supports `label`, `placeholder`, `options[]`, `error`
- Search/filter within dropdown for large option lists

### 4. `client/src/components/ui/Modal.tsx`
- Overlay with `backdrop-blur-sm bg-black/50`
- Sizes: `sm` (400px), `md` (560px), `lg` (720px), `xl` (900px), `full` (screen)
- Close on ESC key and overlay click
- Header with title and close button, scrollable body, sticky footer with action buttons
- Entry animation: `animate-scale-in`

### 5. `client/src/components/ui/DataTable.tsx`
- Generic typed table component accepting `columns[]` and `data[]`
- Features: sortable columns, row hover highlight, loading skeleton, empty state
- Responsive: horizontal scroll on mobile
- Styled with `bg-slate-900 rounded-xl` and alternating row colors

### 6. `client/src/components/ui/Badge.tsx`
- Variants: `success` (green), `warning` (amber), `danger` (red), `info` (blue), `neutral` (slate), `purple`
- Sizes: `sm`, `md`
- Dot indicator option

### 7. `client/src/components/ui/Card.tsx`
- Standard card wrapper with `bg-slate-900 border border-slate-800 rounded-xl shadow-lg`
- Header slot with title and action buttons
- Padding variants

### 8. `client/src/components/ui/Spinner.tsx`
- Animated spinning loader
- Sizes: `sm`, `md`, `lg`
- Color variants

### 9. `client/src/components/ui/Tabs.tsx`
- Horizontal tab bar with underline indicator
- Active tab: `border-b-2 border-blue-500 text-blue-400`
- Smooth animated tab switch

### 10. `client/src/components/ui/Pagination.tsx`
- Previous/Next buttons + page numbers
- Shows `Showing X-Y of Z results`
- Page size selector (10, 20, 50, 100)

### 11. `client/src/components/ui/SearchInput.tsx`
- Search icon + input with clear button
- Debounced onChange (300ms)
- Loading state with spinner

### 12. `client/src/components/ui/DateRangePicker.tsx`
- Start date + End date inputs
- Quick presets: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Custom
- Returns `{ startDate, endDate }` on change

### 13. `client/src/components/ui/ConfirmDialog.tsx`
- Confirmation modal for dangerous actions (delete, deactivate)
- Title, description, confirm button (red), cancel button
- Supports custom confirm text

### 14. `client/src/components/ui/Toast.tsx`
- Toast notification system (success, error, warning, info)
- Auto-dismiss after 4 seconds
- Slide-in from top-right
- Stack multiple toasts

**Acceptance Criteria:**
- [ ] All 14 UI primitives created with consistent dark theme styling
- [ ] All components are typed with TypeScript interfaces
- [ ] Components support all documented variants and sizes
- [ ] Loading states, disabled states, and animations work correctly
- [ ] Toast system can stack multiple notifications

---

## Step 1.4 — API Client & Utility Functions

**What to do:**
Update the existing API client and create utility functions used throughout the app.

**File:** `client/src/lib/api-client.ts` (update)
- Wrapper around `fetch` with base URL from `constants.ts`
- Automatic JSON parsing
- Attaches `credentials: 'include'` for HTTP-only JWT cookies
- Global error interceptor: on `401`, redirect to `/login`
- Methods: `api.get(url)`, `api.post(url, body)`, `api.put(url, body)`, `api.patch(url, body)`, `api.delete(url)`
- Support for `Idempotency-Key` header on checkout requests
- Support for query parameter serialization

**File:** `client/src/lib/utils.ts` (create)
```typescript
// formatCurrency(amount) → "৳1,250.00"
// formatDate(date) → "Sep 11, 2026"
// formatDateTime(date) → "Sep 11, 2026 03:29 PM"
// cn(...classes) → merged Tailwind class string (using clsx + tailwind-merge)
// generateIdempotencyKey() → UUID v4 string
// truncateText(text, maxLength) → "Long text..."
// getInitials(name) → "AB"
// debounce(fn, delay) → debounced function
```

**File:** `client/src/lib/constants.ts` (update)
```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
export const CURRENCY_SYMBOL = "৳";
export const DEFAULT_TAX_RATE = 5;
export const ITEMS_PER_PAGE = 20;
export const TOAST_DURATION = 4000;
export const DEBOUNCE_DELAY = 300;
```

**Acceptance Criteria:**
- [ ] API client handles all HTTP methods with proper error handling
- [ ] 401 errors redirect to login page
- [ ] All utility functions work correctly
- [ ] Currency formatting shows `৳` symbol with proper comma separation

---

## Step 1.5 — TanStack React Query Provider Setup

**What to do:**
Configure TanStack React Query with a global QueryClient and wrap the app.

**File:** `client/src/lib/query-client.ts` (create)
```typescript
// Create QueryClient with defaults:
// - staleTime: 5 minutes for non-critical data
// - gcTime: 30 minutes
// - retry: 1 attempt
// - refetchOnWindowFocus: false
```

**File:** `client/src/app/layout.tsx` (update)
- Wrap `<AuthProvider>` content with `<QueryClientProvider>`
- Add `<ToastProvider>` for global toast notifications

**Acceptance Criteria:**
- [ ] React Query DevTools available in development
- [ ] All API calls throughout the app use `useQuery` and `useMutation` hooks
- [ ] Stale data is refetched properly

---

# ═══════════════════════════════════════════════════
# PHASE 2: Authentication & App Shell Layout
# ═══════════════════════════════════════════════════

> **Goal:** Build the login page, auth context, protected route guard, and the main application shell (sidebar + header) with role-based navigation.

---

## Step 2.1 — Login Page

**File:** `client/src/app/login/page.tsx`

**What to build:**
A beautiful, modern login page with the following elements:

- **Layout:** Centered card on gradient background (`bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950`)
- **Logo & Title:** Shop name "Smart Retail POS" with tagline
- **Form Fields:**
  - Username input with user icon
  - Password input with lock icon and show/hide toggle
  - "Remember Me" checkbox
- **Submit Button:** Full-width primary button with loading spinner
- **Error Alert:** Red alert box for invalid credentials or rate limit errors
- **Footer:** Copyright text

**API Integration:**
- `POST /api/v1/auth/login` with `{ username, password }`
- On success: redirect to `/dashboard` (Admin/Manager) or `/pos` (Cashier role)
- On `429`: show "Too many attempts. Please try again later."
- On `401`: show "Invalid username or password."

**Acceptance Criteria:**
- [ ] Login page is visually stunning with dark gradient background
- [ ] Username and password validation before submit
- [ ] Loading spinner during API call
- [ ] Error messages display correctly
- [ ] Successful login stores auth state and redirects based on role
- [ ] Page is responsive on mobile and tablet

---

## Step 2.2 — Auth Context & Protected Route

**File:** `client/src/lib/auth-context.tsx` (update)

**What to build:**
- `AuthContext` providing: `user`, `isAuthenticated`, `isLoading`, `login()`, `logout()`, `refreshUser()`
- On mount: call `GET /api/v1/auth/me` to restore session from HTTP-only cookie
- `login(username, password)` → POST to auth/login → set user state
- `logout()` → POST to auth/logout → clear user state → redirect to `/login`
- Store user object: `{ userId, username, fullName, role, permissions[] }`

**File:** `client/src/components/ProtectedRoute.tsx` (update)
- Shows full-page loading spinner while checking auth
- Redirects to `/login` if not authenticated
- Accepts optional `requiredPermission` prop to check RBAC
- Shows 403 page if user lacks permission

**Acceptance Criteria:**
- [ ] Auth state persists across page refreshes (via HTTP-only cookie + /me endpoint)
- [ ] Protected routes redirect unauthenticated users to login
- [ ] Permission-based route protection works
- [ ] Loading spinner shows during initial auth check

---

## Step 2.3 — Sidebar Navigation

**File:** `client/src/components/Sidebar.tsx` (update/rebuild)

**What to build:**
A collapsible sidebar navigation inspired by the reference UI design:

**Layout:**
- **Sidebar Header:** App logo + "Smart Retail POS" text (hidden when collapsed)
- **Navigation Items:** Icon + Label, filtered by user's permissions
- **Active Route:** Highlighted with `bg-blue-600/20 text-blue-400 border-l-4 border-blue-500`
- **Collapse Toggle:** Hamburger/chevron button at bottom to toggle icon-only mode
- **Mobile:** Full-screen overlay drawer with backdrop

**Navigation Items (role-filtered):**

| Menu Item | Lucide Icon | Route | Required Permission |
|:---|:---|:---|:---|
| Dashboard | `LayoutDashboard` | `/dashboard` | `reports:dashboard` |
| POS Terminal | `ShoppingCart` | `/pos` | `pos:checkout` |
| Products | `Package` | `/products` | `inv:view` |
| Categories | `Tags` | `/categories` | `inv:view` |
| Brands | `Bookmark` | `/brands` | `inv:view` |
| Inventory | `Warehouse` | `/inventory` | `inv:view` |
| Barcode Labels | `Barcode` | `/barcode-labels` | `inv:labels` |
| Purchase Orders | `Truck` | `/purchase-orders` | `procurement:view` |
| Sales History | `Receipt` | `/sales` | `sales:view` |
| Customers | `Users` | `/customers` | `customers:view` |
| Suppliers | `Building2` | `/suppliers` | `procurement:view` |
| Shifts | `Clock` | `/shifts` | `shifts:operate` |
| Expenses | `CreditCard` | `/expenses` | `expenses:view` |
| Accounts | `Landmark` | `/accounts` | `accounts:view` |
| Reports | `BarChart3` | `/reports` | `reports:dashboard` |
| Users | `UserCog` | `/users` | `users:manage` |
| Roles | `Shield` | `/roles` | `roles:view` |
| Audit Logs | `ScrollText` | `/audit-logs` | `audit:view` |
| Settings | `Settings` | `/settings` | `settings:manage` |

**Expandable Submenus:**
- **Products** submenu: Products, Categories, Brands, Inventory, Barcode Labels
- **Reports** submenu: Sales, Inventory, P&L, Customer Aging, Supplier Payable, Purchases, Wastage

**Acceptance Criteria:**
- [ ] Sidebar shows only menu items the user has permission to access
- [ ] Active route is highlighted with accent color and left border
- [ ] Sidebar collapses to icon-only mode (64px width)
- [ ] Collapsed mode shows tooltip on hover with menu label
- [ ] Mobile: opens as overlay drawer with backdrop, closes on outside click
- [ ] Smooth transition animation when collapsing/expanding
- [ ] Submenu items expand/collapse with chevron indicator

---

## Step 2.4 — Header Bar

**File:** `client/src/components/Header.tsx` (update/rebuild)

**What to build:**
A top header bar inspired by the reference UI:

**Layout:**
- **Left:** Hamburger menu button (mobile) / current date & time display
- **Center:** Breadcrumb or page title
- **Right:**
  - Active shift indicator badge (green "Shift Open" or gray "No Shift")
  - Notification bell with unread count badge
  - User avatar + name dropdown
  - Quick actions: Lock Terminal (Ctrl+L), POS shortcut

**User Dropdown Menu:**
- Profile info (name, role badge)
- Lock Terminal
- Logout
- Dark mode toggle (reserved)

**Date/Time Display:**
- Live updating clock: "11th September 2026, 03:29 PM"

**Acceptance Criteria:**
- [ ] Header shows current date/time updating every minute
- [ ] Shift status badge shows green when shift is open
- [ ] Notification bell shows unread count
- [ ] User dropdown works with profile, lock, logout options
- [ ] Responsive: hamburger menu on mobile

---

## Step 2.5 — Notification Bell & Real-time Alerts

**File:** `client/src/components/NotificationBell.tsx` (create)

**What to build:**
- Bell icon with red badge showing unread count
- Click opens dropdown panel listing recent notifications
- Notification types:
  - `LOW_STOCK_ALERT` — Red badge, package icon
  - `SHIFT_DISCREPANCY_ALERT` — Amber badge, alert icon
  - `OFFLINE_OVERSELL_ALERT` — Red badge, wifi-off icon
  - `EXPIRY_WARNING` — Orange badge, clock icon
- Each notification shows: icon, message, timestamp, "mark as read" action
- "Mark All Read" button at bottom

**File:** `client/src/hooks/useRealTimeNotifications.ts` (update)
- Connect to Socket.io server with JWT auth
- Listen for notification events
- Store notifications in local state
- Play notification sound on new alert (optional)

**Acceptance Criteria:**
- [ ] Notifications appear in real-time without page refresh
- [ ] Unread count badge updates live
- [ ] Can mark individual or all notifications as read
- [ ] Dropdown closes on outside click

---

# ═══════════════════════════════════════════════════
# PHASE 3: Dashboard Page
# ═══════════════════════════════════════════════════

> **Goal:** Build the main dashboard page with KPI metric cards (metro-style), sales trend chart, top products table, and alert widgets.

---

## Step 3.1 — Dashboard KPI Cards

**File:** `client/src/app/(dashboard)/dashboard/page.tsx`

**What to build:**
Dashboard inspired by the reference UI with colorful metro-style quick link cards and data widgets.

**Section 1: Quick Links (Metro-Style Cards Grid)**
A 4-column responsive grid of vibrant colored cards (like the reference image):

| Card | Count | Icon | Background | Route |
|:---|:---|:---|:---|:---|
| POS | — | `ShoppingCart` | `bg-red-500` | `/pos` |
| Products | `{count}` | `Package` | `bg-emerald-500` | `/products` |
| Sales | `{count}` | `TrendingUp` | `bg-amber-500` | `/sales` |
| Open Invoices | `{count}` | `FileText` | `bg-blue-500` | `/sales?status=due` |
| Categories | `{count}` | `Tags` | `bg-teal-500` | `/categories` |
| Customers | `{count}` | `Users` | `bg-sky-500` | `/customers` |
| Settings | — | `Settings` | `bg-indigo-500` | `/settings` |
| Reports | — | `BarChart3` | `bg-purple-500` | `/reports` |
| Users | `{count}` | `UserCog` | `bg-green-600` | `/users` |

Each card shows:
- Large count number (top-left)
- Icon (top-right)
- Label text (bottom)
- Click navigates to respective page
- Hover: slight scale-up effect (`hover:scale-105 transition-transform`)

**Section 2: KPI Metric Cards Row**
Below the quick links, a row of detailed KPI cards:

| Metric | Icon | Color |
|:---|:---|:---|
| Today's Revenue | `DollarSign` | Green |
| Today's Expenses | `ArrowDownCircle` | Red |
| Net Profit | `TrendingUp` | Blue |
| Pending Dues | `Clock` | Amber |
| Low Stock Items | `AlertTriangle` | Red |
| Active Shift Cash | `Banknote` | Green |

Each KPI card shows:
- Metric label
- Large formatted value (e.g., "৳45,230.00")
- Small comparison text (e.g., "+12% from yesterday")
- Colored icon

**API Integration:**
- `GET /api/v1/reports/dashboard` — Fetch all KPI data
- Use `useQuery` with 5-minute stale time
- Show skeleton loading state

**Acceptance Criteria:**
- [ ] Metro-style cards match reference UI color scheme
- [ ] Card counts fetch from API and display correctly
- [ ] KPI metrics show today's financial summary
- [ ] Cards are clickable and navigate to correct pages
- [ ] Hover animations smooth and responsive
- [ ] Skeleton loading placeholders during data fetch
- [ ] Responsive: 4 cols → 2 cols → 1 col on smaller screens

---

## Step 3.2 — Sales Trend Chart & Top Products

**What to build (same page, below KPI cards):**

**Section 3: Two-Column Widget Row**

**Left Widget — Sales Trend Chart (70% width)**
- Line/Bar chart showing daily revenue for last 7 or 30 days
- Toggle: 7 Days / 30 Days
- Chart colors: Revenue (green area fill), Tax (blue line), Discounts (amber line)
- Built with Recharts `<AreaChart>` or `<BarChart>`
- Tooltip showing exact values on hover
- Responsive auto-sizing

**Right Widget — Top Selling Products (30% width)**
- Table listing top 10 products by quantity sold today/this week
- Columns: Rank, Product Name, Qty Sold, Revenue
- Toggle: Today / This Week

**Section 4: Alert Widgets Row**

**Left Widget — Low Stock Alerts**
- List of products where `currentStock <= alertQty`
- Shows: Product name, SKU, Current Stock (red badge), Alert Level
- \"View All\" link to `/inventory?filter=lowStock`

**Right Widget — Expiry Alerts**
- List of products/batches expiring within 30 days
- Shows: Product name, Batch No, Expiry Date (orange badge), Days Left
- \"View All\" link to `/inventory?filter=expiring`

**API Integration:**
- `GET /api/v1/reports/dashboard` — Dashboard summary (already called in Step 3.1)
- `GET /api/v1/reports/sales?period=7d` — Sales trend data
- `GET /api/v1/products?isLowStock=true&limit=5` — Low stock items
- Top products from dashboard payload

**Acceptance Criteria:**
- [ ] Sales chart renders with proper data and is interactive
- [ ] Top products table shows ranked list
- [ ] Low stock alerts show red badges for critical items
- [ ] Expiry alerts show orange/amber badges with days remaining
- [ ] All widgets are responsive and properly aligned
- [ ] Charts use Recharts with smooth animations

---

# ═══════════════════════════════════════════════════
# PHASE 4: Product Catalog, Categories & Brands
# ═══════════════════════════════════════════════════

> **Goal:** Build the complete product management UI — product list with search/filter, create/edit product modal with multi-variant support, category tree view, and brand management.

---

## Step 4.1 — Products List Page

**File:** `client/src/app/(dashboard)/products/page.tsx`

**What to build:**
- **Page Header:** Title \"Products\" + \"Add Product\" button (primary)
- **Filter Bar:**
  - Search input (debounced, searches by name/SKU/barcode)
  - Category dropdown filter
  - Brand dropdown filter
  - Low Stock toggle switch
  - Status filter: All / Active / Inactive
- **Data Table Columns:**
  - Product Image (thumbnail 40x40)
  - Product Name + variant count badge
  - SKU (first variant)
  - Category
  - Current Stock (colored: green >10, amber ≤10, red ≤alertQty)
  - Retail Price (`৳XXX.XX`)
  - Wholesale Price (`৳XXX.XX`) — *hidden for Cashier role*
  - Cost Price (`৳XXX.XX`) — *hidden for Cashier role*
  - Status badge (Active/Inactive)
  - Actions: Edit, View Variants, Print Barcode, Delete
- **Pagination** at bottom
- **Empty State:** Illustration + \"No products found\" + CTA

**API Integration:**
- `GET /api/v1/products?page=1&limit=20&search=&categoryId=&brandId=&isLowStock=`
- `DELETE /api/v1/products/:id` (soft delete with confirmation)

**Acceptance Criteria:**
- [ ] Product list loads with pagination
- [ ] Search by name/SKU/barcode works with debounce
- [ ] Category and brand filters work
- [ ] Low stock items highlighted with red badge
- [ ] Cost price column hidden for Cashier role
- [ ] Delete shows confirmation dialog
- [ ] Empty state displayed when no products match filters

---

## Step 4.2 — Product Create/Edit Modal

**File:** `client/src/components/modals/ProductFormModal.tsx`

**What to build:**
A large modal (`xl` size) for creating and editing products with variant management.

**Form Layout (Sections):**

**Section 1: Basic Information**
- Product Name (required)
- Category (dropdown, required)
- Brand (dropdown)
- Supplier (dropdown)
- Unit (dropdown: Pcs, Kg, Gram, Ltr, Ml, Box, Meter, Goj)
- Tax Type (radio: Inclusive, Exclusive, Exempt)
- Tax Rate (%) (auto-filled from category default)
- Description (textarea)
- Product Image (upload with preview)

**Section 2: Variants (Dynamic Array)**
- \"Add Variant\" button
- Each variant row:
  - Attribute Name (e.g., \"Default\", \"Large\", \"Red-XL\")
  - SKU (auto-generated or manual, required, unique)
  - Barcode (optional, unique)
  - Cost Price (required) — *hidden for Cashier*
  - Retail Selling Price (required)
  - Wholesale Selling Price (required)
  - Opening Stock (number)
  - Alert Quantity (number)
  - Rack Location (text)
  - Remove variant button (trash icon)
- Minimum 1 variant required

**Validation:**
- Zod schema validation on submit
- Required fields: name, category, at least 1 variant with SKU and prices
- SKU uniqueness validated by API

**API Integration:**
- `POST /api/v1/products` — Create
- `PUT /api/v1/products/:id` — Update

**Acceptance Criteria:**
- [ ] Can add product with single or multiple variants
- [ ] Dynamic variant rows can be added/removed
- [ ] Form validates all required fields before submit
- [ ] SKU auto-generation works
- [ ] Tax rate auto-fills from selected category
- [ ] Edit mode pre-fills all fields from existing product
- [ ] Loading state on submit button
- [ ] Success toast on create/update

---

## Step 4.3 — Categories Page (Tree View)

**File:** `client/src/app/(dashboard)/categories/page.tsx`
**File:** `client/src/components/modals/CategoryFormModal.tsx`

**What to build:**
- **Page Header:** Title \"Categories\" + \"Add Category\" button
- **Tree View Display:**
  - Expandable/collapsible tree showing parent-child hierarchy
  - Each node shows: Category name, code, product count, tax rate, status
  - Click expand/collapse chevron for children
  - Action buttons per node: Edit, Add Subcategory, Delete
- **Category Form Modal:**
  - Name (required)
  - Code (auto-generated uppercase slug)
  - Parent Category (dropdown, optional — for subcategories)
  - Default Tax Rate (%)
  - Description
  - Status toggle (Active/Inactive)

**API Integration:**
- `GET /api/v1/categories` — Flat list with `parentId` field
- `POST /api/v1/categories` — Create
- `PUT /api/v1/categories/:id` — Update
- `DELETE /api/v1/categories/:id` — Delete (409 if has products)

**Business Rules:**
- Cannot delete category with active products (show error toast)
- Subcategories inherit parent's default tax rate unless overridden

**Acceptance Criteria:**
- [ ] Categories display as interactive tree with expand/collapse
- [ ] Can create root categories and subcategories
- [ ] Delete blocked for categories with products (error message shown)
- [ ] Category codes are uppercase slugs
- [ ] Tree re-renders correctly after CRUD operations

---

## Step 4.4 — Brands Page

**File:** `client/src/app/(dashboard)/brands/page.tsx`
**File:** `client/src/components/modals/BrandFormModal.tsx`

**What to build:**
- **Page Header:** Title \"Brands\" + \"Add Brand\" button
- **Data Table Columns:** Brand Name, Origin Country, Logo, Product Count, Status, Actions (Edit/Delete)
- **Brand Form Modal:** Name, Origin Country, Logo URL, Status toggle

**API Integration:**
- `GET /api/v1/brands` — List
- `POST /api/v1/brands` — Create
- `PUT /api/v1/brands/:id` — Update
- `DELETE /api/v1/brands/:id` — Delete

**Acceptance Criteria:**
- [ ] Brand CRUD fully functional
- [ ] Brand logo displays as small icon in table
- [ ] Delete confirmation dialog works

---

## Step 4.5 — Barcode Label Generator Page

**File:** `client/src/app/(dashboard)/barcode-labels/page.tsx`
**File:** `client/src/components/modals/BarcodeLabelModal.tsx`

**What to build:**
- **Product Variant Selector:** Search and select product variants
- **Label Configuration:**
  - Quantity per variant
  - Label Format: `38x25mm Single`, `50x30mm Thermal`, `A4 Grid (24 Labels/sheet)`
  - Include toggles: Shop Name, Product Name, SKU, Barcode, MRP Price
- **Live Preview Panel:**
  - Renders barcode using `JsBarcode` (SVG)
  - Shows label preview matching selected format
  - Multiple labels in grid for A4 format
- **Print Button:** Direct print with `@media print` CSS

**Acceptance Criteria:**
- [ ] Barcode renders correctly using JsBarcode
- [ ] Label preview updates live as options change
- [ ] Print produces correct label sizes
- [ ] A4 grid layout shows 24 labels per page

---

# ═══════════════════════════════════════════════════
# PHASE 5: Suppliers & Purchase Order Management
# ═══════════════════════════════════════════════════

> **Goal:** Build supplier directory, purchase order creation with line items, PO detail page, and goods received note (GRN) modal.

---

## Step 5.1 — Suppliers Page

**File:** `client/src/app/(dashboard)/suppliers/page.tsx`
**File:** `client/src/components/modals/SupplierFormModal.tsx`
**File:** `client/src/components/modals/SupplierPaymentModal.tsx`

**What to build:**
- **Page Header:** Title \"Suppliers\" + \"Add Supplier\" button
- **Data Table Columns:** Company Name, Contact Person, Phone, Email, Payable Balance (amber if >0), Status, Actions
- **Actions:** Edit, View Ledger, Make Payment, Delete
- **Supplier Form Modal:** Company Name, Contact Person, Phone, Email, Address
- **Payment Modal:** Amount, Payment Account (dropdown), Reference, Notes

**Supplier Ledger Page:** `client/src/app/(dashboard)/suppliers/[id]/ledger/page.tsx`
- Transaction history table: Date, Type (PO Bill/Payment/Return), Debit, Credit, Balance, Reference, Narration
- Summary card at top: Total Payable, Total Paid, Current Balance

**API Integration:**
- CRUD: `/api/v1/suppliers`
- Ledger: `GET /api/v1/suppliers/:id/ledger`
- Payment: `POST /api/v1/suppliers/:id/payments`

**Acceptance Criteria:**
- [ ] Supplier list shows payable balances with color coding
- [ ] Payment modal debits account and credits supplier balance
- [ ] Ledger page shows complete transaction history
- [ ] Ledger balances calculate correctly

---

## Step 5.2 — Purchase Orders List Page

**File:** `client/src/app/(dashboard)/purchase-orders/page.tsx`

**What to build:**
- **Page Header:** Title \"Purchase Orders\" + \"Create PO\" button
- **Status Tabs:** All | Draft | Ordered | Partial | Received | Cancelled
- **Data Table Columns:** PO Number, Supplier, Items Count, Total Amount, Status Badge, Created Date, Expected Delivery, Actions
- **Status Badge Colors:** Draft (gray), Ordered (blue), Partial (amber), Received (green), Cancelled (red)
- **Actions:** View, Edit (Draft only), Receive (Ordered/Partial only)

**API Integration:**
- `GET /api/v1/purchase-orders?status=&page=&limit=`

**Acceptance Criteria:**
- [ ] Status tabs filter PO list correctly
- [ ] Status badges show correct colors
- [ ] Edit only available for Draft status
- [ ] Receive action only for Ordered/Partial status

---

## Step 5.3 — Create Purchase Order Page

**File:** `client/src/app/(dashboard)/purchase-orders/new/page.tsx`

**What to build:**
- **Step-by-step form:**
  1. Select Supplier (dropdown with search)
  2. Add Line Items (product variant search, ordered qty, unit cost)
  3. Review & Submit
- **Line Items Table:** Product Name, SKU, Ordered Qty, Unit Cost, Line Total, Remove
- **Summary Footer:** Subtotal, Tax Amount, Shipping Cost (input), Grand Total
- **Notes** textarea
- **Expected Delivery Date** picker
- **Save as Draft** button + **Save & Mark as Ordered** button

**API Integration:**
- `POST /api/v1/purchase-orders`

**Acceptance Criteria:**
- [ ] Product variant search with auto-complete
- [ ] Line totals calculate correctly (qty × unit cost)
- [ ] Grand total updates as items are added/removed
- [ ] Can save as Draft or directly mark as Ordered
- [ ] Validation prevents empty PO submission

---

## Step 5.4 — Purchase Order Detail & GRN Modal

**File:** `client/src/app/(dashboard)/purchase-orders/[id]/page.tsx`
**File:** `client/src/components/modals/GRNModal.tsx`

**What to build:**

**PO Detail Page:**
- PO header info: PO Number, Supplier, Status, Dates, Created By
- Line Items Table: Product, SKU, Ordered Qty, Received Qty, Remaining, Unit Cost, Line Total
- Progress bar per item (received/ordered)
- Payment summary: Total Amount, Paid, Due
- Action buttons: Receive Goods (opens GRN modal), Mark Cancelled, Print PO

**GRN Modal (Goods Received Note):**
- Lists all PO line items with ordered and previously received quantities
- Input fields per item: \"Qty Receiving Now\" (max: remaining)
- Optional per item: Batch No, Expiry Date
- Payment section: Pay Now amount, Payment Account
- \"Receive & Update Stock\" button

**API Integration:**
- `GET /api/v1/purchase-orders/:id`
- `POST /api/v1/purchase-orders/:id/receive`

**Acceptance Criteria:**
- [ ] PO detail shows all line items with receiving progress
- [ ] GRN modal prevents over-receiving (qty > remaining)
- [ ] Batch and expiry fields available for FEFO products
- [ ] Stock updates after receiving confirmed
- [ ] Status auto-transitions (ORDERED → PARTIAL → RECEIVED)
- [ ] Success toast with stock update confirmation

---

# ═══════════════════════════════════════════════════
# PHASE 6: Shift Management & Cash Register
# ═══════════════════════════════════════════════════

> **Goal:** Build shift open/close modals, petty cash management, shift history list, and printable Z-Report.

---

## Step 6.1 — Shift Modals

**File:** `client/src/components/modals/OpenShiftModal.tsx`
- Terminal ID input (text, e.g., \"POS-01\")
- Opening Float amount input (currency, e.g., ৳5000)
- Confirm \"Open Shift\" button
- Auto-opens when user navigates to POS without active shift

**File:** `client/src/components/modals/CloseShiftModal.tsx`
- Display: Opening Float, Cash Sales, Cash Expenses, Petty Cash In, Petty Cash Out
- **Expected Cash** (calculated) = Opening + Cash Sales - Cash Expenses + Petty In - Petty Out
- **Actual Cash Counted** input (user counts physical cash)
- **Discrepancy** display (Actual - Expected) — Green if 0, Red if ≠ 0
- Manager PIN field (required if |discrepancy| > ৳10)
- Notes textarea
- \"Close Shift\" button

**File:** `client/src/components/modals/PettyCashModal.tsx`
- Type: Cash In / Cash Out (radio)
- Amount input
- Reason/Description (required)
- \"Record\" button

**API Integration:**
- `POST /api/v1/shifts/open`
- `POST /api/v1/shifts/close`
- `POST /api/v1/shifts/petty-cash`
- `GET /api/v1/shifts/current`

**Acceptance Criteria:**
- [ ] Cannot open shift if one is already active (error message)
- [ ] Close shift calculates expected cash correctly
- [ ] Manager PIN required for large discrepancies
- [ ] Petty cash operations update shift totals

---

## Step 6.2 — Shift History & Z-Report

**File:** `client/src/app/(dashboard)/shifts/page.tsx`
- **Data Table Columns:** Shift ID, User, Terminal, Opened At, Closed At, Duration, Opening Float, Expected Cash, Actual Cash, Discrepancy, Status (Open/Closed)
- Discrepancy cell: Green if 0, Red if negative, Amber if positive
- Actions: View Z-Report

**File:** `client/src/app/(dashboard)/shifts/[id]/z-report/page.tsx`
- **Printable Z-Report Layout:**
  - Shop header (name, address, phone)
  - Shift details (ID, terminal, user, open/close times)
  - **Sales Summary:** Total invoices, items sold, gross sales, discounts, tax, net sales
  - **Payment Method Breakdown:** Cash, Card, bKash, Nagad, Store Credit, Customer Due
  - **Cash Register:** Opening Float, Cash Sales, Cash Expenses, Petty Cash In/Out, Expected Cash, Actual Cash, Discrepancy
  - **Returns Summary:** Returns count, total refund amount
  - Footer with manager signature line
- **Print Button:** Prints in A4 and thermal (58mm/80mm) format

**API Integration:**
- `GET /api/v1/shifts`
- `GET /api/v1/shifts/:id/z-report`

**Acceptance Criteria:**
- [ ] Shift history shows all past shifts with correct data
- [ ] Z-Report contains all required sections
- [ ] Z-Report is printable in A4 and thermal format
- [ ] Discrepancy highlighted with color

---

# ═══════════════════════════════════════════════════
# PHASE 7: POS Terminal (The Core Checkout System)
# ═══════════════════════════════════════════════════

> **Goal:** Build the full-screen POS terminal — the heart of the application. This includes barcode scanning, product grid, cart management, split payments, hold/resume cart, terminal lock, receipt printing, and offline buffering.

---

## Step 7.1 — POS Terminal Layout

**File:** `client/src/app/(pos)/pos/page.tsx`

**What to build:**
A full-screen, dedicated POS terminal layout (NO sidebar, NO header — independent layout).

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────────────┐
│  POS Header: [Search Bar] [Category Tabs] [Hold|Shift|Lock|Back] │
├────────────────────────────────────────┬────────────────────────┤
│                                        │                        │
│     Product Grid / Search Results      │     Cart Panel          │
│          (70% width)                   │     (30% width)         │
│                                        │                        │
│  [Product Cards with name, price,      │  Customer: [Select]     │
│   stock, image — click to add]         │  Tier: Retail/Wholesale │
│                                        │                        │
│                                        │  ┌─────────────────┐   │
│                                        │  │ Item 1   ৳xx  x2│   │
│                                        │  │ Item 2   ৳xx  x1│   │
│                                        │  │ Item 3   ৳xx  x3│   │
│                                        │  └─────────────────┘   │
│                                        │                        │
│                                        │  Subtotal: ৳XXXX       │
│                                        │  Tax:      ৳XXX        │
│                                        │  Discount: -৳XX        │
│                                        │  ─────────────────     │
│                                        │  TOTAL:    ৳XXXXX      │
│                                        │                        │
│                                        │  [Hold F4] [Pay F9]    │
└────────────────────────────────────────┴────────────────────────┘
```

**POS Header Bar:**
- Barcode/Search input (auto-focused, full-width)
- Category quick-filter tabs
- Hold Cart count badge (F4)
- Current shift info
- Lock Terminal button (Ctrl+L)
- Back to Dashboard button

**Acceptance Criteria:**
- [ ] Full-screen layout without sidebar/header
- [ ] Responsive: works on desktop (1080p+) and tablet (768px+)
- [ ] Product grid and cart panel properly proportioned
- [ ] POS header always visible at top

---

## Step 7.2 — Barcode Scanner & Product Search

**File:** `client/src/components/pos/BarcodeSearchInput.tsx`

**What to build:**
- Auto-focused input field at top of POS
- **USB Barcode Scanner Support:**
  - Detects rapid keystroke input (< 50ms between keystrokes)
  - Auto-submits on Enter key
  - Immediately adds scanned product to cart
- **Manual Text Search:**
  - Debounced search (300ms) on typing
  - Searches by product name, SKU, or barcode
  - Shows dropdown results list
  - Click result to add to cart
- **Quick Add:** After barcode scan, immediately add 1 qty to cart, focus back to search

**API Integration:**
- `GET /api/v1/products/barcode/:barcode` — Fast barcode lookup (< 100ms)
- `GET /api/v1/products?search=query&limit=10` — Text search

**Acceptance Criteria:**
- [ ] Barcode scanner input detects and processes USB scanner input
- [ ] Manual search shows dropdown with matching products
- [ ] Adding item to cart from search takes < 100ms
- [ ] Search input auto-refocuses after adding item
- [ ] No duplicate API calls during rapid scanning

---

## Step 7.3 — Product Grid

**File:** `client/src/components/pos/ProductGrid.tsx`

**What to build:**
- Grid of product cards (4-6 columns on desktop, 2-3 on tablet)
- **Category Filter Tabs:** Horizontal scrollable tabs at top
  - \"All\" tab + one tab per active category
  - Click category to filter products
- **Product Card:**
  - Product image (placeholder if none)
  - Product name (truncated)
  - Price: `৳XXX` (retail or wholesale based on tier)
  - Stock indicator: Green dot (in stock), Red dot (out/low stock)
  - Click to add 1 qty to cart (with brief animation)
- **Out of Stock:** Grayed out with \"Out of Stock\" overlay (if `allowNegativeStock = false`)
- **Loading State:** Skeleton card grid

**API Integration:**
- `GET /api/v1/products?categoryId=&limit=50` — Products for grid
- Cached with TanStack Query (5 min stale time)

**Acceptance Criteria:**
- [ ] Product grid loads fast from cache
- [ ] Category tabs filter products instantly
- [ ] Click product adds to cart with brief pulse animation
- [ ] Out-of-stock items visually distinguishable
- [ ] Grid is scrollable with virtual scroll for large catalogs

---

## Step 7.4 — Cart Panel

**File:** `client/src/components/pos/CartPanel.tsx`

**What to build:**
- **Customer Selector** at top (see Step 7.5)
- **Pricing Tier Toggle:** Retail / Wholesale (switches all prices)
- **Cart Items List:**
  - Each item row: Product name, variant, unit price, quantity controls (−, qty, +), line total, remove (X)
  - Quantity input: direct edit + increment/decrement buttons
  - Swipe to delete on touch devices
- **Bill Summary:**
  - Subtotal (sum of line totals)
  - Tax Amount (calculated per item based on tax type)
  - Discount (click to open discount field — see Step 7.7)
  - **Grand Total** (large, bold)
- **Action Buttons:**
  - \"Hold Cart\" (F4) — amber button
  - \"Clear Cart\" — ghost button with confirmation
  - \"Pay\" (F9) — large green button (disabled if cart empty)
- **Cart Empty State:** Shopping cart icon + \"Scan or search products\"

**Business Logic (Client-Side):**
- Line Total = unitPrice × quantity
- Tax Inclusive: `taxAmount = price - (price / (1 + taxRate/100))`
- Tax Exclusive: `taxAmount = price × (taxRate/100)`
- Tax Exempt: `taxAmount = 0`
- Grand Total = Subtotal + Tax (if exclusive) - Discount

**Acceptance Criteria:**
- [ ] Quantity +/- updates line total and grand total instantly
- [ ] Price tier toggle switches between retail/wholesale prices
- [ ] Tax calculations are accurate for all three types
- [ ] Cart persists during session (React state)
- [ ] Clear cart requires confirmation dialog
- [ ] Cart scrollable when many items

---

## Step 7.5 — Customer Selector

**File:** `client/src/components/pos/CustomerSelector.tsx`

**What to build:**
- Compact search input at top of cart panel: \"Search customer...\"
- Dropdown results showing: Name, Phone, Due Balance
- Click to select customer
- Selected customer displays: Name, Phone, Due: ৳XXX, Credit Limit: ৳XXX
- \"Walk-in Customer\" default option (no customer selected)
- **Quick Create:** \"Create New\" button in dropdown → opens inline mini-form (Name + Phone)
- When Wholesale customer selected: auto-switch pricing tier to Wholesale

**API Integration:**
- `GET /api/v1/customers?search=query&limit=10`
- `POST /api/v1/customers` — Quick create

**Business Rules:**
- Show warning badge if customer due is ≥ 90% of credit limit
- Customer type determines pricing tier auto-switch

**Acceptance Criteria:**
- [ ] Customer search by name or phone works
- [ ] Quick create customer without leaving POS
- [ ] Wholesale customer auto-switches pricing tier
- [ ] Credit limit warning displayed for high-due customers

---

## Step 7.6 — Payment Modal (Split Payments)

**File:** `client/src/components/pos/PaymentModal.tsx`

**What to build:**
A full-featured payment modal (triggered by F9 or \"Pay\" button):

**Modal Layout:**
```
┌─────────────────────────────────────────────────┐
│  Payment                           Grand Total  │
│                                    ৳12,450.00   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Payment Methods:                               │
│  ┌───────────────────────────────────────────┐  │
│  │ 💵 Cash         [৳__________]  Change: ৳X │  │
│  │ 💳 Card         [৳__________]  Auth: ____ │  │
│  │ 📱 bKash        [৳__________]  TxID: ____ │  │
│  │ 📱 Nagad        [৳__________]  TxID: ____ │  │
│  │ 🎫 Store Credit [Code: ____]   Bal: ৳XXX  │  │
│  │ 📋 Customer Due [৳__________]  Limit: ৳XX │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ─────────────────────────────────────────────  │
│  Total Paid:    ৳XXXXX                          │
│  Remaining:     ৳XXXXX (red if > 0)             │
│  Change:        ৳XXXXX (green, cash only)       │
│                                                 │
│  [Cancel]                    [Complete Sale ✓]   │
└─────────────────────────────────────────────────┘
```

**Payment Methods:**
1. **Cash:** Amount input → auto-calculate change if overpaid
2. **Card:** Amount input + Authorization Code
3. **bKash (MFS):** Amount input + Transaction ID
4. **Nagad (MFS):** Amount input + Transaction ID
5. **Store Credit:** Voucher code input → verify balance → max deduction = voucher balance
6. **Customer Due:** Amount input → check credit limit → shows remaining limit

**Split Payment Logic:**
- User can enter amounts across multiple methods
- Total Paid = sum of all method amounts
- Remaining = Grand Total - Total Paid
- Change = Total Paid - Grand Total (only for cash portion)
- \"Complete Sale\" enabled only when Remaining ≤ 0

**Pre-fill Logic:**
- If only cash: pre-fill full grand total in cash field
- Auto-focus first empty payment field

**API Integration:**
- `POST /api/v1/sales/checkout` — with `Idempotency-Key` header
- `GET /api/v1/vouchers/:code` — Verify store credit voucher

**Acceptance Criteria:**
- [ ] Split payment across multiple methods works correctly
- [ ] Change calculated only for cash payments
- [ ] Store credit voucher verification and balance check works
- [ ] Customer due checks credit limit before allowing
- [ ] Idempotency key prevents duplicate billing
- [ ] \"Complete Sale\" button disabled until fully paid
- [ ] Loading state during checkout API call
- [ ] On success: show receipt preview (Step 7.9)

---

## Step 7.7 — Discount Handling & Manager Override

**File:** `client/src/components/pos/DiscountField.tsx`
**File:** `client/src/components/modals/ManagerOverrideModal.tsx`

**What to build:**

**Discount Field:**
- Toggle: Percentage (%) or Fixed Amount (৳)
- Apply to: Entire Bill or Per Line Item
- Input field for discount value
- Real-time grand total recalculation

**Manager Override Modal:**
- Triggered when discount > 10% (for Cashier role)
- 4-digit PIN entry pad (on-screen + keyboard)
- \"Approve Discount\" button
- Shows: Requested discount %, Original total, Discounted total

**Business Rules:**
- Cashier: up to 10% discount without approval
- 11-50%: Requires Manager PIN
- > 50%: Requires Admin password
- All overrides logged to audit

**Acceptance Criteria:**
- [ ] Discount field toggles between % and fixed amount
- [ ] Manager override triggered for discounts > 10%
- [ ] PIN verification works with backend
- [ ] Grand total updates live with discount

---

## Step 7.8 — Hold/Resume Cart

**File:** `client/src/components/pos/HoldCartBar.tsx`

**What to build:**
- **Hold Button (F4):** Parks current cart with label and timestamp
  - Opens mini-modal for cart label (default: \"Cart 1\", \"Cart 2\", etc.)
  - Saves cart to backend with 24h TTL
  - Clears current cart for new transaction
- **Resume Button (Shift+F4):** Opens panel showing held carts
  - List: Cart Label, Customer (if any), Items Count, Total, Time Held
  - Click to restore cart to active POS
  - Delete button to discard held cart
- **Badge:** Shows count of held carts on header

**API Integration:**
- `POST /api/v1/hold-carts` — Park cart
- `GET /api/v1/hold-carts` — List held carts
- `GET /api/v1/hold-carts/:id` — Get single held cart
- `DELETE /api/v1/hold-carts/:id` — Delete

**Acceptance Criteria:**
- [ ] Hold saves current cart and clears POS for new transaction
- [ ] Resume restores all cart items, customer, and pricing tier
- [ ] Held cart count badge updates in real-time
- [ ] Delete held cart requires confirmation

---

## Step 7.9 — Receipt Preview & Thermal Print

**File:** `client/src/components/pos/ReceiptPreview.tsx`

**What to build:**
Post-checkout receipt preview modal:

**Receipt Layout (58mm / 80mm):**
```
========== SMART RETAIL POS ==========
       123 Main Street, Dhaka
         Phone: 01XXXXXXXXX
========================================
Invoice: INV-20260911-00015
Date: 11 Sep 2026, 03:29 PM
Cashier: John Doe
Customer: Walk-in
========================================
Product          Qty   Price    Total
─────────────────────────────────────
Rice 5kg          2   ৳350.00  ৳700.00
Cooking Oil 1L    1   ৳180.00  ৳180.00
Sugar 1kg         3   ৳120.00  ৳360.00
─────────────────────────────────────
Subtotal:                    ৳1,240.00
Tax (5%):                       ৳62.00
Discount:                      -৳50.00
========================================
TOTAL:                       ৳1,252.00
========================================
Cash:            ৳1,300.00
Change:             ৳48.00
========================================
    Thank you for shopping with us!
         Exchange within 7 days
========================================
```

- **Print Button:** Sends to thermal printer (ESC/POS via WebUSB or CSS fallback)
- **New Sale Button:** Clears receipt and resets POS for next customer
- **Auto-print option:** Settings toggle for auto-print after checkout

**API Integration:**
- Uses sale data returned from checkout API response

**Acceptance Criteria:**
- [ ] Receipt shows all invoice details correctly
- [ ] Print works on thermal printers (58mm and 80mm)
- [ ] CSS fallback print produces correct receipt layout
- [ ] \"New Sale\" resets POS completely

---

## Step 7.10 — Terminal Lock Screen

**File:** `client/src/components/pos/TerminalLockScreen.tsx`

**What to build:**
Full-screen lock overlay (triggered by Ctrl+L or inactivity timeout):

- **Full-screen dark overlay** with lock icon
- **Shop name** and **current time** display
- **4-digit PIN pad:** On-screen number buttons (0-9) + keyboard input
- **PIN input:** 4 dots that fill as digits are entered
- **Unlock button** or auto-submit on 4th digit
- **Wrong PIN:** Shake animation + error message
- **User name** shown (\"Locked by: John Doe\")

**API Integration:**
- `POST /api/v1/auth/lock-terminal`
- `POST /api/v1/auth/unlock-terminal`

**Acceptance Criteria:**
- [ ] Lock screen blocks all POS actions until PIN verified
- [ ] On-screen PIN pad works for touch devices
- [ ] Keyboard PIN entry works
- [ ] Wrong PIN shows shake animation
- [ ] Ctrl+L toggles lock from anywhere in POS

---

## Step 7.11 — POS Keyboard Hotkeys

**File:** `client/src/hooks/usePOSHotkeys.ts` (update)

**Hotkey Map:**
| Key | Action |
|:---|:---|
| `F2` | Focus barcode/product search input |
| `F4` | Hold/Park current cart |
| `Shift+F4` | Open held carts list |
| `F8` | Focus customer selector |
| `F9` | Open payment modal |
| `Ctrl+L` | Lock terminal |
| `Enter` | Confirm payment (in payment modal) |
| `Escape` | Close current modal / clear search |
| `Delete` | Remove selected cart item |
| `+` / `-` | Increment/decrement selected item qty |

**Acceptance Criteria:**
- [ ] All hotkeys work correctly in POS context
- [ ] Hotkeys don't trigger when typing in input fields (except search)
- [ ] Hotkey tooltips shown on button hover

---

## Step 7.12 — Offline Cart Buffering (IndexedDB)

**File:** `client/src/lib/offline-queue.ts` (update)
**File:** `client/src/hooks/useOfflineSync.ts` (update)

**What to build:**
- Detect online/offline status via `navigator.onLine` + `window.addEventListener('online'/'offline')`
- When offline: queue checkout payloads to IndexedDB with idempotency key and timestamp
- Show \"Offline Mode\" amber indicator in POS header
- When online restored: auto-sync queued sales in background (FIFO)
- Show sync progress indicator
- Handle oversell conflicts per PRD protocol

**Visual Indicators:**
- Online: Green dot + \"Connected\"
- Offline: Amber pulsing dot + \"Offline Mode — Sales will sync when connected\"
- Syncing: Blue spinner + \"Syncing X sales...\"

**Acceptance Criteria:**
- [ ] POS works fully offline (cart, pricing, checkout to queue)
- [ ] Queued sales auto-sync when connection restored
- [ ] Sync progress visible to user
- [ ] Oversell conflicts handled gracefully with alert

---

# ═══════════════════════════════════════════════════
# PHASE 8: Customers, Sales History & Returns
# ═══════════════════════════════════════════════════

> **Goal:** Build customer directory with Bakir Khata (credit ledger), sales history browsing, invoice detail view, and sales return processing.

---

## Step 8.1 — Customers Page

**File:** `client/src/app/(dashboard)/customers/page.tsx`
**File:** `client/src/components/modals/CustomerFormModal.tsx`
**File:** `client/src/components/modals/PayDueModal.tsx`

**What to build:**
- **Page Header:** Title \"Customers\" + \"Add Customer\" button
- **Data Table Columns:** Name, Phone, Email, Type (Retail/Wholesale badge), Credit Limit, Due Balance (red if high), Loyalty Points, Status, Actions
- **Actions:** Edit, View Ledger (Bakir Khata), Collect Payment, Deactivate
- **Due Balance Warning:** Red text + warning icon when due ≥ 90% of credit limit

**Customer Form Modal:**
- Name, Phone (unique), Email, Address
- Type: Retail / Wholesale (radio)
- Credit Limit (৳)
- Status toggle

**Pay Due Modal:**
- Customer info display (name, current due)
- Amount to collect (max = current due)
- Payment Account dropdown (Cash/Bank/MFS)
- Receipt/Reference input
- \"Collect Payment\" button

**Bakir Khata Ledger Page:** `client/src/app/(dashboard)/customers/[id]/ledger/page.tsx`
- Customer profile card at top: Name, Phone, Credit Limit, Current Due, Total Purchases
- Transaction history table: Date, Type (Sale Due/Payment/Return Credit), Debit, Credit, Running Balance, Reference, Narration
- **Visual Design:** Traditional ledger-style with alternating colors

**API Integration:**
- CRUD: `/api/v1/customers`
- Ledger: `GET /api/v1/customers/:id/ledger`
- Pay Due: `POST /api/v1/customers/:id/pay-due`

**Acceptance Criteria:**
- [ ] Customer list with type badges and due balance coloring
- [ ] Payment collection updates due balance instantly
- [ ] Bakir Khata ledger shows complete history with running balance
- [ ] Credit limit warning at 90% threshold
- [ ] Quick customer creation from POS works

---

## Step 8.2 — Sales History Page

**File:** `client/src/app/(dashboard)/sales/page.tsx`

**What to build:**
- **Page Header:** Title \"Sales History\"
- **Filter Bar:**
  - Date Range Picker
  - Cashier dropdown filter
  - Customer search filter
  - Payment status: All / Paid / Partial / Due
  - Search by Invoice Number
- **Data Table Columns:** Invoice No (link), Date/Time, Customer, Cashier, Items Count, Total Amount, Paid, Due, Payment Methods (badge chips), Actions
- **Actions:** View Invoice, Reprint Receipt, Process Return
- **Summary Row at Top:** Total Sales, Total Revenue, Total Tax, Total Due (for filtered period)

**API Integration:**
- `GET /api/v1/sales?startDate=&endDate=&cashierId=&customerId=&status=&page=&limit=`

**Acceptance Criteria:**
- [ ] Sales list loads with all filters working
- [ ] Date range filter defaults to \"Today\"
- [ ] Invoice numbers are clickable links to detail page
- [ ] Summary row shows aggregated totals for filtered data
- [ ] Can trigger return process from sales list

---

## Step 8.3 — Invoice Detail Page

**File:** `client/src/app/(dashboard)/sales/[id]/page.tsx`

**What to build:**
- **Invoice Header:** Invoice No, Date/Time, Cashier, Customer, Shift ID
- **Line Items Table:** Product Name, Variant, SKU, Qty, Unit Price, Tax, Discount, Line Total
- **Payment Breakdown:** Method, Amount, Reference/TxID
- **Summary:** Subtotal, Tax, Discount, Grand Total, Paid, Due, Change
- **Action Buttons:**
  - Reprint Receipt (opens ReceiptPreview modal)
  - Process Return (opens ReturnModal)
  - Collect Due Payment (if has due — opens PayDueModal)
- **Return History:** If returns exist for this sale, show return records below

**API Integration:**
- `GET /api/v1/sales/:id`

**Acceptance Criteria:**
- [ ] Invoice shows all line items with correct totals
- [ ] Payment methods displayed with badges
- [ ] Can reprint receipt from this page
- [ ] Return button opens return modal pre-filled with invoice items
- [ ] Due collection button shown only for invoices with outstanding due

---

## Step 8.4 — Sales Return Modal

**File:** `client/src/components/modals/ReturnModal.tsx`

**What to build:**
A comprehensive return processing modal:

**Layout:**
- **Original Invoice Info:** Invoice No, Date, Customer, Total Amount
- **Line Items Selection:** Checkboxes + quantity input for items to return
  - Each item shows: Product, Qty Sold, Qty Already Returned, Max Returnable
  - Qty to Return input (max = sold - already returned)
  - Toggle per item: \"Resaleable (Restock)\" vs \"Damaged (Wastage)\"
- **Refund Summary:**
  - Proportional net refund calculated per item
  - Formula shown: `Refund = Price - (Price × (Discount / Subtotal))`
  - If customer has outstanding due: show \"Due Adjustment\" amount first
  - Remaining refund via: Cash / Store Credit Voucher
- **Refund Type Selector:** Due Adjustment (auto), Cash, Store Credit
- **Manager PIN Authorization:** Required for all returns
- **Return Reason:** Required textarea
- **\"Process Return\" button**

**Business Rules (Client-Side Validation):**
- Cannot return more than sold - already returned
- Manager PIN required (opens ManagerOverrideModal)
- Customer due is credited first before cash/voucher
- Proportional discount applied to refund calculation

**API Integration:**
- `POST /api/v1/returns`

**Acceptance Criteria:**
- [ ] Return quantities validated against original sale
- [ ] Proportional refund calculated correctly for discounted items
- [ ] Customer due prioritized in refund
- [ ] Manager PIN required and verified
- [ ] Store credit voucher code generated and displayed on success
- [ ] Success toast with return confirmation

---

# ═══════════════════════════════════════════════════
# PHASE 9: Inventory, Expenses & Financial Accounts
# ═══════════════════════════════════════════════════

> **Goal:** Build inventory stock management with alerts, expense tracking, and financial account ledger.

---

## Step 9.1 — Inventory Page

**File:** `client/src/app/(dashboard)/inventory/page.tsx`
**File:** `client/src/components/modals/StockAdjustmentModal.tsx`

**What to build:**
- **Page Header:** Title \"Inventory\" + \"Stock Adjustment\" button
- **Filter Tabs:** All | Low Stock | Expiring Soon | Out of Stock
- **Data Table Columns:** Product Name, Variant/SKU, Barcode, Current Stock, Alert Qty, Status Badge, Unit, Rack Location, Last Movement, Actions
- **Status Badges:**
  - 🟢 In Stock (currentStock > alertQty)
  - 🟡 Low Stock (0 < currentStock ≤ alertQty) — Amber
  - 🔴 Out of Stock (currentStock = 0) — Red
  - ⏰ Expiring Soon (batch expiry within 30 days) — Orange
- **Actions:** Adjust Stock, View Movement History, Print Barcode

**Stock Adjustment Modal:**
- Product & Variant display (read-only)
- Current Stock display
- Adjustment Type: Manual Adjustment / Wastage Write-Off
- Quantity (+/- input or absolute)
- Reason (required text)
- If Wastage: Account selection for loss booking
- New stock calculation preview

**Stock Movement History (expandable section or sub-page):**
- Table: Date, Type (IN/OUT/ADJUSTMENT/RETURN/WASTAGE), Qty, Before, After, Reference, User

**API Integration:**
- `GET /api/v1/products?isLowStock=true`
- `POST /api/v1/stock-movements/adjust`
- `GET /api/v1/stock-movements?variantId=`

**Acceptance Criteria:**
- [ ] Filter tabs show correct item counts
- [ ] Low stock and expiry badges clearly visible
- [ ] Stock adjustment updates stock and creates movement record
- [ ] Wastage write-off creates expense entry automatically
- [ ] Movement history shows complete audit trail

---

## Step 9.2 — Expenses Page

**File:** `client/src/app/(dashboard)/expenses/page.tsx`
**File:** `client/src/components/modals/ExpenseFormModal.tsx`

**What to build:**
- **Page Header:** Title \"Expenses\" + \"Add Expense\" button
- **Filter Bar:** Date range, Category dropdown, Account dropdown
- **Data Table Columns:** Date, Category, Description, Amount, Account, Receipt, Created By, Actions
- **Summary Cards:** Total Expenses (period), By Category breakdown (mini bar chart)

**Expense Form Modal:**
- Category dropdown (with \"Manage Categories\" link)
- Amount (৳)
- Account (Cash/Bank/MFS dropdown)
- Description
- Receipt/Voucher upload (image)
- Account balance warning if insufficient

**Expense Categories Sub-section:**
- Simple CRUD for expense categories (inline or modal)
- Default categories: Rent, Utilities, Salary, Transport, Inventory Shrinkage, Miscellaneous

**API Integration:**
- `GET /api/v1/expenses`
- `POST /api/v1/expenses`
- `GET /api/v1/expenses/categories`
- `POST /api/v1/expenses/categories`

**Acceptance Criteria:**
- [ ] Expense creation debits selected account
- [ ] Account balance warning when insufficient
- [ ] Category filter works
- [ ] Date range filter works
- [ ] Summary cards show period totals

---

## Step 9.3 — Financial Accounts Page

**File:** `client/src/app/(dashboard)/accounts/page.tsx`
**File:** `client/src/components/modals/AccountFormModal.tsx`
**File:** `client/src/components/modals/FundTransferModal.tsx`

**What to build:**
- **Page Header:** Title \"Financial Accounts\" + \"Add Account\" button + \"Transfer Funds\" button
- **Account Cards Grid:** One card per account showing:
  - Account Name, Type badge (Cash/Bank/MFS), Account Number
  - Current Balance (large, colored)
  - \"View Ledger\" link
- **Account Form Modal:** Name, Type (Cash/Bank/MFS), Account Number, Initial Balance
- **Fund Transfer Modal:**
  - From Account (dropdown with balance display)
  - To Account (dropdown)
  - Transfer Amount
  - Description/Reference
  - Balance preview after transfer

**Account Ledger Page:** `client/src/app/(dashboard)/accounts/[id]/ledger/page.tsx`
- Account header card: Name, Type, Current Balance
- Transaction table: Date, Type (CREDIT/DEBIT), Amount, Balance After, Reference Type, Reference ID, Description
- Credits in green, Debits in red

**API Integration:**
- CRUD: `/api/v1/accounts`
- Transfer: `POST /api/v1/accounts/transfer`
- Ledger: `GET /api/v1/accounts/:id/transactions`

**Acceptance Criteria:**
- [ ] Account cards show real-time balances
- [ ] Fund transfer creates paired debit/credit entries
- [ ] Transfer blocked if source balance insufficient
- [ ] Ledger shows complete immutable history
- [ ] Credits green, debits red in ledger

---

# ═══════════════════════════════════════════════════
# PHASE 10: User Management, Roles & Settings
# ═══════════════════════════════════════════════════

> **Goal:** Build admin user management, role permissions matrix, audit log viewer, and shop settings page.

---

## Step 10.1 — User Management Page

**File:** `client/src/app/(dashboard)/users/page.tsx`
**File:** `client/src/app/(dashboard)/users/[id]/page.tsx`
**File:** `client/src/components/modals/CreateUserModal.tsx` (update)

**What to build:**
- **Page Header:** Title \"Users\" + \"Add User\" button
- **Data Table Columns:** Avatar (initials), Full Name, Username, Phone, Role Badge, Status (Active/Inactive), Last Login, Actions
- **Actions:** Edit, Reset Password, Change PIN, Deactivate/Activate

**Create User Modal:**
- Full Name, Username (auto-slug from name), Email, Phone
- Password (auto-generate option)
- 4-digit PIN
- Role dropdown (Admin/Manager/Cashier/Custom)
- Status toggle

**Edit User Page:**
- Profile form (name, email, phone)
- Role change dropdown
- Reset Password section
- Change PIN section
- Activity log (last login, created date)
- Deactivate/Activate button

**API Integration:**
- CRUD: `/api/v1/users`
- `PATCH /api/v1/users/:id/pin` — Update PIN

**Acceptance Criteria:**
- [ ] Only Admin can access user management
- [ ] Passwords are never displayed, only reset
- [ ] PIN change works
- [ ] Can deactivate/reactivate users (soft delete)
- [ ] Role badges show correct colors

---

## Step 10.2 — Role & Permissions Page

**File:** `client/src/app/(dashboard)/roles/page.tsx`

**What to build:**
- **Role List:** Cards for each role (SUPER_ADMIN, BRANCH_MANAGER, CASHIER, Custom...)
- **Permissions Matrix:**
  - Table grid with permission categories as rows and roles as columns
  - Checkboxes for each permission
  - System roles (isSystemRole) show read-only permissions
- **Create Custom Role:** Button to create new role with custom permission set
- **Permission Categories:** Group permissions logically:
  - POS: `pos:checkout`
  - Inventory: `inv:view`, `inv:manage`, `inv:adjust`, `inv:labels`
  - Procurement: `procurement:view`, `procurement:manage`, `procurement:receive`, `procurement:pay`
  - Sales: `sales:view`, `returns:authorize`
  - Shifts: `shifts:operate`, `shifts:view`
  - Customers: `customers:view`, `customers:create`, `customers:manage`, `customers:pay_due`
  - Accounts: `accounts:view`, `accounts:manage`, `accounts:transfer`
  - Expenses: `expenses:view`, `expenses:create`, `expenses:manage`
  - Reports: `reports:dashboard`, `reports:sales`, `reports:inventory`, etc.
  - Admin: `audit:view`, `settings:manage`, `users:manage`, `roles:view`, `roles:manage`

**Acceptance Criteria:**
- [ ] Permissions matrix shows all permissions grouped by category
- [ ] System roles cannot be deleted or have permissions changed
- [ ] Custom roles can be created and modified
- [ ] Checkboxes toggle permissions for custom roles

---

## Step 10.3 — Audit Logs Page

**File:** `client/src/app/(dashboard)/audit-logs/page.tsx`

**What to build:**
- **Page Header:** Title \"Audit Logs\"
- **Filter Bar:** Date range, User dropdown, Entity type dropdown, Action type dropdown
- **Data Table Columns:** Timestamp, User, Action (badge), Entity, Entity ID, IP Address, Details (expand)
- **Action Badges:** CREATE (green), UPDATE (blue), DELETE (red), PRICE_OVERRIDE (amber), SHIFT_DISCREPANCY (orange)
- **Expandable Details:** JSON diff view showing before/after values for UPDATE actions
- **Read-only:** No edit/delete actions (audit logs are immutable)

**API Integration:**
- `GET /api/v1/audit-logs?startDate=&endDate=&userId=&entity=&action=&page=&limit=`

**Acceptance Criteria:**
- [ ] Audit logs are read-only
- [ ] Filters work correctly
- [ ] JSON diff shows before/after for updates
- [ ] Action badges with correct colors
- [ ] Pagination for large datasets

---

## Step 10.4 — Settings Page

**File:** `client/src/app/(dashboard)/settings/page.tsx`

**What to build:**
Multi-section settings form (Admin only):

**Section 1: Shop Information**
- Shop Name, Address, Phone, Email
- Logo upload with preview
- Currency Symbol

**Section 2: Tax & Pricing**
- Default Tax Rate (%)
- Allow Negative Stock toggle (with warning)

**Section 3: Hardware**
- Thermal Printer Type: 58mm / 80mm
- Barcode Label Format: 38x25mm / 50x30mm / A4 Grid
- Cash Drawer Trigger Code

**Section 4: Receipt Customization**
- Receipt Header (textarea, e.g., \"Thank you for shopping!\")
- Receipt Footer (textarea, e.g., \"Exchange within 7 days\")

**Save Button:** Updates all settings in single API call

**API Integration:**
- `GET /api/v1/settings`
- `PUT /api/v1/settings`

**Acceptance Criteria:**
- [ ] All settings fields load from API
- [ ] Save updates all fields
- [ ] Logo upload with preview works
- [ ] Negative stock toggle shows warning alert
- [ ] Only Admin can access settings

---

# ═══════════════════════════════════════════════════
# PHASE 11: Reports & Analytics Engine
# ═══════════════════════════════════════════════════

> **Goal:** Build the reporting hub with all 7 report types, each with filters, data tables, charts, and export capabilities (PDF, Excel, Thermal Print).

---

## Step 11.1 — Reports Hub Page

**File:** `client/src/app/(dashboard)/reports/page.tsx`

**What to build:**
Report selector page with cards linking to each report type:

| Report | Icon | Route | Description |
|:---|:---|:---|:---|
| Sales Report | `Receipt` | `/reports/sales` | Sales by item, cashier, category |
| Inventory Valuation | `Warehouse` | `/reports/inventory` | Cost vs retail stock value |
| Inventory Wastage | `Trash2` | `/reports/wastage` | Shrinkage & loss report |
| Purchase Summary | `Truck` | `/reports/purchases` | Procurement summary |
| Customer Due Aging | `Users` | `/reports/customer-aging` | Bakir Khata aging report |
| Supplier Payable | `Building2` | `/reports/supplier-payable` | Vendor payable aging |
| Profit & Loss | `TrendingUp` | `/reports/pnl` | Double-entry P&L statement |

Each card shows report name, icon, description, and \"View Report →\" link.

**Acceptance Criteria:**
- [ ] All report cards link to correct pages
- [ ] Cards are visually appealing with icons and descriptions
- [ ] Only reports the user has permission to view are shown

---

## Step 11.2 — Report Toolbar Component

**File:** `client/src/components/reports/ReportToolbar.tsx`

**What to build:**
Reusable toolbar for all report pages:
- **Date Range Picker** with presets (Today, Yesterday, This Week, This Month, Last 30 Days, Custom)
- **Additional Filters:** Slot for report-specific filters
- **Export Buttons:** PDF, Excel, Print
- **Refresh Button**

**Export Logic:**
- **Excel:** `GET /api/v1/reports/{type}?format=excel` → Download streaming `.xlsx` file
- **PDF:** `GET /api/v1/reports/{type}?format=pdf` → Download `.pdf` file
- **Print:** Open printable view in new tab/window with `@media print` CSS

**Acceptance Criteria:**
- [ ] Date range picker works with all presets
- [ ] Export buttons trigger correct downloads
- [ ] Print opens formatted printable view
- [ ] Toolbar is reusable across all report pages

---

## Step 11.3 — Sales Report Page

**File:** `client/src/app/(dashboard)/reports/sales/page.tsx`

**What to build:**
- **ReportToolbar** with date range
- **Additional Filters:** Cashier dropdown, Category dropdown, Payment Method dropdown
- **Summary Cards:** Total Revenue, Total Tax, Total Discounts, Total Due, Invoice Count
- **Data Table:** Date, Invoice Count, Gross Sales, Discounts, Tax, Net Revenue
- **Chart:** Daily revenue bar/line chart for selected period
- **Drill-down:** Click date row to see individual invoices

**API Integration:**
- `GET /api/v1/reports/sales?startDate=&endDate=&cashierId=&categoryId=&format=json`

**Acceptance Criteria:**
- [ ] Sales data aggregated by date for selected period
- [ ] Chart shows revenue trend
- [ ] Can drill down to daily invoices
- [ ] Export to PDF and Excel works

---

## Step 11.4 — Inventory Valuation Report Page

**File:** `client/src/app/(dashboard)/reports/inventory/page.tsx`

**What to build:**
- **Summary Cards:** Total Cost Value (stock × WAC), Total Retail Value (stock × retail price), Potential Gross Profit
- **Data Table:** Product, Variant/SKU, Current Stock, Cost Price (WAC), Retail Price, Cost Value, Retail Value
- **Category Breakdown:** Pie chart showing stock value by category

**API Integration:**
- `GET /api/v1/reports/inventory-valuation`

**Acceptance Criteria:**
- [ ] Cost and retail values calculated correctly
- [ ] Category breakdown chart renders
- [ ] Export works

---

## Step 11.5 — Profit & Loss (P&L) Report Page

**File:** `client/src/app/(dashboard)/reports/pnl/page.tsx`

**What to build:**
Traditional P&L statement layout:

```
                P&L Statement
         Period: Sep 1 - Sep 11, 2026
─────────────────────────────────────────
REVENUE
  Sales Revenue                ৳XXX,XXX
  Less: Sales Returns          (৳X,XXX)
─────────────────────────────────────────
  NET REVENUE                  ৳XXX,XXX
─────────────────────────────────────────

COST OF GOODS SOLD (COGS)
  Opening Stock Value          ৳XXX,XXX
  + Purchases (GRN)            ৳XXX,XXX
  - Closing Stock Value        (৳XXX,XXX)
─────────────────────────────────────────
  TOTAL COGS                   ৳XXX,XXX
─────────────────────────────────────────

GROSS PROFIT                   ৳XXX,XXX
  Gross Margin %               XX.X%
─────────────────────────────────────────

OPERATING EXPENSES
  Rent                         ৳XX,XXX
  Utilities                    ৳XX,XXX
  Salary                       ৳XX,XXX
  Inventory Shrinkage          ৳X,XXX
  Other Expenses               ৳X,XXX
─────────────────────────────────────────
  TOTAL EXPENSES               ৳XXX,XXX
─────────────────────────────────────────

NET PROFIT / (LOSS)            ৳XXX,XXX
  Net Margin %                 XX.X%
═════════════════════════════════════════
```

**API Integration:**
- `GET /api/v1/reports/pnl?startDate=&endDate=`

**Acceptance Criteria:**
- [ ] P&L statement follows standard accounting format
- [ ] All values calculated correctly from API data
- [ ] Printable in A4 format
- [ ] Export to PDF and Excel works

---

## Step 11.6 — Other Report Pages

Create the following additional report pages with the same pattern (ReportToolbar + Data Table + Summary Cards + Chart + Export):

### Customer Due Aging Report
**File:** `client/src/app/(dashboard)/reports/customer-aging/page.tsx`
- Aging buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days
- Customer list with due amounts in each bucket
- Total due by aging bucket summary

### Supplier Payable Report
**File:** `client/src/app/(dashboard)/reports/supplier-payable/page.tsx`
- Similar aging bucket structure for supplier payables
- Supplier list with payable amounts

### Purchase Summary Report
**File:** `client/src/app/(dashboard)/reports/purchases/page.tsx`
- PO list by date range with totals
- Summary: Total POs, Total Amount, Paid, Outstanding

### Inventory Wastage Report
**File:** `client/src/app/(dashboard)/reports/wastage/page.tsx`
- Wastage entries by date range
- Summary: Total Wastage Count, Total Loss Amount
- Chart: Wastage trend over time

**Acceptance Criteria:**
- [ ] All 4 additional report pages created
- [ ] Each has proper filters and data tables
- [ ] Export (PDF/Excel) works on each
- [ ] Reports are permission-controlled

---

# ═══════════════════════════════════════════════════
# PHASE 12: Polish, Performance & Production Ready
# ═══════════════════════════════════════════════════

> **Goal:** Performance optimization, responsive design verification, accessibility improvements, error boundary handling, and production deployment preparation.

---

## Step 12.1 — Error Boundaries & Loading States

**What to build:**
- **Global Error Boundary:** `client/src/app/error.tsx` — Catches unhandled errors with retry button
- **Not Found Page:** `client/src/app/not-found.tsx` — 404 page with \"Go Home\" button
- **Loading States:** `client/src/app/loading.tsx` — Full-page loading spinner
- **Per-Page Loading:** Each page shows skeleton/shimmer during data fetch
- **Empty States:** Each data table shows illustration + message when no data

**Acceptance Criteria:**
- [ ] Unhandled errors show friendly error page with retry
- [ ] 404 page shows for invalid routes
- [ ] Loading skeletons show during data fetch (no blank pages)
- [ ] Empty states are visually appealing

---

## Step 12.2 — Responsive Design Verification

**What to verify:**
- **Desktop (1920px+):** Full sidebar + multi-column layouts
- **Laptop (1366px):** Standard layout
- **Tablet (768px-1024px):** Sidebar as overlay drawer, adjusted grids
- **POS Terminal:** Optimized for 1024px+ with touch-friendly targets (44px min)

**Breakpoint Adjustments:**
- Dashboard cards: 4-col → 3-col → 2-col → 1-col
- Data tables: horizontal scroll on mobile
- POS: product grid 4-col → 3-col, cart panel below on tablet portrait
- Modals: full-screen on mobile

**Acceptance Criteria:**
- [ ] All pages work on desktop and tablet breakpoints
- [ ] POS terminal works on 10\" tablet in landscape
- [ ] Touch targets are minimum 44px for POS buttons
- [ ] No horizontal overflow on any page
- [ ] Sidebar transforms to drawer on mobile

---

## Step 12.3 — Performance Optimization

**Checklist:**
- [ ] TanStack Query caching: 5-min stale time for product/category/brand data
- [ ] POS product search: < 100ms response (cached product list)
- [ ] Barcode scan to cart: < 100ms total
- [ ] Dashboard: < 2s initial load (skeleton → data)
- [ ] Lazy-loaded routes: reports, settings, audit logs
- [ ] Image optimization: Next.js `<Image>` component for all product images
- [ ] Bundle analysis: ensure no unused dependencies
- [ ] React.memo on frequently re-rendered components (Cart items, Product cards)

---

## Step 12.4 — Production Build & Deployment Prep

**What to do:**
1. Create `.env.production` with production API URL
2. Run `npm run build` — ensure no TypeScript or build errors
3. Test production build with `npm start`
4. Verify all routes work in production mode
5. Configure `next.config.mjs` for production:
   - Image domains for product images
   - API proxy/rewrite rules if needed
   - Security headers

**Acceptance Criteria:**
- [ ] `npm run build` succeeds without errors
- [ ] Production build runs correctly
- [ ] All routes accessible in production
- [ ] Environment variables properly configured

---

# ═══════════════════════════════════════════════════
# 📋 FRONTEND BUILD ORDER SUMMARY
# ═══════════════════════════════════════════════════

| Phase | Name | Key Deliverables |
|:---:|:---|:---|
| **1** | Foundation & Design System | Dependencies, Tailwind tokens, 14 UI primitives, API client, utilities |
| **2** | Auth & App Shell | Login page, auth context, protected routes, sidebar, header, notifications |
| **3** | Dashboard | KPI metro cards, sales chart, top products, stock/expiry alerts |
| **4** | Product Catalog | Products CRUD, variant management, categories tree, brands, barcode labels |
| **5** | Procurement | Suppliers CRUD, PO list/create/detail, GRN receiving modal |
| **6** | Shift Management | Open/close shift modals, petty cash, shift history, Z-Report |
| **7** | POS Terminal | Barcode scan, product grid, cart, split payments, hold/resume, lock, receipt, offline |
| **8** | CRM & Returns | Customer directory, Bakir Khata, sales history, invoice detail, returns modal |
| **9** | Finance | Inventory management, stock adjustment, expenses, financial accounts & ledger |
| **10** | Admin | User management, role permissions matrix, audit logs, shop settings |
| **11** | Reports | Report hub, 7 report types, charts, PDF/Excel/Print export |
| **12** | Production | Error boundaries, responsive verification, performance, deployment prep |

---

> **📝 NOTE:** Each phase should be fully tested before moving to the next. After completing each phase:
> 1. Run `npm run build` to ensure no TypeScript compilation errors
> 2. Manually test all new pages and components in the browser
> 3. Verify API integration works with the running backend server (`localhost:5000`)
> 4. Test responsive layout at desktop and tablet breakpoints
> 5. Ensure no console errors or warnings

---

> **🔗 Backend API Base URL:** `http://localhost:5000/api/v1`
> **🔗 Frontend Dev Server:** `http://localhost:3000`
> **📚 API Documentation:** [`api-spec.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/docs/api-spec.md)

---

*This document is the complete, step-by-step frontend build guide for the Enterprise Cloud-Based POS & Shop Management System. Follow the phases sequentially for the best development experience. The backend is already built — focus entirely on crafting a beautiful, fast, and functional frontend.*
