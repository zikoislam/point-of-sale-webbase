# POS সিস্টেম — সম্পূর্ণ ব্যবহার নির্দেশিকা (বাংলা)

> এই ডকুমেন্টে পুরো সিস্টেম কীভাবে কাজ করে, কোন রোল কী করতে পারবে, আর প্রতিটি মডিউল
> ধাপে ধাপে কীভাবে চালাতে হবে — সব লেখা আছে। নতুন কর্মীকে ট্রেনিং দেওয়ার জন্য
> শুরু থেকে শেষ পর্যন্ত পড়ানো যাবে।

---

## ১. সিস্টেম পরিচিতি

এটা একটা ক্লাউড-ভিত্তিক **POS + Shop Management সিস্টেম** — দোকানের ক্যাশ রেজিস্টার আর
খাতার জায়গা নেয়। মূল কাজগুলো:

| কাজ | কোথায় হয় |
|:---|:---|
| বিক্রি / বিল করা | POS Terminal (`/pos`) |
| স্টক দেখা ও ঠিক করা | Inventory |
| মাল কেনা (সাপ্লায়ার) | Purchase Orders + GRN |
| কাস্টমারের বাকি (ধার) | Customers → Bakir Khata |
| ক্যাশ হিসাব (শিফট) | Shifts + Z-Report |
| খরচ ও টাকা লেনদেন | Expenses + Accounts |
| ফেরত ও ভাউচার | Sales History → Return |
| রিপোর্ট | Reports |
| কে কী করেছে | Audit Logs |

**তিনটা আলাদা interface:**

- `/login` — সবার জন্য লগইন পেজ
- `(dashboard)` group — সাইডবার + হেডার সহ ম্যানেজমেন্ট প্যানেল
- `(pos)` group — ফুল-স্ক্রিন POS টার্মিনাল, সাইডবার নেই (ক্যাশিয়ারের জন্য)

---

## ২. রোল ও পারমিশন (কে কী করতে পারবে)

সিস্টেমে ৩টা সিস্টেম-রোল আছে। এগুলো মোছা যায় না (`isSystemRole: true`)।

### ২.১ SUPER_ADMIN — মালিক / অ্যাডমিন
**সব ৩৬টা পারমিশন।** সহজ কথায়: সব কিছু — Accounts, Users, Roles, Settings, Audit Logs।

### ২.২ BRANCH_MANAGER — দোকান ম্যানেজার
POS, inventory, procurement, sales, returns authorize, shifts, customers, expenses,
reports — সব অপারেশনাল কাজ। কিন্তু **নেই**: Accounts (`accounts:*`), Audit Logs (`audit:view`),
Settings (`settings:manage`), Users (`users:manage`), Roles manage (`roles:manage`)।
শুধু রোল **দেখতে** পারে (`roles:view`)।

### ২.৩ CASHIER — ক্যাশিয়ার (সবচেয়ে সীমিত)
মাত্র ৮টা পারমিশন:

```
pos:checkout, sales:view, shifts:operate, customers:view,
customers:create, customers:pay_due, expenses:create, inv:view
```

**ক্যাশিয়ার পারবে না:** পণ্য যোগ/এডিট, স্টক adjustment, cost price দেখা, রিপোর্ট,
ফেরত দেওয়া, অ্যাকাউন্ট, সেটিংস, ইউজার ম্যানেজমেন্ট।

### ২.৪ সাইডবারে মেনু দেখার নিয়ম

সাইডবার নিজেই পারমিশন দেখে মেনু লুকায়। তাই ক্যাশিয়ার লগইন করলে সে শুধু এই মেনুগুলোই দেখবে:

| মেনু | রুট | যে পারমিশন লাগে |
|:---|:---|:---|
| Dashboard | `/dashboard` | `reports:dashboard` |
| POS Terminal | `/pos` | `pos:checkout` |
| Products → সব | `/products` | `inv:view` |
| Products → Categories | `/categories` | `inv:view` |
| Products → Brands | `/brands` | `inv:view` |
| Products → Inventory | `/inventory` | `inv:view` |
| Products → Barcode Labels | `/barcode-labels` | `inv:labels` |
| Purchase Orders | `/purchase-orders` | `procurement:view` |
| Sales History | `/sales` | `sales:view` |
| Customers | `/customers` | `customers:view` |
| Suppliers | `/suppliers` | `procurement:view` |
| Shifts | `/shifts` | `shifts:operate` |
| Expenses | `/expenses` | `expenses:view` |
| Accounts | `/accounts` | `accounts:view` |
| Reports | `/reports` + sub | `reports:dashboard` |
| Users | `/users` | `users:manage` |
| Roles | `/roles` | `roles:view` |
| Audit Logs | `/audit-logs` | `audit:view` |
| Settings | `/settings` | `settings:manage` |

**ক্যাশিয়ার বাস্তবে দেখবে:** Dashboard নেই, POS Terminal, Products (দেখা), Inventory (দেখা),
Sales History, Customers, Shifts। ব্যস।

---

## ৩. সিস্টেম চালু করা

### ৩.১ Production (যেটা এখন live)

| | ঠিকানা |
|:---|:---|
| Frontend | https://point-of-sale-webbase.vercel.app |
| Backend API | https://pos-api-production-f0f5.up.railway.app |
| Database | MongoDB Atlas |

প্রথমবার লগইন: **`admin` / `Admin@123`** — তারপর সাথে সাথে পাসওয়ার্ড বদলে নাও।

### ৩.২ Local-এ চালানো (ডেভেলপমেন্টের জন্য)

দুইটা আলাদা টার্মিনাল লাগবে:

