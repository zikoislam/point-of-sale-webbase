# কোড সুরক্ষা — কাস্টমারের PC-তে কী যায়, কী যায় না (BDBBC POS)

## সোজা কথা
Electron/JavaScript অ্যাপের কোড **সম্পূর্ণ লুকানো সম্ভব নয়** — বিশেষ করে frontend, কারণ সেটা তো ব্রাউজারে চলে (অ্যাপের ভিতরের ব্রাউজারেও)। যে কেউ চাইলে উৎসাহ নিয়ে দেখতে পারবে। কিন্তু আপনার **আসল সোর্স বা গোপন তথ্য কখনোই যায় না**, আর চুরি করাটা কঠিন করে তোলা যায়।

## ১) `win-unpacked` ফোল্ডার কাস্টমারের কাছে যায় **না**
- `win-unpacked` শুধু **আপনার ডেভ PC-তে build-এর মাঝখানের** ফোল্ডার (এখন `${repo}\dist-offline-build\win-unpacked`)।
- কাস্টমার পায় মাত্র **একটা installer**: `BDBBC POS Setup 0.1.3.exe`।
- ⚠️ কাস্টমারকে বা shop PC-তে **কখনো** `build\`, `dist-offline-build\`, `win-unpacked\`, `node_modules\` ফোল্ডার দেবেন না — শুধু **`BDBBC POS Setup x.y.z.exe`** (+ দরকার হলে `CLEAN-EXE-DB.bat/.ps1`)।
- `win-unpacked` হয়তো আপনার গিটহাবেও যাচ্ছে না (`.gitignore`-এ `dist-offline-build/`)।

## ২) কাস্টমারের PC-তে বাস্তবে কী থাকে
ইনস্টলের পর `%LOCALAPPDATA%\Programs\BDBBC POS\`-এ:
| ফাইল/ফোল্ডার | কী | পড়া যায়? |
|---|---|---|
| `app.asar` | Electron main/preload (compiled JS) | হ্যাঁ (asar extract) |
| `resources\backend\dist\*.js` | backend-এর **compiled JS** (JS মিনিফাইড নয়) | হ্যাঁ |
| `resources\frontend\...` | Next.js compiled output | হ্যাঁ |
| `resources\mongodb\` | MongoDB-র mongod.exe | (MongoDB-র নিজের) |

**যাচাই করা:**
- ✅ আমাদের **TypeScript সোর্স (`src/`) ship হয় না** — কোনো `backend/src`, `frontend/src` নেই।
- ✅ কোনো **source map (`.js.map`) ship হয় না** — তাই compiled JS থেকে সোর্স সহজে উদ্ধার হয় না।
- `.ts` ফাইল যা পাওয়া গেছে সব `node_modules`-এর (পাবলিক প্যাকেজ) — অন্যের কোড।

## ৩) যা কখনোই যায় না (আসল সুরক্ষা)
- **Signing private key** (`tools\license-generator\keys\private.pem`) — কখনো installer-এ ঢোকেনি; শুধু আপনার ডেভ PC-তে। (Assetract করা যাবে না, কারণ নেই।)
- **`jwtSecret`** — প্রতি ইনস্টলে runtime-এ random তৈরি হয়।
- **Cloud credential** — offline build-এ `cloudMongoUri: ""` ⇒ কোথাও সংযোগ করার চাবি নেই।
- ফলে কোড পড়লেও কেউ **আপনার সার্ভারে ঢুকতে পারবে না**, বা **অন্য PC-তে চালাতে পারবে না** (Ed25519 key Machine ID-তে বাঁধা)।

## ৪) যা আমি করেছি / করলাম (hardening)
1. **DevTools বন্ধ (packaged build)** — `devTools: false` + `F12 / Ctrl+Shift+I / Ctrl+U` আটকানো; মেনুতে Developer এন্ট্রিও নেই। ⇒ কেউ `F12` চেপে ভিতর দেখা/এডিট করতে পারবে না।
   (আগের build-এ F12 খোলা ছিল — v0.1.3-এ বন্ধ।)
2. **ASAR bundling** (default) — Electron কোড এক ফাইলে; casual browsing কঠিন।
3. **`npm run check:build`** — এখন **source-leak চেকও** করে: own `.ts`/`.tsx` বা `.map` গেলে **FAILED**।
4. **Machine-bound license** — কপি করে অন্য PC-তে চালানো যায় না।

## ৫) আরও শক্ত করতে চাইলে (ঐচ্ছিক)
- **Backend obfuscation** — `javascript-obfuscator` দিয়ে `build/backend/dist` obfuscate; পড়া অনেক কঠিন হয়। তবে সাবধানে (Mongoose/dynamic require ভাঙতে পারে) টেস্ট করে করতে হয়। **কহলে যোগ করে দেব।**
- **Bundle + minify** (esbuild) — backend কে কয়েকটা ফাইলে রেখে minify; obfuscate-এর চেয়ে কম ঝুঁকি।
- **bytenode (V8 bytecode)** — সবচেয়ে শক্ত, কিন্তু জটিল।
- **সবচেয়ে ভালো সুরক্ষা: দামি লজিক আপনার VPS-এ রাখা** (desktop = thin client) — তখন কোড কখনোই কাস্টমারের কাছে যায় না। কিন্তু offline-এ কিছু কাজ করবে না।
- **আইনি:** ইনস্টলারে থাকে `LICENSE.txt` — তাতে **reverse-engineering / redistribute নিষিদ্ধ** স্পষ্ট লিখুন (EULA)। লিক হলে ট্রেস করার জন্য প্রতিটা কপিতে shop নাম/Machine ID watermark রাখা যায়।

## সুপারিশ (আপনার ক্ষেত্রে)
- এক-শপ **offline exe**-র জন্যে বর্তমান অবস্থা যথেষ্ট: **কোনো গোপন তথ্য ship হয় না + লাইসেন্স machine-bound** ⇒ কেউ কোড দেখলেও আপনার ব্যবসার ক্ষতি করতে পারবে না।
- শুধু নিয়ম মেনে চলুন: **কাস্টমারকে শুধু installer `.exe` দিন** — পুরো বিল্ড ফোল্ডার কখনো নয়।
- যদি ভবিষ্যতে এমন মডিউল থাকে যেটা আপনার মূল সম্পদ (যেমন কোনো হিসাব-অ্যালগরিদম) → সেটা **সার্ভারে** রাখুন, desktop-এ নয়।

---
সংশ্লিষ্ট: [`SHOP-ISOLATION-BN.md`](./SHOP-ISOLATION-BN.md) · [`SHOP-INSTALL-CHECKLIST-BN.md`](./SHOP-INSTALL-CHECKLIST-BN.md) · [`VERSIONING-BN.md`](./VERSIONING-BN.md)
