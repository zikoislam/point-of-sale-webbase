# Version নম্বর (Build Versioning) — BDBBC POS

## কেন দরকার
প্রতিটা ইনস্টলার/ডিপ্লয়ের একটা আলাদা **version** থাকলে বোঝা যায় — কোন দোকানে কোন build আছে, কোনটা আপডেট করতে হবে, আর আপনি কোন build-এ ফিক্স দিয়েছেন। একই version-এর দুইটা ভিন্ন build থাকলে বিভ্রান্তি হয়, তাই প্রতিবার কিছু বদলালে version বাড়ান।

## একটাই সোর্স (single source of truth)
**রুট `package.json`-এর `version`** — এটাই সব কিছু ঠিক করে:
- Electron ইনস্টলারের ফাইলনাম
- অ্যাপের ভিতরের version (`app.getVersion()`, splash)
- `/api/v1/health`-এ দেখানো version

`npm run version:set` চালালে একসাথে তিনটা ফাইলে সেট হয় (root + backend + frontend), যাতে সব জায়গায় একই থাকে।

## কীভাবে বদলাবেন
```bash
# এখনকার version দেখুন
npm run version:set -- --show

# নির্দিষ্ট version বসান
npm run version:set -- 0.1.1

# অটো-বাম্প
npm run version:set -- --bump patch   # 0.1.0 → 0.1.1  (বাগ ফিক্স)
npm run version:set -- --bump minor   # 0.1.1 → 0.2.0  (নতুন ফিচার)
npm run version:set -- --bump major   # 0.2.0 → 1.0.0  (মেজর রিলিজ / বড় পরিবর্তন)
```
> `npm run` দিয়ে আর্গুমেন্ট পাঠাতে মাঝে `--` লাগে (যেমন `npm run version:set -- 0.1.1`)। চাইলে সরাসরি: `node scripts/set-version.js 0.1.1`।

## বাম্প করার নিয়ম (সাজেশন)
- **patch** (0.1.**1**) — ছোট ফিক্স, টেক্সট, হিসাব-সংশোধন। দোকানে আপডেট করান।
- **minor** (0.**1**.0 → 0.**2**.0) — নতুন ফিচার/মডিউল যোগ।
- **major** (**1**.0.0) — প্রথম paid রিলিজ, বা এমন পরিবর্তন যেখানে ডেটাবেস/মাইগ্রেশন লাগে।
- প্রি-লঞ্চ/β থাকতে **0.x.y** রাখুন; 안정 version-এ **1.0.0**।

## Build করার পর ইনস্টলার যা হবে
`package.json` version = `0.1.0` হলে:
```
dist-electron/…            BDBBC POS Setup 0.1.0.exe                 (ওয়েব + ক্লাউড sync)
dist-electron-desktop/…    BDBBC POS Desktop Setup 0.1.0.exe         (external MongoDB)
dist-offline-build/…       BDBBC POS Setup 0.1.0.exe                 (offline / bundled MongoDB)
dist-license-manager/…     BDBBC License Manager Setup 0.1.0.exe
```

## অ্যাপে কোথায় version দেখা যাবে
- **Splash** — অ্যাপ খোলার সময় `v0.1.0 | Powered by Bdbbc.com`
- **Activation / Locked স্ক্রিন** — `v<version>`
- **Login পেজের ফুটার** — `BDBBC POS v0.1.0`
- **API health** — `GET /api/v1/health` → `data.version`

## রিলিজ ফ্লো (উদাহরণ)
```bash
# ১. কোড ঠিক করলাম
npm run version:set -- --bump patch   # 0.1.0 → 0.1.1
# ২. ইনস্টলার বানালাম
npm run dist:offline                  # অথবা dist / dist:desktop / license-manager:dist
# ৩. git commit + push
git add -A
git commit -m "release: v0.1.1 — <কী বদলালো>"
git push
```
ওয়েবের (Vercel) version = `frontend/package.json` → Vercel-এ ডিপ্লয় হলে login ফুটারে দেখা যাবে।

## নোট
- `version:set` শুধু তিনটা `package.json` বদলায় — ডেটা/ডেটাবেসে হাত দেয় না।
- পুরোনো ইনস্টল করা অ্যাপের version বদলাতে চাইলে **নতুন build ইনস্টল** করতে হবে; আপগ্রেড ইনস্টল করলে `%APPDATA%\BDBBC POS` ডেটা থাকবে।
- ফ্রেশ ইনস্টলে এখন শুধু **`admin`** ইউজার তৈরি হয়; দোকানের ক্যাশিয়ার/ম্যানেজার ইউজার আপনি Users পেজ থেকে বানাবেন।
