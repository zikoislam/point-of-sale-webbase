# আলাদা দোকানের ডেটা আলাদা রাখা (Shop Data Isolation) — BDBBC POS

## মূল কথা (এটা মাথায় রাখুন)
- **`.exe` বা Machine ID ডেটা আলাদা করে না** — Machine ID শুধু **লাইসেন্স** একটা PC-তে বাঁধে।
- ডেটা আলাদা হয় মাত্র দুইভাবে:
  - **(ক)** প্রতিটা PC-র **নিজের লোকাল ডেটাবেস**, অথবা
  - **(খ)** এক ডেটাবেসে **প্রতি দোকান = আলাদা Organization** (`orgId` দিয়ে আলাদা)।
- **সবচেয়ে বড় ফাঁদ:** `standard` build (`npm run dist`) আপনার `backend/.env`-এর **Atlas/cloud URI** কে `cloudMongoUri` হিসেবে বেক করে এবং `syncEnabled: true` রাখে। ফলে দুই PC একই cloud DB-তে **sync** করে → **কাস্টমার/স্টক মিশে যায়**। আপনার ঘটনাটা এটাই।

## তিনটা মডেল — কোনটা কখন

### মডেল A — প্রতি দোকানে আলাদা Offline exe ✅ (recommended, সবচেয়ে সহজ)
- build: `npm run dist:offline` → ভিতরে `edition: offline`, `mongoMode: bundled`, `cloudMongoUri: ''`
- প্রতিটা PC নিজের mongod চালায় (`%APPDATA%\BDBBC POS\db`) → **১০০% আলাদা**, ইন্টারনেট ছাড়াই চলে।
- প্রতি PC-র Machine ID দিয়ে আলাদা key বানান (`6-NEW-SHOP-LICENSE.bat`)।
- ⚠️ দুই দোকানের মধ্যে auto-sync থাকবে না (যেটা চাওয়ার কথা ছিল)।

### মডেল B — External MongoDB (দোকানের নিজের সার্ভারে)
- build: `npm run dist:desktop`; `backend/.env`-এ `CLOUD_MONGODB_URI` **খালি** রাখুন → sync বন্ধ, প্রতি PC আলাদা।

### মডেল C — এক কেন্দ্রীয় DB (VPS/Atlas), প্রতি দোকান = আলাদা Organization
- সব PC একই DB-তে, কিন্তু প্রতিটা দোকানের ডেটা `orgId` দিয়ে আলাদা থাকে।
- Super Admin → **Organizations** → প্রতিটা দোকানের জন্য **New Organization**, তারপর সেই org-এর **admin user** বানান।
- প্রতিটা দোকানে লগইন করবেন **সেই org-এর admin/cashier** দিয়ে — platform Super Admin দিয়ে নয়।
- Super Admin সব দোকান দেখবে/সুইচ করবে — এটা by design, কিন্তু দৈনন্দিন কাজে ব্যবহার করবেন না।

## "সব সময় Super Admin দিয়ে লগইন" — সমস্যা কি?
- **এক DB (cloud) শেয়ার করলে হ্যাঁ, সমস্যা** — Super Admin platform-লেভেল, সে সব org দেখে/সুইচ করে, তাই প্রতিটা দোকানে একই ডেটা দেখবেন।
- **প্রতি PC-র নিজের লোকাল DB হলে না** — তখন প্রতিটা PC-র নিজের `admin` শুধু তার নিজের ডেটা দেখে।

## এখন কোনটা হবে — কীভাবে ধরবেন
প্রতিটা PC-তে খুলুন: `%APPDATA%\BDBBC POS\config.json` এবং দেখুন:
| ফিল্ড | আলাদা রাখতে চাইলে হওয়া উচিত |
|---|---|
| `edition` | `offline` |
| `mongoMode` | `bundled` (বা `external`) |
| `cloudMongoUri` | **খালি** `""` |
| `syncEnabled` | `false` (বা cloud URI খালি থাকলে nishtkriyo) |

`cloudMongoUri`-তে কিছু থাকলে ওই PC cloud-এ sync করছে → একাধিক এমন PC = মেশা ডেটা।

## ঠিক করার ধাপ
1. **আলাদা ডেটা চাইলে:** `npm run dist:offline` দিয়ে build করা exe প্রতিটা shop PC-তে ইনস্টল করুন। পুরোনোটার উপরেই ইনস্টল করা যায় — edition বদলালে অ্যাপ নিজেই `cloudMongoUri` রিসেট করে দেয় (তাই তখন আর sync করবে না)।
2. **ওই PC-র পুরোনো মেশা ডেটা মুছতে:** `CLEAN-RESET-DESKTOP.bat` চালান — অ্যাপ বন্ধ করে `%APPDATA%\BDBBC POS` পুরোটা ব্যাকআপ নিয়ে মুছে দেয়, শুধু `license.key` ফিরিয়ে আনে।
3. অ্যাপ খুলুন → FirstRun → **শুধু `admin`** (নতুন নিয়ম) → নিজের দোকানের ক্যাশিয়ার/ম্যানেজার ইউজার বানান → ডেটা এন্ট্রি।
4. **কেন্দ্রীয় model চাইলে:** Organizations-এ প্রতি দোকান একটা org + তার user বানান; প্রতিটি দোকানে ওই org-এর user দিয়ে লগইন করুন।

## যাচাই (এই PC-তে পাওয়া ফল)
- ইনস্টল করা অ্যাপ: `edition: offline`, `cloudMongoUri: ""`, লোকাল bundled DB → **আলাদা** ✅
- লোকাল DB-তে: ১টা Organization ("Main Organization"), ২ ইউজার, **০ কাস্টমার** → পরিষ্কার।
- Atlas (ওয়েব): ৩৬ কাস্টমার → এটা শুধু **ওয়েব** (Vercel) এ ব্যবহার করুন; দোকানের `.exe`-তে টেনে আনবেন না।

## মনে রাখুন
- দুই দোকানের ডেটা **আলাদা** চাইলে ➜ **প্রতি দোকানে offline exe** (মডেল A)।
- দুই দোকান একই ডেটা/সিঙ্ক চাইলে ➜ **এক ডেটাবেস + প্রতি দোকান আলাদা Organization** (মডেল C) এবং **per-org ইউজার** দিয়ে লগইন।
- কোনো অবস্থাতেই দুইটা আলাদা দোকানে **একই org** ব্যবহার করবেন না — তাহলেই ডেটা মেশে।

---
সংশ্লিষ্ট ডক: [`NEW-SHOP-BN.md`](./NEW-SHOP-BN.md) · [`DESKTOP-EXTERNAL-MONGODB.md`](./DESKTOP-EXTERNAL-MONGODB.md) · [`VERSIONING-BN.md`](./VERSIONING-BN.md)
