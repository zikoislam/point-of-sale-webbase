# Desktop Edition (External MongoDB) — সম্পূর্ণ গাইড

এই এডিশনে **ওয়েব ভার্সন অপরিবর্তিত** থাকে। এটা শুধু ডেস্কটপ কাস্টমারদের জন্য একটা আলাদা
`.exe`, যেটা কাস্টমারের PC-তে **আপনি নিজে ইনস্টল করা MongoDB**-র সাথে কানেক্ট হয় — অ্যাপ
ভিতরে কোনো MongoDB বান্ডল করে না।

- **Offline:** কাস্টমারের PC-তে ইনস্টল করা MongoDB থেকেই চলে (ইন্টারনেট লাগে না)।
- **Online (অপশনাল):** চাইলে একটা cloud MongoDB সেট করে sync চালু করা যায় (নিচে দেখুন)।

দুইটা এডিশন আলাদা, তাই ভয় নেই:

| | Standard build | **Desktop (External MongoDB)** |
|---|---|---|
| কমান্ড | `npm run dist` | `npm run dist:desktop` |
| MongoDB | অ্যাপ নিজের bundled `mongod` চালায় | কাস্টমারের ইনস্টল করা MongoDB ব্যবহার করে |
| আউটপুট | `dist-electron\` | `dist-electron-desktop\` |
| appId | `com.bdbbc.unique-pos` | `com.bdbbc.unique-pos.desktop` |

> ⚠ **সবচেয়ে জরুরি:** backend checkout/return/wastage-এ ACID transaction ব্যবহার করে,
> আর MongoDB transaction শুধু **replica set**-এ কাজ করে। সাধারণ MongoDB MSI ইনস্টল করলে
> সেটা standalone হয় → প্রথম বিক্রিতেই error দেবে। তাই আগে MongoDB-কে **single-node
> replica set** বানাতেই হবে (নিচে ধাপ ২)।

---

## ধাপ ১ — কাস্টমার PC-তে MongoDB ইনস্টল

1. MongoDB Community Server MSI নামান (Windows x64)। কাস্টমারকে একবারই।
2. ইনস্টল করার সময় **"Install MongoDB as a Service"** টিক দিন (default থাকে)।
   - Service name: `MongoDB` · port: `27017` · bindIp: `127.0.0.1`।
3. ইনস্টল শেষ হলে MongoDB service চালু থাকবে।

## ধাপ ২ — MongoDB-কে single-node replica set বানান (এकবার, বাধ্যতামূলক)

**সহজ উপায় (সুপারিশ):** এই রিপো-র `8-SETUP-MONGODB-REPLSET.bat` ফাইলটা কাস্টমার PC-তে কপি করে
**Administrator হিসেবে Run as administrator** করুন। এটা নিজে:
- `mongod.cfg`-এ `replication.replSetName: rs0` যোগ করে (backup রেখে),
- `MongoDB` service restart করে,
- `rs.initiate()` চালিয়ে replica set চালু করে।

**ম্যানুয়াল উপায়:**

1. `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg` ফাইলটা Notepad (Admin) দিয়ে খুলে শেষে যোগ করুন:
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Windows Services (`services.msc`) → **MongoDB** → **Restart**। (অথবা admin cmd-এ `net stop MongoDB` → `net start MongoDB`)
3. একবার initiate করুন (MSI-এর সাথে আসা shell দিয়ে):
   ```bat
   "C:\Program Files\MongoDB\Server\7.0\bin\mongosh.exe" --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
   ```
   `{ ok: 1 }` এলেই হয়ে গেছে।

> host অবশ্যই `127.0.0.1:27017` দিন — অ্যাপ এই অ্যাড্রেসেই কানেক্ট করে।

---

## ধাপ ৩ — আপনার dev PC-তে External-MongoDB `.exe` বানান

```bat
cd "C:\Users\lenovo\Documents\point of sale webbase"

rem একবার: সাইনিং key (public key electron/license.js-এ পেস্ট করুন)
npm run license:init

