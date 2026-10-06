# নতুন দোকান সেটআপ চেকলিস্ট — BDBBC POS (Offline Edition)

প্রতি দোকানের জন্য একবার করে। build: **`BDBBC POS Setup 0.1.1.exe`** (offline edition — `cloudMongoUri: ""`, নিজের লোকাল DB)

> Offline build-এ প্রতিটা PC-র ডেটা **সম্পূর্ণ আলাদা** থাকে। দুই দোকান কখনো এক DB শেয়ার করে না।
> দেখুন: [`SHOP-ISOLATION-BN.md`](./SHOP-ISOLATION-BN.md)

---

## ০) প্রস্তুতি (যে PC-তে বসাবেন)
- Windows 10/11 64-bit, ≥ 4 GB RAM, ≥ 5 GB ফ্রি ডিস্ক
- ইনস্টল + Activate-এর সময় ইন্টারনেট; এরপর অ্যাপ offline চলবে
- [ ] আগের `Unique POS` / `BDBBC POS` থাকলে **Uninstall** করুন

## ১) Machine ID নিন (দোকানের PC-তে)
- ইনস্টলার চালিয়ে অ্যাপ খুলুন → **Activation স্ক্রিনে Machine ID** দেখাবে (যেমন `A1B2-C3D4-E5F6-7890`)
- [ ] Machine ID কপি করুন → ডেভ PC-তে নিয়ে আসুন

## ২) License key বানান (আপনার ডেভ PC-তে)
- **BDBBC License Manager** খুলুন → প্রথমবার **Select private.pem** → `tools\license-generator\keys\private.pem`
- **Shop name** (যেমন `Zahir`) · **মাস** (1 / 3 / 6 / 12 বা যেকোনো) · **Machine ID** (১ ধাপেরটা) · **Grace days** → **Issue** → **Copy**
- [ ] Key সংরক্ষণ/প্রিন্ট (`tools\license-generator\shops\<shop>\license.key`-ও সেভ হয়)
- [ ] `tools\license-generator\issued.csv`-এ serial/expiry লেখা হয় — মেয়াদ মনে রাখতে এটা দেখুন

## ৩) ইনস্টল
- [ ] `BDBBC POS Setup 0.1.1.exe` ঐ PC-তে কপি করুন (USB / ডাউনলোড)
- [ ] ইনস্টলার চালান → ডেস্কটপ শর্টকাট **BDBBC POS**
- [ ] প্রথম চালুতে Activation স্ক্রিনে **License key পেস্ট → Activate**
- ⚠ ভুল PC-তে Activate করলে হবে না — key-এর Machine ID-র সাথে এই PC মিলতে হবে

## ৪) Clean (আগের ডেটা থাকলে)
- [ ] অ্যাপ **বন্ধ** করুন
- [ ] `CLEAN-RESET-DESKTOP.bat` চালান → `%APPDATA%\BDBBC POS` পুরোটা ব্যাকআপ নিয়ে মুছে দেয়, `license.key` ফিরিয়ে আনে
- [ ] (external MongoDB হলে) `CLEAN-DATABASE.bat` দিয়ে `pos_db`-ও পরিষ্কার
- [ ] নিশ্চিত করুন `%APPDATA%\BDBBC POS\config.json` → `edition: offline`, `mongoMode: bundled`, `cloudMongoUri: ""`
- [ ] অ্যাপ আবার খুলুন

## ৫) Setup (প্রথম লগইন)
- [ ] লগইন `admin` / `Admin@123` (PIN `0000`) → **সাথে সাথে পাসওয়ার্ড বদলান** (Header → My Profile / Settings)
- [ ] Settings → দোকানের নাম, ঠিকানা, লোগো, VAT/currency
- [ ] **Users** → কাউন্টারের জন্য একটা **CASHIER** ইউজার বানান (admin পাসওয়ার্ড কাউন্টারে দেবেন না)
- [ ] **Accounts → Opening Balances** (নগদ/ব্যাংক ব্যালেন্স) দিন
- [ ] Categories / Brands → **Products** + opening stock দিন
- [ ] পুরোনো খাতা থাকলে **Customers** + due (ledger) এন্ট্রি
- [ ] Hardware → প্রিন্টার / ক্যাশ ড্রয়ার টেস্ট

## ৬) শেষ যাচাই
- [ ] একটা টেস্ট সেল → রিসিপ্ট প্রিন্ট → Sales-এ দেখা গেল
- [ ] কাস্টমার + due → Reports → Dues দেখা গেল
- [ ] স্টক কমল (Inventory-তে)
- [ ] অ্যাপ বন্ধ করে আবার খুললেও ডেটা আছে
- [ ] Login ফুটারে version **v0.1.1**

## ৭) পারে-পরবর্তী
- [ ] **Backup** পেজ থেকে snapshot নিন (চাইলে auto backup চালু)
- [ ] License expiry মনিটর করুন — **১৫ দিন** বাকি থাকলে একই Machine ID দিয়ে renewal key বানান

---

## ট্র্যাকিং টেবিল (কে কোন দোকানে)
| Shop | Machine ID | License key (serial) | Expiry | PC / নোট |
|---|---|---|---|---|
| Zahir | | | | |
| | | | | |
| | | | | |

## জরুরি নিয়ম
- এক দোকান = এক PC = এক লোকাল DB। **কখনো দুই দোকানে একই cloud DB/org ব্যবহার করবেন না** (ডেটা মেশে)।
- `private.pem` শুধু আপনার ডেভ PC-তে — দোকানে বা সার্ভারে দেবেন না।
- **Machine ID/license ডেটা আলাদা করে না** — ডেটা আলাদা হয় প্রতিটা PC-র নিজের লোকাল DB থেকে।