```bash
# টার্মিনাল ১ — Backend
cd backend
npm install
npm run dev          # http://localhost:5000

# টার্মিনাল ২ — Frontend
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Database-এ ডিফল্ট ডেটা বসাতে (শুধু প্রথমবার):

```bash
cd backend
npm run seed         # roles, admin, settings, accounts, expense categories, demo data
```

---

## ৪. লগইন, লগআউট ও টার্মিনাল লক

### ৪.১ লগইন করা
1. `/login` খোলো
2. **Username** দাও (ইমেইল না, username — যেমন `admin`)
3. **Password** দাও
4. চাইলে *Remember me* টিক দাও → ৩০ দিন session থাকবে (নাহলে ৮ ঘণ্টা)
5. **Sign in** চাপো

**ভেতরে কী হয়:** সার্ভার password bcrypt দিয়ে মেলায় → সফল হলে `pos_token` নামে একটা
**HTTP-only cookie** সেট করে। এই cookie টাই পরের সব request-এ পরিচয় প্রমাণ করে। সামনে
কখনো token হাতে নিয়ে ঘোরাঘুরি করতে হবে না।

### ৪.২ লগআউট
হেডারের প্রোফাইল মেনু → **Logout**। সার্ভার token-টা blacklist করে, তাই পুরনো cookie দিয়ে
আর ঢোকা যাবে না।

### ৪.৩ টার্মিনাল Lock (ক্যাশিয়ার দোকান ছেড়ে গেলে)
- **Ctrl + L** চাপো (বা POS-এ lock বাটন)
- স্ক্রিন লক হবে, নতুন করে **৪ ডিজিটের PIN** দিয়ে খুলতে হবে (ডিফল্ট admin PIN: `0000`)
- এটা পূর্ণ লগআউট না — দ্রুত লক, কাউন্টার ছেড়ে সামান্য দূরে যাওয়ার জন্য

---

## ৫. মডিউলভিত্তিক নির্দেশিকা (ধাপে ধাপে)

> **সাজানো ক্রম:** নতুন সেটআপে নিচের ক্রমেই কাজ করো — Settings → Roles/Users →
> Categories/Brands → Products → Accounts → Suppliers → Purchase Order → Shift → POS।

### ৫.১ Settings — সবার আগে এটা করো
**মেনু:** Settings → লাগে `settings:manage` (শুধু Admin)

এখানে দোকানের পরিচয় বসে, যা রিসিট ও রিপোর্টে ছাপা হয়।
1. Shop name, address, phone দাও
2. Logo upload করো (**Upload Image**)
3. Receipt footer লেখা দাও (যেমন "ধন্যবাদ, আবার আসবেন")
4. VAT/Tax ডিফল্ট, low-stock alert limit ঠিক করো
5. Save
6. Hardware অংশে printer width (58mm/80mm) বেছে নাও

> এটা আগে না করলে রিসিটে "POS RETAIL STORE" ডিফল্ট নামই আসবে।

### ৫.২ Users ও Roles
**Users** → লাগে `users:manage` (Admin) · **Roles** → `roles:view` / `roles:manage`

**নতুন কর্মী যোগ করা (সবচেয়ে দরকারি কাজ):**
1. Users → **Add User**
2. Username, Full Name, Phone, Email দাও
3. **Role** বেছে নাও (SUPER_ADMIN / BRANCH_MANAGER / CASHIER)
4. Password দাও
5. **PIN** দাও — ৪ ডিজিটের সংখ্যা (এটা দিয়েই সে POS লক খুলবে; পাশাপাশি ম্যানেজাররাও
   এই PIN দিয়ে discount/return/discrepancy approve করবেন)
6. Save

**পরে:** Edit দিয়ে role/password বদলানো যায়, **PIN** আলাদা করে বদলানো যায়।
**Delete** করলে আসলে soft-delete হয় (`isActive: false`) — হিসাবের রেকর্ড নষ্ট হয় না।

**Roles পেজ:** প্রতিটি রোলের পারমিশন তালিকা দেখা যায়; চাইলে নতুন কাস্টম রোল বানানো যায়।
সিস্টেম-রোল (৩টা) মোছা যায় না।

> ⚠️ **ম্যানেজার PIN ভুলে যাওয়া মানে ভয়ংকর** — discount override, sales return, আর shift
> discrepancy — তিনটাই ম্যানেজার PIN ছাড়া হবে না। অন্তত একজন ম্যানেজার/অ্যাডমিনের PIN
> সবসময় কাজ করছে কিনা নিশ্চিত থেকো।

### ৫.৩ Categories → Brands → Products
**লাগে:** দেখতে `inv:view`, বানাতে/বদলাতে `inv:manage`

**Categories:** পণ্যের শ্রেণি (যেমন খাবার, সাবান, কসমেটিক্স)।
1. Categories → **Add Category**
2. Name, Code দাও (Code ইউনিক হতে হবে)
3. চাইলে `defaultTaxRate` দাও
4. Parent Category বেছে নিলে সাব-ক্যাটাগরি হয় (গাছের মতো সাজানো যায়)
5. মোছার সময় সতর্কতা: ওই ক্যাটাগরিতে পণ্য থাকলে মুছবে না (`CATEGORY_HAS_DEPENDENTS`)

**Brands:** কোম্পানির নাম (যেমন Fresh, RFL)। Name দিয়ে Add/Edit। ইমেজও দেওয়া যায়।

**Products:** এখানেই আসল কাজ। একটা Product-এর ভেতরে একাধিক **Variant** থাকে
(যেমন "T-Shirt" প্রোডাক্ট, ভ্যারিয়েন্ট: L / M / XL)।
1. Products → **Add Product**
2. নাম, Category, Brand, Unit (Pcs / Kg / Ltr / Box / Meter / Goj ইত্যাদি) দাও
3. **Tax Type** বেছে নাও — INCLUSIVE / EXCLUSIVE / EXEMPT
4. এক বা একাধিক **Variant** যোগ করো। প্রতিটিতে:
   - Attribute name (L / M / XL / ৫০০গ্রাম)
   - **SKU** (ইউনিক কোড — ডুপ্লিকেট হলে `DUPLICATE_SKU`)
   - **Barcode** (স্ক্যানার যে কোড পড়বে, ইউনিক — ডুপ্লিকেট হলে `DUPLICATE_BARCODE`)
   - **Retail price** (খুচরা MRP) ও **Wholesale price** (পাইকারি)
   - **Cost price** (কেনা দাম — এটাই profit হিসাব ও wastage valuation-এ লেগে যায়)
   - Opening stock
   - Expiry date (থাকলে — FEFO সতর্কতা এটার উপর চলে)
5. Product Image upload করো
6. Save

> **ক্যাশিয়ার কখনো cost price দেখতে পায় না** — সার্ভারই তার response থেকে বাদ দিয়ে দেয়।

### ৫.৪ Barcode Labels
**লাগে:** `inv:labels`

নতুন পণ্যের গায়ে স্টিকার লাগাতে:
1. Products থেকে পণ্য বেছে নাও (বা Barcode Labels পেজে যাও)
2. যেসব variant-এর স্টিকার লাগবে টিক দাও
3. কত কপি লাগবে দাও
4. Label size বেছে নাও (ডিফল্ট **38mm × 25mm, 2-up**)
5. **Print** — স্টিকারে থাকবে: বারকোড, পণ্যের নাম, ভ্যারিয়েন্ট, দাম, দোকানের নাম
6. প্রিন্টারে পাঠাও (সাধারণ প্রিন্টার বা বারকোড লেবেল প্রিন্টার)

### ৫.৫ Inventory ও Stock Adjustment
**মেনু:** Products → Inventory · দেখা `inv:view`, বদলানো `inv:adjust`

Inventory পেজে প্রতি product-এর প্রতি variant-এর **current stock**, alert limit, expiry দেখা যায়।
লাল/কম স্টকে থাকলে low-stock চিহ্ন দেখাবে।

**স্টক ঠিক করা — দুই ধরনের:**

**(ক) Manual Adjustment** (গোনার সময় মিলল না, নতুন স্টক এলো, ভুল সংশোধন)
1. variant পাশে **Adjust** চাপো
2. নতুন quantity বা +/− পরিমাণ দাও
3. কারণ লেখো
4. Save → StockMovement-এ `ADJUSTMENT` হিসেবে রেকর্ড হবে

**(খ) Wastage Write-off** (মেয়াদ শেষ / ভেঙে গেছে / নষ্ট)
1. variant → **Wastage / Write-off**
2. পরিমাণ ও কারণ দাও (যেমন "মেয়াদ শেষ")
3. Save

**Wastage করলে সিস্টেম একসাথে ৬টা কাজ করে (একটাই transaction-এর ভেতরে):**
1. স্টক কমায়
2. `WASTAGE` StockMovement লেখে
3. "Inventory Shrinkage & Loss" খরচের খাত তৈরি/খুঁজে বের করে
4. খরচ বুক করে — **পরিমাণ = quantity × costPrice**
5. Cash অ্যাকাউন্ট থেকে টাকা কমায়
6. Account ledger-এ `DEBIT` entry লেখে

কোনো ধাপ ব্যর্থ হলে পুরোটা বাতিল — অর্ধেক হিসাব হবে না।

### ৫.৬ Suppliers
**লাগে:** দেখা `procurement:view`, বানানো `procurement:manage`, টাকা দেওয়া `procurement:pay`

1. Suppliers → **Add Supplier** — Company name, contact person, phone, address, opening balance
2. Suppliers তালিকায় প্রতিটি সাপ্লায়ারের **payable balance** (আমরা তাকে কত দেব) দেখা যায়
3. **Ledger** পেজে প্রতিটি লেনদেন: কখন মাল এসেছে (`PO_GRN_BILL`) আর কখন টাকা দিয়েছি
   (`PAYMENT_DISBURSAL`)
4. **Payment** দিতে → supplier → **Pay** → পরিমাণ + যে account থেকে দিচ্ছি বেছে নাও
   → এতে account balance কমবে ও supplier ledger-এ payment লেখা হবে

### ৫.৭ Purchase Order → GRN (মাল রিসিভ) — WAC হিসাব
**লাগে:** দেখা `procurement:view`, বানানো `procurement:manage`, রিসিভ `procurement:receive`

**PO বানানো:**
1. Purchase Orders → **New PO**
2. Supplier বেছে নাও
3. লাইনে লাইন যোগ করো: product + variant, quantity, **unit cost** (এই দামেই কেনা হচ্ছে)
4. PO number নিজে থেকে হবে — ফরম্যাট `PO-YYYYMMDD-0001`
5. Save → status থাকবে **DRAFT**

**PO-এর status:** `DRAFT` → `ORDERED` → `PARTIAL` → `RECEIVED` (বা `CANCELLED`)
> DRAFT ছাড়া অন্য অবস্থায় PO এডিট করা যায় না।

**মাল হাতে পেলে (GRN):**
1. PO খোলো → **Receive (GRN)**
2. প্রতিটি লাইনে **এবার কতটুকু এসেছে** লিখো (আংশিক এলে কম দাও → status `PARTIAL`)
3. Expiry date দাও (থাকলে — FEFO ট্র্যাকিংয়ের জন্য batch-এ জমা হবে)
4. Confirm

**সিস্টেম তখনই যা করে:** প্রতিটি লাইনে নতুন **Weighted Average Cost (WAC)** বের করে:

```
নতুন WAC = (আগের স্টক × আগের cost) + (এবারের qty × এবারের cost)
           ──────────────────────────────────────────────────────
                        আগের স্টক + এবারের qty