rem এই এডিশনের installer বানাও
npm run dist:desktop
```
- ফলাফল: **`dist-electron-desktop\Unique POS Desktop Setup 1.0.0.exe`**
- শুধু টেস্ট করতে (installer ছাড়া, চটজলদি): `npm run dist:desktop:dir`
- এই build-এ `build/mongodb` কপি হয় না — `.exe` হালকা, আর `app-config.json`-এ
  `mongoMode: "external"` লেখা থাকে, তাই অ্যাপ সবসময় ইনস্টল করা MongoDB-ই ব্যবহার করবে।

## ধাপ ৪ — লাইসেন্স তৈরি

**লক্ষ্য করুন:** `.exe` — এ মাস/সময়ের কোনো সেটিং নেই। একটাই `.exe` সব দোকানে চলবে; সময় ঠিক হয়
এখন, প্রতিটা কী বানানোর সময়। ১, ৩, ৬, ১২ — যেকোনো মাস, বা নির্দিষ্ট তারিখ।

```bat
npm run shop:new -- --shop "দোকানের নাম" --months 1        :: ১ মাস
npm run shop:new -- --shop "দোকানের নাম" --months 3        :: ৩ মাস
npm run shop:new -- --shop "দোকানের নাম" --months 12       :: ১২ মাস
npm run shop:new -- --shop "দোকানের নাম" --expires 2026-12-31   :: নির্দিষ্ট দিনে শেষ
```
এছাড়া `.bat` ফাইলে ডাবল-ক্লিক করলে ১/৩/৬/১২-এর মেনু আসবে, বা নিজের সংখ্যাও লিখতে পারবেন।
→ `tools\license-generator\shops\<name>\license.key`

> expiry-র সাথে সাথে in-app subscription-ও (grace দিনসহ) সেট হয়, দুটো একসাথে লক হয়।

## ধাপ ৫ — কাস্টমার PC-তে ইনস্টল

USB-তে কপি করুন: **MongoDB MSI** (ধাপ ১–২ যদি আগে করা না থাকে), **`Unique POS Desktop Setup 1.0.0.exe`**, আর ওই দোকানের **`license.key`**।

1. MongoDB ইনস্টল + replica set (ধাপ ১–২) — না করা থাকলে।
2. `Unique POS Desktop Setup 1.0.0.exe` → Install।
3. অ্যাপ খুলবে → activation পর্দায় `license.key` পেস্ট → **Activate**।
   - যদি "MongoDB is not running" মেসেজ আসে → MongoDB service চালু নেই; ধাপ ২ পুনরায় দেখুন।
4. লগইন `admin` / `Admin@123` → পাসওয়ার্ড বদলান।
5. Settings → দোকানের তথ্য, প্রিন্টার; Users → Manager/Cashier; Products → ডেটা।

## ধাপ ৬ (অপশনাল) — Online sync চালু করা

এডিশনটা ডিফল্টভাবে **offline** (শুধু লোকাল MongoDB)। কাস্টমারের ডেটা cloud-এ ব্যাকআপ/সিঙ্ক
করতে চাইলে, কাস্টমার PC-তে ফাইল এডিট করুন:

```
%APPDATA%\Unique POS\config.json
```
- `"cloudMongoUri": "mongodb+srv://.../<db>"` — একটা **dedicated cloud MongoDB** দিন।
- `"syncEnabled": true` (default true)
- অ্যাপ restart করুন → লোকাল ডেটা cloud-এ sync হবে (নিচের নিয়মে), ইন্টারনেট না থাকলেও বিক্রি চলবে।

> ⚠ **প্রতিটা দোকানের আলাদা cloud URI দিন।** এক URI একাধিক দোকানে দিলে ডেটা মিশে যাবে।
> শুধু এডিশন বানানোর সময় cloud URI দিতে চাইলে `backend/.env`-এ `CLOUD_MONGODB_URI=` সেট করুন
> (`MONGODB_URI` নয়) — `prepare-resources.js` external build-এ শুধু ওটাই ব্যবহার করে।

---

## সতর্কতা ও টিপস

- **পোর্ট 27017 খালি রাখুন:** ওই পোর্টে অন্য কোনো mongod চললে কনফ্লিক্ট হবে।
- **Windows Firewall:** MongoDB `127.0.0.1`-এ bind করা, তাই বাইরে থেকে কেউ ঢুকতে পারবে না — ভালো।
- **ডেটা কোথায়:** MongoDB-র নিজের `dbPath`-এ (default `C:\Program Files\MongoDB\Server\<v>\data`)।
  তাই uninstall/upgrade-এ ডেটা নিরাপদ। মাঝে মাঝে backup নিন (`mongodump`)।
- **আপডেট:** অ্যাপ কোড বদলালে নতুন `Unique POS Desktop Setup.x.exe` বানিয়ে দোকানে ইনস্টল করে দিন —
  ডেটা MongoDB-তে থাকে, হারাবে না।
- **একই PC-তে দুই এডিশন দিলে** দুটোই `%APPDATA%\Unique POS` শেয়ার করে, তাই সেটা এড়িয়ে চলাই ভালো।
- **public key:** `npm run license:init` একবারই; প্রিন্ট হওয়া public key `electron/license.js`-এ
  পেস্ট না করলে activation কাজ করবে না। `private.pem` কখনো শেয়ার করবেন না।
```
