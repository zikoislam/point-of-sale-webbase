# নতুন দোকান সেটআপ — Model C (প্রতি কোম্পানির জন্য আলাদা ইনস্টল)

এই ডকুমেন্টটা আপনার **Model C** ওয়ার্কফ্লোর জন্য: একবার একটা মাস্টার `.exe` বানাবেন,
তারপর প্রতিটা নতুন কোম্পানি/দোকান আলাদা ইনস্টল করবেন এবং তাদের নিজের ডেটা/ইউজার সেট করবেন।
প্রতিটা ইনস্টল একটা সম্পূর্ণ আলাদা অ্যাপ — নিজের লোকাল MongoDB, নিজের ইউজার, নিজের ডেটা।

---

## ভাগ ০ — একবারের প্রস্তুতি (আপনার মেশিনে)

```bat
cd "C:\Users\lenovo\Documents\point of sale webbase"
npm run install:all
```

**১. সাইনিং keypair বানান (জীবনে একবার):**
```bat
npm run license:init
```
- এটা `tools/license-generator/keys/private.pem` (গোপন) আর `public.pem` বানায়।
- terminal-এ যে `PUBLIC_KEY_PEM = ...` প্রিন্ট হবে সেটা কপি করে `electron/license.js`-এ পেস্ট করুন।
- ⚠ `private.pem` **কখনো শেয়ার/কমিট করবেন না**, আর একটা নিরাপদ backup রাখুন (পাসওয়ার্ড ম্যানেজার/USB)।
  এটা হারালে আগের সব ইনস্টলের জন্য নতুন কী বানাতে পারবেন না।

**২. MongoDB বাইনারি নামান (অফলাইন চালানোর জন্য):**
```bat
npm run fetch:mongod
```

**৩. মাস্টার ইনস্টলার বানান:**
```bat
npm run dist
```
- ফলাফল: `dist-electron\Unique POS Setup <version>.exe` — **এটাই আপনার মাস্টার ফাইল**, কোনো ডেটা নেই।
- শুধু টেস্ট করতে চাইলে (installer ছাড়া): `npm run dist:dir`

> ⚠ কোড বদলালে প্রতিবার নতুন করে `npm run build:backend` → `npm run dist` করতে হবে, কারণ packaged অ্যাপ `backend/dist` থেকে চলে।

---

## ভাগ ১ — নতুন দোকানের লাইসেন্স তৈরি

সবচেয়ে সহজ: root-এ **`6-NEW-SHOP-LICENSE.bat`** ডাবল-ক্লিক করুন, অথবা কমান্ড:
```bat
npm run shop:new -- --shop "Rahim Store" --months 12
```
- মেশিন-বাউন্ড করতে (এক পিসিতে চলবে): `--machine AB12-CD34-EF56` (Machine ID অ্যাপের activation পর্দায় দেখায়)।
- ফিক্সড তারিখে শেষ করতে: `--expires 2027-03-01`।
- গ্রেস: `--grace 7` (ডিফল্ট ৭ দিন)।

ফলাফল: `tools/license-generator/shops/<shop-name>/`
- `license.key` ← **এই ফাইলটা কাস্টমারকে দিন**
- `shop-info.txt` ← আপনার রেকর্ড (serial/expiry + সেটআপ ধাপ)

> প্রতিটা কী `tools/license-generator/issued.csv`-তেও জমা হয় — কে, কখন, কত দিনের কী পেল তার হিসাব।

---

## ভাগ ২ — দোকানে ইনস্টল ও কোম্পানি-ওয়াইজ সেটআপ

1. **ইনস্টল:** `Unique POS Setup.exe` চালান।
2. **Activation:** অ্যাপ খুললে activation পর্দা আসবে → আপনার দেওয়া `license.key`-এর পুরো লেখাটা পেস্ট করে **Activate**।
3. **প্রথম লগইন:** `admin` / `Admin@123` → **সাথে সাথে পাসওয়ার্ড বদলান**।
   (নতুন ভার্সনে প্রথমবার চালালে সিস্টেম নিজেই role + admin + ডিফল্ট অর্গানাইজেশন বানায়।)
4. **দোকানের সেটিংস:** Settings → shop name, ঠিকানা, currency, প্রিন্টার / cash drawer।
5. **ইউজার:** Users → এই কোম্পানির **Manager / Cashier** বানান।
6. **ডেটা:** Products / Categories / Suppliers / (চাইলে) Opening stock — Import/Export দিয়েও তোলা যায়।

ডেটা থাকে: `%APPDATA%\Unique POS` — নতুন ভার্সন ইনস্টল করলেও ডেটা থেকে যায়।

---

## ভাগ ৩ — রিনিউ (সময় শেষ হওয়ার আগে)

1. আবার `npm run shop:new -- --shop "<একই নাম>" --months 12` চালান → নতুন `license.key`।
   - আগের টার্মের উপর যোগ হয় (তাড়াতাড়ি রিনিউ করলে বাকি দিন নষ্ট হয় না, কারণ in-app subscription `max(now, current)` থেকে বাড়ে)।
2. কাস্টমারকে নতুন কী পেস্ট করতে বলুন (activation পর্দায়, অথবা অ্যাপের ভিতরে Software Locked পেজে)।

Skype-এর মতো হঠাৎ: লাইসেন্স শেষ হলে **ডেস্কটপ boot gate** (অ্যাপ খুলবে না) আর **in-app 402 lock** দুটোই একসাথে কাজ করে, কারণ licence-এর expiry লোকাল অর্গানাইজেশনের subscription-এ mirror হয়।

---

## জরুরি সতর্কতা

- **একই cloud DB সব দোকানের সাথে শেয়ার করবেন না।** `prepare-resources.js` আপনার `backend/.env`-এর `MONGODB_URI` installer-এর ভিতরে ঢুকিয়ে দেয় (extract করা যায়), আর sync চালু থাকলে সব কোম্পানির ডেটা মিশে যাবে। Model C-তে সবচেয়ে ভালো: cloud URI **ফাঁকা** রাখুন (শুধু লোকাল/অফলাইন), অথবা প্রতিটা কোম্পানির আলাদা cloud।
- **প্রতি দোকান = একটা ইনস্টল**, তাই নতুন ভার্সন প্রত্যেককে আলাদা `.exe` দিয়ে update করতে হবে।
- **private.pem** গোপন; **public key** শুধু `electron/license.js`-এ।
- ইনস্টলার থেকে extract করে কেউ আপনার cloud credential বের করতে পারে — তাই cloud লাগলে dedicated low-privilege DB user ব্যবহার করুন।

---

## এক নজরে কমান্ড

```bat
npm run install:all                 :: একবার
npm run license:init                :: একবার (তারপর public key electron/license.js-এ)
npm run fetch:mongod                :: একবার (বা mongod update করলে)
npm run dist                        :: মাস্টার installer বানাও

npm run shop:new -- --shop "Name" --months 12   :: প্রতি নতুন দোকানে
```