```

স্টক বাড়ে, cost price নতুন WAC-এ আপডেট হয়, supplier ledger-এ বিল ওঠে, আর stock movement
`IN` হিসেবে লেখা হয়। বেশির বেশি রিসিভ করলে `PARTIAL_RECEIVING_OVERFLOW` error আসবে।

### ৫.৮ Accounts (ক্যাশ / ব্যাংক / MFS)
**লাগে:** দেখা `accounts:view`, বানানো/বদলানো `accounts:manage`, ট্রান্সফার `accounts:transfer`
**শুধু Admin** এই মেনু দেখে।

1. Accounts → **Add Account** → নাম, ধরন (CASH / BANK / MFS), opening balance
2. তালিকায় প্রতিটির **current balance** দেখা যায় (POS বিক্রি, খরচ, পেমেন্ট — সব এখানে এসে পড়ে)
3. একটা account-এর **Transactions** দেখলে প্রতিটি credit/debit, balance before/after সহ ইতিহাস
4. **Transfer** — এক account থেকে আরেকটাতে টাকা নেওয়া (যেমন ক্যাশ থেকে ব্যাংকে জমা)
   → দুই দিকেই entry হবে (double-entry), একটাতে debit, অন্যটাতে credit
   → ব্যালেন্স কম থাকলে `ACCOUNT_INSUFFICIENT_FUNDS`

### ৫.৯ Expenses (দোকানের খরচ)
**লাগে:** দেখা `expenses:view`, লেখা `expenses:create`, খরচের খাত `expenses:manage`

**খরচের খাত আগে:**
1. Expenses → **Categories** → Add (যেমন বিদ্যুৎ বিল, দোকান ভাড়া, যাতায়াত, Inventory Shrinkage & Loss)

**খরচ লেখা (ক্যাশিয়ারও করতে পারে — `expenses:create` আছে):**
1. Expenses → **Add Expense**
2. খাত বেছে নাও, পরিমাণ, তারিখ, বিবরণ
3. **কোন account থেকে** টাকা গেল বেছে নাও
4. রিসিটের স্ক্যান থাকলে upload করো
5. Save → account থেকে টাকা কমবে + ledger-এ `EXPENSE` debit লেখা হবে

> দিনের ক্যাশ খরচ শিফট ক্লোজিংয়ের হিসাবেও ধরা হয়, তাই প্রতিটা খরচ ঠিকভাবে লেখা জরুরি।

### ৫.১০ Shift (ক্যাশ রেজিস্টার) — দিনের শুরু ও শেষ
**লাগে:** `shifts:operate`

**দিনের শুরুতে — শিফট ওপেন:**
1. Shifts → **Open Shift** (বা POS খুললে নিজেই চাইবে)
2. **Opening Float** দাও — ড্রয়ারে শুরুতে কত টাকা আছে
3. Terminal ID (ডিফল্ট `COUNTER-01`)
4. Open

> **একই সাথে দুইটা শিফট ওপেন করা যাবে না** (`SHIFT_ALREADY_OPEN`)। শিফট না খুলে বিক্রি করা
> যাবে না — POS checkout-এ `SHIFT_NOT_ACTIVE` error আসবে।

**দিনের মাঝখানে — Petty Cash:**
শিফট থেকে টাকা বের করা বা ঢোকানো (যেমন চা-বিস্কুট খরচ, বা ম্যানেজার টাকা দিলেন):
1. Shifts → **Petty Cash**
2. Type = **IN** (ঢুকল) বা **OUT** (বেরোল), পরিমাণ, কারণ

**দিনের শেষে — শিফট ক্লোজ (Blind Count):**
1. Shifts → **Close Shift**
2. **ড্রয়ারে হাতে গুনে যত টাকা আছে সেটা লিখো** (`actualCash`) — সিস্টেম আগে expected
   দেখাবে না, তাই এটা নিরপেক্ষ গোনা
3. সিস্টেম হিসাব করবে:

```
Expected Cash = Opening Float
              + Cash Sales
              + Petty Cash In
              - Cash Expenses
              - Petty Cash Out

Discrepancy = Actual Cash − Expected Cash
```

4. **Discrepancy ৳10-এর কম হলে** শিফট সরাসরি ক্লোজ হয়ে যাবে
5. **৳10-এর বেশি হলে ম্যানেজার PIN লাগবে** — নাহলে `DISCREPANCY_REQUIRES_APPROVAL`
   error; PIN দিলে ম্যানেজারের ID রেকর্ড হবে, audit log-এ `SHIFT_DISCREPANCY` লেখা হবে,
   আর Admin/Manager-দের কাছে real-time alert যাবে

**Z-Report:** Shifts → যেকোনো শিফট → **Z-Report** — এতে থাকবে মোট বিক্রি সংখ্যা,
gross sales, tax, discount, **payment method অনুযায়ী ভাগ** (Cash/Card/bKash/Nagad/Store
Credit/Customer Due), opening float, expected vs actual cash, discrepancy। এটা প্রিন্ট/PDF করা যায়।

### ৫.১১ POS Checkout — মূল বিক্রির কাজ
**লাগে:** `pos:checkout`

**(০) আগে শিফট খোলা থাকতে হবে** — নাহলে কিছুই হবে না।

**(১) বিল শুরু:**
1. `/pos` খোলো (ফুল-স্ক্রিন, সাইডবার নেই)
2. কার্সর এমনিতেই বারকোড ইনপুটে থাকে (না থাকলে **F2**)

**(২) পণ্য তোলা — ৩ ভাবে:**
- **বারকোড স্ক্যানার:** স্ক্যান করো, স্ক্যানার নিজেই Enter পাঠাবে → কার্টে যোগ হয়ে যাবে
- **হাতে কোড লিখে:** বারকোড লিখে Enter
- **সার্চ/গ্রিড:** নাম লিখো (debounce সহ সার্চ), বা ক্যাটাগরি ধরে গ্রিড থেকে ক্লিক করো

> স্টক কম থাকলে যোগ করার সময়ই সতর্কতা/বাধা আসবে।

**(৩) গ্রাহক ধরন ঠিক করা — দাম এর উপর নির্ভর করে:**
- **RETAIL** (ডিফল্ট) → retail price, খুচরা ক্রেতা বা walk-in
- **WHOLESALE** → wholesale price (গ্রাহক wholesale টাইপ হলে নিজেই সেট হয়)

> দাম সার্ভারই ঠিক করে, ক্লায়েন্টের পাঠানো দাম বিশ্বাস করা হয় না।

**(৪) গ্রাহক যোগ করা:**
- **F8** চাপো → গ্রাহক বেছে নাও বা নতুন বানাও
- গ্রাহক না দিলে বিল walk-in হিসেবে হবে (বাকি দেওয়া যাবে না)

**(৫) cart ঠিক করা:**
- **+/−** দিয়ে quantity বদলাও
- **×** দিয়ে লাইন বাদ দাও
- লাইন-লেভেল discount বা নিচে **overall discount** দাও

**(৬) কার্ট হোল্ড করা (গ্রাহক টাকা আনতে গেল):**
- **F4** → কার্ট পার্ক হবে (label দিতে পারো)
- **Shift + F4** → পার্ক করা কার্টের তালিকা, বেছে নিলে ফিরে আসবে
- পার্ক করা কার্ট **২৪ ঘণ্টা** পর নিজে থেকেই মুছে যায়

**(৭) পেমেন্ট — F9:**
1. **F9** চাপো → Payment modal
2. টাকার হিসাব: Subtotal → Tax → Discount → **Grand Total**
3. **Split payment করা যায়** — একাধিক মাধ্যমে ভাগ করে:
   | মাধ্যম | মানে |
   |:---|:---|
   | CASH | নগদ (change ফেরত লিখতে হবে) |
   | CARD | কার্ড |
   | MFS_BKASH | বিকাশ |
   | MFS_NAGAD | নগদ |
   | STORE_CREDIT | আগের ফেরতের ভাউচার (কোড লাগবে) |
   | CUSTOMER_DUE | বাকি (Bakir Khata-তে ওঠবে) |
4. নগদ দিলে **change** লিখো
5. **Confirm (Enter)** চাপো

**(৮) বিল হওয়ার সময় ভেতরে কী ঘটে — সব একটাই ACID transaction-এ:**
1. ইনভয়েস নম্বর তৈরি হয় (`INV-YYYYMMDD-00001`)
2. প্রতিটা পণ্যের স্টক কমে (স্টক কম থাকলে `INSUFFICIENT_INVENTORY`)
3. StockMovement `OUT` লেখা হয়
4. Sale ডকুমেন্ট তৈরি হয় — **পণ্যের নাম, SKU, দাম, cost, tax সব snapshot হয়ে জমা হয়**
   (পরে দাম বদলালেও পুরনো বিল বদলাবে না)
5. তendered টাকা অ্যাকাউন্টে যোগ হয় + ledger entry
6. নগদ হলে শিফটের cash total বাড়ে
7. বাকি থাকলে → কাস্টমারের due বাড়ে, credit limit চেক হয়
   (`CREDIT_LIMIT_EXCEEDED` হলে বিল আটকে যাবে), ledger-এ `SALE_DUE` লেখা হয়
8. Store credit দিলে ভাউচারের balance কমে, শেষ হলে status `EXHAUSTED`
9. কোনো একটা ধাপ ফেল করলে **পুরো বিল বাতিল** — অর্ধেক স্টক কাটা থাকবে না

**(৯) ডুপ্লিকেট বিল বন্ধ:** প্রতিটা checkout-এ একটা `Idempotency-Key` যায়। একই key
আবার এলে নতুন বিল হয় না, আগেরটাই ফেরত আসে।

**(১০) রিসিট:** বিল শেষে receipts modal আসে →
- **Print** → থার্মাল প্রিন্টার রিসিট
- **Cash drawer** খুলবে (ক্যাশ হলে)
- রিসিটে: দোকানের নাম/ঠিকানা, ইনভয়েস নম্বর, তারিখ, ক্যাশিয়ার, গ্রাহক, পণ্যের লিস্ট,
  Subtotal/Tax/Discount/Grand Total, পেমেন্ট ভাঙ্গন, ফেরত, footer লেখা

> পরে আবার প্রিন্ট দরকার হলে: **Sales History → বিল খোলো → Reprint**

**(১১) ইন্টারনেট না থাকলে (Offline):**
- বিল লোকালি **IndexedDB-তে জমা** হবে, কার্ট হারাবে না
- ক্যাশিয়ার দেখতে পাবে কতগুলো বিল pending আছে
- ইন্টারনেট ফিরলে নিজেই sync হবে
- Offline-এ স্টকের চেক শিথিল — তাই স্টক মাইনাসেও বিক্রি হতে পারে; সেক্ষেত্রে
  `OFFLINE_OVERSELL` audit log হবে আর ম্যানেজারদের alert যাবে

### ৫.১২ Customers ও Bakir Khata (বাকির খাতা)
**লাগে:** দেখা `customers:view`, বানানো `customers:create`, এডিট `customers:manage`,
টাকা আদায় `customers:pay_due`

**নতুন কাস্টমার:**
1. Customers → **Add Customer** (অথবা POS-এ **F8** → New)
2. নাম, **ফোন** (ইউনিক — ডুপ্লিকেট হলে `CUSTOMER_PHONE_DUPLICATE`), ঠিকানা
3. **Customer Type** — RETAIL বা WHOLESALE (wholesale হলে POS-এ দাম কম পড়বে)
4. **Credit Limit** — সর্বোচ্চ কত বাকি চড়ানো যাবে
5. Save

**বাকিতে বিক্রি:** POS-এ গ্রাহক বেছে নিয়ে পেমেন্টে `CUSTOMER_DUE` দাও → দরকার হলে
POS-ই সতর্ক করবে যদি due limit-এর ৯০% ছুঁয়ে ফেলে; limit ছাড়ালে বিল হবে না।

**বাকি আদায় (Pay Due):**
1. Customers → গ্রাহক → **Pay Due**
2. পরিমাণ + **যে account-এ টাকা এলো** বেছে নাও
3. Save → কাস্টমারের due কমবে, account balance বাড়বে, ledger-এ `PAYMENT_COLLECTION` লেখা হবে,
   আর ক্যাশ হলে শিফটের cash total-এ যোগ হবে

**Ledger (Bakir Khata):** Customers → গ্রাহক → **Ledger** — প্রতিটা অর্ডার ও পেমেন্ট
তারিখ অনুযায়ী, balance before/after সহ। এই পেজটাই গ্রাহকের সাথে ঝগড়া মেটানোর প্রমাণ।

### ৫.১৩ Sales History ও Receipt
**লাগে:** `sales:view`

1. Sales → তারিখ/ক্যাশিয়ার/গ্রাহক/শিফট ধরে ফিল্টার
2. যেকোনো বিলে ক্লিক → পুরো ইনভয়েস: পণ্য, পেমেন্ট ভাঙ্গন, গ্রাহক, ক্যাশিয়ার
3. **Reprint Receipt** দিয়ে রিসিট আবার ছাপানো/দেখা
4. এই পেজ থেকেই **Return** শুরু করা যায়

### ৫.১৪ Sales Return (ফেরত) ও Store Credit Voucher
**লাগে:** `returns:authorize` (শুধু Manager/Admin) **এবং ম্যানেজার PIN**

**ফেরত দেওয়ার নিয়ম:**
1. Sales → বিল খোলো → **Return**
2. **কত পিস ফেরত আসছে** লেখো — বিলে যত ছিল তার বেশি লেখা যাবে না
   (নাহলে `PROPORTIONAL_REFUND_ERROR`)
3. প্রতিটা লাইনে **isResaleable** ঠিক করো:
   - **হ্যাঁ (আবার বিক্রি হবে)** → স্টকে ফেরত যাবে (StockMovement `RETURN`)
   - **না (নষ্ট/খোলা)** → wastage হিসেবে খরচে যাবে
4. **Refund Type** বেছে নাও:
   - **CASH** → ক্যাশ থেকে টাকা ফেরত (account কমবে, শিফটের cash কমবে)
   - **STORE CREDIT** → ভাউচার (গ্রাহক থাকা বাধ্যতামূলক)
   - **CARD_REVERSAL**
5. কারণ লেখো
6. **ম্যানেজার PIN** দাও — এটা ছাড়া ফেরত হবে না
7. Confirm

**ফেরতের হিসাব (বিল-লেভেল discount ন্যায্যভাবে ভাগ হয়):**
```
ঐ লাইনের ফেরত = (unit price × ফেরত qty ÷ subtotal) × (total − discount)
```
মানে পুরো বিলে discount থাকলে ফেরতের সময়ও সেই অনুপাতে কম টাকা ফেরত আসে — সরাসরি MRP নয়।

**সিস্টেম একসাথে যেসব করে (একটাই transaction):**
- ম্যানেজার PIN যাচাই
- রিসেলেবল হলে স্টক বাড়ে, নাহলে ছিল খরচ + account debit
- নগদ ফেরত হলে account ও শিফট ক্যাশ কমে
- Return নম্বর তৈরি (`RET-YYYYMMDD-0001`)
- Store credit হলে ভাউচার তৈরি
- audit log লেখা

**Store Credit Voucher:**
- কোডের ফরম্যাট: **`CR-XXXX-XXXX`** (যেমন `CR-9821-X47A`)
- মেয়াদ: **১ বছর**
- POS-এ পেমেন্টের সময় method `STORE_CREDIT` দিয়ে কোড দিলে ব্যালেন্স কমবে
- ব্যালেন্স শূন্য হলে status `EXHAUSTED`; মেয়াদ শেষে `EXPIRED`
- মেয়াদোত্তীর্ণ/খালি ভাউচার দিলে `VOUCHER_EXHAUSTED_OR_EXPIRED`

### ৫.১৫ Reports (রিপোর্ট)
**লাগে:** `reports:dashboard` (সব রিপোর্টের জন্য)

**Dashboard** (`/dashboard`) — এক নজরে KPI: আজকের বিক্রি, লাভ, কাস্টমার বাকি, কম স্টক ইত্যাদি।
দ্রুত খোলার জন্য এটা আগে থেকেই হিসাব করা ডেটা (daily summary) থেকে পড়ে।

**Reports Hub** (`/reports`) — ৬টা ট্যাব:

| ট্যাব | কী দেখায় |
|:---|:---|
| Sales Summary | মেয়াদ অনুযায়ী বিক্রি, ক্যাশিয়ারভিত্তিক, ক্যাটাগরিভিত্তিক, retail vs wholesale |
| Product Performance | কোন পণ্য বেশি বিক্রি হচ্ছে, কোনটা হচ্ছে না |
| Stock Valuation | বর্তমান স্টকের মূল্য (cost ও selling দুই দিক থেকে) |
| Profit & Loss (P&L) | বিক্রি − COGS − খরচ = লাভ/লোকসান |
| Customer Dues | কে কত বাকি, কত দিন পুরনো (aging) |
| Supplier Payables | কাকে কত দিতে হবে, aging সহ |

প্রতিটা রিপোর্টে তারিখের সীমা বেছে নেওয়া যায় এবং **Excel/PDF export** করা যায়।

### ৫.১৬ Audit Logs
**লাগে:** `audit:view` (শুধু Admin)

কে, কখন, কী বদলেছে — এন্ট্রি বদলানো বা মোছা যায় না (append-only)। এখানে বিশেষভাবে
দেখা যায়: `PRICE_OVERRIDE` (কে discount approve করল), `SHIFT_DISCREPANCY`,
`OFFLINE_OVERSELL`, আর পণ্য/ইউজার/অ্যাকাউন্টের সব পরিবর্তন (before/after সহ)।

### ৫.১৭ Real-time Alert (Socket.io)

ক্যাশিয়ার এই alert পায় না — শুধু Admin ও Manager।

| Alert | কখন আসে |
|:---|:---|
| `LOW_STOCK_ALERT` | বিক্রির পর স্টক alert limit-এ নামলে, বা সকালের expiry scan-এ |
| `SHIFT_DISCREPANCY_ALERT` | শিফট ক্লোজে ৳10-এর বেশি গরমিল হলে |
| `OFFLINE_OVERSELL_ALERT` | Offline sync-এ স্টক মাইনাস হয়ে গেলে |

**Background job (নিজে নিজে চলে):**
- রাত ১২:০৫ — আগের দিনের বিক্রির সারসংক্ষেপ জমা করে (dashboard দ্রুত রাখার জন্য)
- প্রতি ঘণ্টায় — মেয়াদোত্তীর্ণ পার্ক করা কার্ট পরিষ্কার
- সকাল ৭:০০ — মেয়াদ শেষের দিকে যাওয়া পণ্যের (FEFO) স্ক্যান ও alert

---

## ৬. দৈনিক কাজের রুটিন (রোল অনুযায়ী)

### ৬.১ ক্যাশিয়ার — সকাল থেকে রাত
1. লগইন করো → **শিফট ওপেন** করো, ড্রয়ারের শুরু টাকা লিখো
2. POS-এ কাজ: স্ক্যান → কার্ট → **F9** → পেমেন্ট → রিসিট
3. গ্রাহক বাকি চাইলে: **F8** দিয়ে গ্রাহক বেছে নাও → `CUSTOMER_DUE`
4. দুপুরে খরচ হলে: Shifts → **Petty Cash OUT**
5. কাউন্টার ছাড়লে: **Ctrl + L** দিয়ে লক
6. দিন শেষে: ড্রয়ারের টাকা গুনে **শিফট ক্লোজ** → গরমিল থাকলে ম্যানেজার ডাকো
7. Z-Report দেখে নাও, প্রিন্ট করে রাখো

### ৬.২ ম্যানেজার — দিনের কাজ
1. সকালে: low-stock ও মেয়াদোত্তীর্ণ alert দেখো
2. দরকার হলে **Purchase Order** বানাও, মাল এলে **GRN** দিয়ে রিসিভ করো
3. ক্যাশিয়ারের discount (>10%) ম্যানেজার PIN দিয়ে approve করো
4. ফেরত (Return) ম্যানেজার PIN দিয়ে authorize করো
5. শিফটে গরমিল >৳10 হলে PIN দিয়ে approve করো
6. নষ্ট মাল **Wastage** দিয়ে স্টক থেকে বাদ দাও
7. Reports দেখে রোজকার হিসাব মিলাও

### ৬.৩ Admin (মালিক) — সাপ্তাহিক/মাসিক
1. নতুন কর্মী যোগ করো, role ঠিক করো, PIN সেট করো
2. Shop settings, logo, receipt footer ঠিক রাখো
3. Accounts-এর balance মিলাও, দরকার হলে ব্যাংকে টাকা ট্রান্সফার করো
4. P&L আর Stock Valuation রিপোর্ট দেখো
5. **Audit Logs** দেখে price override / discrepancy আছে কিনা খেয়াল করো
6. পাসওয়ার্ড ও PIN নিয়মিত বদলাও

---

## ৭. Keyboard Shortcuts (POS Terminal)

| কী | কাজ |
|:---|:---|
| **F2** | বারকোড ইনপুটে কার্সর আনা |
| **F4** | বর্তমান কার্ট হোল্ড (পার্ক) করা |
| **Shift + F4** | পার্ক করা কার্টের তালিকা খোলা |
| **F8** | গ্রাহক সিলেক্টর খোলা |
| **F9** | পেমেন্ট (চেকআউট) মডাল খোলা |
| **Enter** | পেমেন্ট মডাল খোলা থাকলে পেমেন্ট কনফার্ম |
| **Ctrl + L** | টার্মিনাল লক করা |
| **Escape** | খোলা মডাল বন্ধ করা / সার্চ পরিষ্কার |

---

## ৮. গুরুত্বপূর্ণ Business Rules (মনে রাখার মতো)

1. **ট্যাক্স** — INCLUSIVE হলে দামের ভেতরেই ধরা; EXCLUSIVE হলে দামের উপর যোগ হয়; EXEMPT হলে নেই
2. **দাম** — wholesale গ্রাহকের জন্য wholesale price, নাহলে retail। দাম সবসময় সার্ভার ঠিক করে
3. **Snapshot** — বিলের পণ্যের নাম, দাম, cost, ট্যাক্স সব বিলের মুহূর্তেই জমা হয়; পরে বদলালে পুরনো বিল বদলায় না
4. **Discount override** — ০–১০% ক্যাশিয়ার নিজেই; **১১–৫০% ম্যানেজার PIN**; **>৫০% অ্যাডমিন পাসওয়ার্ড**; প্রতিটা override audit log-এ যায়
5. **Credit limit** — `বর্তমান বাকি + নতুন বাকি > credit limit` হলে বিল হবে না
6. **স্টক** — live বিক্রিতে স্টকের চেয়ে বেশি বিক্রি হবে না; offline sync-এ ছাড় আছে (alert সহ)
7. **ACID transaction** — checkout, wastage, return, fund transfer, supplier payment — সবই all-or-nothing
8. **ক্যাশিয়ার isolation** — cost price, profit, account balance ক্যাশিয়ার কখনো দেখবে না
9. **Role-based menu** — সাইডবার নিজে থেকেই পারমিশন অনুযায়ী লুকায়
10. **Audit** — গুরুত্বপূর্ণ সব কাজের রেকর্ড, কেউ বদলাতে পারে না

---

## ৯. সাধারণ Error ও তার মানে

| Error code | মানে | কী করবে |
|:---|:---|:---|
| `AUTH_CREDENTIALS_INVALID` | ইউজারনেম/পাসওয়ার্ড ভুল | আবার চেষ্টা করো |
| `TOKEN_EXPIRED` | session শেষ | আবার লগইন করো |
| `PERMISSION_DENIED` | তোমার রোলে এই কাজ নেই | ম্যানেজার/অ্যাডমিনকে বলো |
| `TERMINAL_LOCKED` | টার্মিনাল লক | PIN দাও |
| `PIN_INVALID` | PIN ভুল | ঠিক PIN দাও |
| `RATE_LIMIT_EXCEEDED` | ১ মিনিটে ৫ বার ভুল লগইন | ১ মিনিট অপেক্ষা করো |
| `SHIFT_NOT_ACTIVE` | শিফট খোলা নেই | আগে শিফট ওপেন করো |
| `SHIFT_ALREADY_OPEN` | আগেই শিফট খোলা আছে | আগেরটা ক্লোজ করো |
| `INSUFFICIENT_INVENTORY` | স্টক কম | স্টক অ্যাডজাস্ট করো বা PO করো |
| `CREDIT_LIMIT_EXCEEDED` | বাকির সীমা শেষ | বাকি আদায় করো বা limit বাড়াও |
| `DUPLICATE_SKU` / `DUPLICATE_BARCODE` | কোড আগেই আছে | অন্য কোড দাও |
| `CATEGORY_HAS_DEPENDENTS` | ক্যাটাগরিতে পণ্য আছে | আগে পণ্য সরাও |
| `VOUCHER_EXHAUSTED_OR_EXPIRED` | ভাউচার খালি/মেয়াদোত্তীর্ণ | অন্য মাধ্যমে পেমেন্ট |
| `DISCOUNT_REQUIRES_MANAGER_PIN` | বড় discount-এ অনুমোদন লাগবে | ম্যানেজার PIN দাও |
| `DISCREPANCY_REQUIRES_APPROVAL` | শিফটে ৳10+ গরমিল | ম্যানেজার PIN দাও |
| `PROPORTIONAL_REFUND_ERROR` | বিলের চেয়ে বেশি ফেরত | পরিমাণ ঠিক করো |
| `ACCOUNT_INSUFFICIENT_FUNDS` | অ্যাকাউন্টে টাকা কম | অন্য অ্যাকাউন্ট বা আগে টাকা ঢালো |
| `IDEMPOTENCY_KEY_REPLAY` | একই বিল দুবার পাঠানো হয়েছে | চিন্তার কারণ নেই, আগেরটাই ফিরবে |
| `PARTIAL_RECEIVING_OVERFLOW` | অর্ডারের চেয়ে বেশি রিসিভ | পরিমাণ ঠিক করো |
| `TRANSACTION_ABORTED_CONCURRENCY` | একসাথে দুইজনের লেখায় সংঘর্ষ | আবার চেষ্টা করো |

---

## ১০. Troubleshooting

**পেজ খুলছে না / সাদা স্ক্রিন**
→ Backend চলছে কিনা দেখো: ব্রাউজারে `.../api/v1/health` খোলো। `{"success":true}` এলে backend ঠিক।

**লগইন হচ্ছে না**
→ Username (ইমেইল নয়) দিচ্ছো কিনা দেখো। ৫ বার ভুল হলে ১ মিনিট অপেক্ষা করো।

**লগইনের পর 바로 লগআউট হয়ে যাচ্ছে**
→ Frontend আর Backend আলাদা ডোমেইনে হলে cookie cross-site যেতে হয়
(`SameSite=None; Secure`)। Production-এ এটা ঠিক করা আছে — localhost-এ `Lax` ব্যবহার হয়।

**বিল করতে গিয়ে "No active shift"**
→ Shifts → Open Shift করো।

**রিসিট প্রিন্টার কাজ করছে না**
→ Settings-এ paper width (58mm/80mm) ঠিক আছে কিনা দেখো, প্রিন্টার ডিফল্ট হিসেবে সেট আছে কিনা দেখো।

**স্টক ভুল দেখাচ্ছে**
→ Inventory → ওই variant-এ **Adjust** দিয়ে আসল সংখ্যা বসাও, কারণ লেখো। এতে সব কিছু
(রিপোর্ট, valuation) আবার মিলে যাবে।

**Description/নোট বদলানো যাচ্ছে না**
→ কিছু রেকর্ড (audit log, snapshot করা বিল) ইচ্ছে করেই অপরিবর্তনীয়।

---

## ১১. ভবিষ্যতে যা ঠিক করা দরকার (জানা সমস্যা)

1. **সাইডবারের রিপোর্ট সাব-মেনু:** `/reports/sales`, `/reports/inventory`, `/reports/pnl`,
   `/reports/customer-aging`, `/reports/supplier-payable`, `/reports/purchases`,
   `/reports/wastage` — এই পেজগুলো এখনো তৈরি হয়নি। সব রিপোর্ট আপাতত `/reports` হাবের
   ট্যাবে আছে। তাই সাব-মেনুতে ক্লিক করলে 404 আসবে — হয় পেজগুলো বানাতে হবে, নাহয়
   সাব-মেনু সরিয়ে শুধু `/reports` রাখতে হবে।
2. **Uploads স্থায়ী করা:** Railway-তে volume যুক্ত করা হয়েছে, কিন্তু DB-তে পুরনো কিছু
   ছবির URL এখনো `http://localhost:5000/...` হিসেবে জমা আছে — প্রোফাইল থেকে নতুন করে
   আপলোড করলে ঠিক হয়ে যাবে।
3. **Railway config:** `railway.json` (Config as Code) ২০২৬-১২-০১-এর পর কাজ করবে না —
   ভবিষ্যতে `.railway/railway.ts`-এ migrate করতে হবে।
4. **প্রথম লগইনে পাসওয়ার্ড বদল:** ডিফল্ট `admin / Admin@123` — উৎপাদনে ব্যবহারের আগে
   অবশ্যই বদলাও, আর সব কর্মীর PIN আলাদা করে দাও।
