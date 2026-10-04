/**
 * Content for the BDBBC ERP user manual.
 *
 * Bangla leads every line (that is how the shop staff read), with a short
 * English gloss beside it so a trainer or a non-Bangla reader can follow too.
 * Kept as data so the PDF is a rendering concern, not a writing one.
 */
export type Line = { bn: string; en?: string };

export type Block =
  | { kind: 'para'; bn: string; en?: string }
  | { kind: 'note'; bn: string; en?: string }
  | { kind: 'sub'; bn: string; en?: string }
  | { kind: 'steps'; items: Line[] }
  | { kind: 'bullets'; items: Line[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface Chapter {
  titleBn: string;
  titleEn: string;
  blocks: Block[];
}

export interface Part {
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  chapters: Chapter[];
}

export const MANUAL_VERSION = '১.১ (Version 1.1)';

export const PARTS: Part[] = [
  /* ═══════════════════════════ PART A ═══════════════════════════ */
  {
    titleBn: 'অংশ ক — শুরু করার আগে',
    titleEn: 'Part A — Getting Started',
    summaryBn: 'সিস্টেমটা কী কী কাজ করে, কীভাবে ঢুকবেন, কে কী করতে পারবেন — এই অংশ পড়ে নিলে বাকি সব সহজ লাগবে।',
    chapters: [
      {
        titleBn: '১. BDBBC ERP Solution — এক নজরে',
        titleEn: 'What this software does',
        blocks: [
          {
            kind: 'para',
            bn: 'এটি একটি সম্পূর্ণ ক্লাউড-ভিত্তিক POS ও ব্যবসা ব্যবস্থাপনা সফটওয়্যার। একই সফটওয়্যারে দোকানের বিক্রয়, স্টক, ক্রয়, হিসাব, কর্মী, গ্রাহক ও রিপোর্ট — সব একসাথে চলে। প্রতিটি তথ্য প্রতিষ্ঠান (Organization) অনুযায়ী আলাদা থাকে, তাই একই সফটওয়্যার দিয়ে একাধিক দোকান বা শাখা নিরাপদে চালানো যায়।',
            en: 'A cloud ERP covering sales, stock, purchase, accounts, HR, CRM and reporting. Every record is isolated per organization (multi-tenant).',
          },
          { kind: 'sub', bn: 'মূল ১১টি মডিউল', en: 'The eleven modules' },
          {
            kind: 'table',
            head: ['মডিউল (Menu)', 'কী করে'],
            rows: [
              ['ট্রেড ও ইনভেন্টরি (Trade & Inventory)', 'POS বিক্রয়, বিক্রয় ইতিহাস, ক্রয় আদেশ, পণ্য, স্টক, শাখা, পাইকারি-খুচরা দাম'],
              ['পারচেজ ও ইনভেন্টরি', 'PO তৈরি → অনুমোদন → মাল গ্রহণ (GRN) → স্টক, সাপ্লায়ার হিসাব, ক্রয় ফেরত, স্টক ট্রান্সফার'],
              ['হিসাব (Accounts & Finance)', 'চার্ট অব অ্যাকাউন্টস, জার্নাল ভাউচার, দৈনিক খতিয়ান, খরচ, বছর-শেষ ক্লোজিং, পিএল/ব্যালান্স শিট'],
              ['ডিস্ট্রিবিউশন ও এসআর', 'টেরিটরি, রুট, এসআর, রুট-ভিত্তিক ডিলার, ফিল্ড অর্ডার'],
              ['প্রোডাকশন', 'BOM (রেসিপি) ও উৎপাদন রান — কাঁচামাল থেকে তৈরি পণ্য'],
              ['আমদানি ও রপ্তানি', 'এলসি (LC), প্রফর্মা ও কমার্শিয়াল ইনভয়েস, সিএন্ডএফ এজেন্ট, ল্যান্ডেড কস্ট'],
              ['অনুমোদন ও প্রকল্প (Approvals & Projects)', 'মাল্টি-লেভেল অনুমোদন এবং প্রকল্পভিত্তিক খরচ/লাভ'],
              ['সিআরএম (CRM)', 'গ্রাহক যোগাযোগ, লিড, ক্যাম্পেইন, সাপোর্ট টিকিট, লয়্যালটি প্রোগ্রাম'],
              ['এইচআর ও পেরোল (HR & Payroll)', 'কর্মী, হাজিরা, অগ্রিম, বেতন রান, ছুটির আবেদন'],
              ['ই-কমার্স (eCommerce)', 'অনলাইন অর্ডার, স্টোরফ্রন্ট, কুরিয়ার ও সিএমডি (COD)'],
              ['রিপোর্টিং সেন্টার (Reports)', 'সব বিভাগের রিপোর্ট একসাথে খোঁজা ও ডাউনলোড (CSV/Excel/PDF)'],
              ['প্রশাসন (Administration)', 'সংস্থা, ব্যবহারকারী, রোল, অডিট লগ, ব্যাকআপ, সেটিংস'],
            ],
          },
          {
            kind: 'note',
            bn: 'মেনু বদলায় ভূমিকা (Role) অনুযায়ী — যার যে অনুমতি আছে, সে শুধু সেটাই দেখেন। সাইডবারে ঢুকলে যে মডিউলে আছেন, সাইডবারে শুধু সেই মডিউলের কাজগুলো দেখায়; “All modules”-এ গেলে আবার সব দেখবেন।',
            en: 'The sidebar is contextual: inside a module you only see that module, and “All modules” brings the full list back.',
          },
        ],
      },

      {
        titleBn: '২. লগইন ও প্রথম ঢোকার ধাপ',
        titleEn: 'Signing in',
        blocks: [
          { kind: 'sub', bn: '২.১ সাধারণ (নন-অ্যাডমিন) ব্যবহারকারী', en: 'Normal user' },
          {
            kind: 'steps',
            items: [
              { bn: 'ব্রাউজারে সফটওয়্যার খুলুন → লগইন পাতা আসবে (দোকানের নাম ও লোগো দেখাবে)।', en: 'Open the app → sign-in card.' },
              { bn: '“Username or Email” ঘরে ইউজারনেম লিখুন (যেমন admin)।', en: 'Type your username or email.' },
              { bn: '“Password” ঘরে পাসওয়ার্ড লিখুন — পাশের চোখের আইকনে চাপ দিলে লেখা দেখা যাবে।', en: 'Type the password; the eye icon reveals it.' },
              { bn: 'চাইলে “Remember me on this terminal (30 days)” টিক দিন। তবে ক্যাশ ড্রয়ার বা শেয়ার-করা কম্পিউটারে টিক দেবেন না।', en: 'Optional: stay signed in for 30 days.' },
              { bn: '“Sign In” চাপুন। সঠিক হলে সফটওয়্যার আপনাকে POS টার্মিনালে নিয়ে যাবে (অ্যাডমিন হলে প্রতিষ্ঠান নির্বাচনের পাতায়)।', en: 'Press Sign In.' },
            ],
          },
          { kind: 'sub', bn: '২.২ পাসওয়ার্ড ভুলে গেলে', en: 'Forgot password' },
          {
            kind: 'steps',
            items: [
              { bn: 'লগইন পাতার নিচে “Forgot password?” লিংকে ক্লিক করুন এবং আপনার ইউজারনেম বা ইমেইল দিন → “Send reset code” চাপুন।', en: 'Send a 6-digit code to your recovery email.' },
              { bn: 'ইমেইলে আসা ৬ ডিজিটের কোড ও নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) লিখে “Set new password” চাপুন।', en: 'Enter the code and a new password (min 6 chars).' },
              { bn: 'ইমেইল না থাকলে মালিক/অ্যাডমিনকে বলুন — তিনি Users পাতা থেকে নতুন পাসওয়ার্ড দিয়ে দিতে পারবেন।', en: 'No email access? An admin resets it from Users.' },
            ],
          },
          { kind: 'sub', bn: '২.৩ POS টার্মিনাল লক খোলা (PIN)', en: 'Unlocking the till' },
          {
            kind: 'para',
            bn: 'টার্মিনাল লক থাকলে (উপরের লক আইকন বা Ctrl+L দিলে) পর্দায় “Terminal Locked” আসবে। ৩×৪ চাবির প্যাডে আপনার ৪ ডিজিটের PIN (যেমন 0000/1111) দিয়ে “OK” চাপুন। PIN ভুল হলে “Incorrect PIN” দেখাবে।',
            en: 'Enter your 4-digit PIN on the keypad to unlock the till.',
          },
          { kind: 'sub', bn: '২.৪ ভাষা বদলানো, প্রতিষ্ঠান বদলানো', en: 'Language & organization' },
          {
            kind: 'bullets',
            items: [
              { bn: 'ভাষা: Header-এর EN | বাং সুইচার — পুরো সফটওয়্যার সাথে সাথে বাংলায়/ইংরেজিতে বদলে যাবে, পছন্দটা ব্রাউজারে সেভ থাকে।', en: 'Header language switch (no reload).' },
              { bn: 'প্রতিষ্ঠান: Header-এর OrgSwitcher → একাধিক প্রতিষ্ঠান থাকলে যেটাতে কাজ করবেন সেটি বেছে নিন। না বদলালে অনেক পাতা “ORG_CONTEXT_REQUIRED” জানাবে।', en: 'OrgSwitcher picks the active organization.' },
            ],
          },
        ],
      },

      {
        titleBn: '৩. ফোনে ইনস্টল (PWA) ও অফলাইন ব্যবহার',
        titleEn: 'Install on phone (PWA) & offline use',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'কম্পিউটারে Chrome/Edge-এ সাইট খুললে ঠিকানা বারে “Install” আইকন আসে — চাপলে সফটওয়্যার অ্যাপের মতো ইনস্টল হবে।', en: 'Browser → Install icon.' },
              { bn: 'মোবাইলে Chrome-এ “Add to Home screen” — এরপর হোম স্ক্রিনের আইকনেই POS খুলবে (আলাদা অ্যাপের দরকার নেই)।', en: 'Phone → Add to Home screen.' },
              { bn: 'নেট না থাকলে POS নিজে থেকেই “Offline Mode” দেখাবে — বিক্রয় হয়, রশিদ প্রিন্ট হয়; পরে নেট এলে “Sync N Sale(s)” চেপে ক্লাউডে তুলে দিন।', en: 'Offline sales queue locally and sync later.' },
            ],
          },
          {
            kind: 'note',
            bn: 'সার্ভিস ওয়ার্কার কখনও API-র তথ্য (বিক্রয়, স্টক) ক্যাশ করে না — শুধু অ্যাপের কাঠামো ক্যাশ করে। তাই নেট এলে সবসময় সঠিক তথ্য আসে।',
            en: 'The service worker never caches API data — only the app shell.',
          },
        ],
      },

      {
        titleBn: '৪. কে কী করতে পারে (ভূমিকা ও অনুমতি)',
        titleEn: 'Roles & permissions at a glance',
        blocks: [
          {
            kind: 'para',
            bn: 'প্রতিটি কাজের পেছনে একটি অনুমতি (Permission) থাকে, যেমন pos:checkout (বিল করা), inv:manage (পণ্য/স্টক বদলানো), accounts:manage (হিসাব)। Role হলো এমন অনুমতির বান্ডিল। সিস্টেমে ৭৬টি অনুমতি ১৩টি গ্রুপে সাজানো।',
            en: 'Permissions are grouped into 13 areas; roles bundle them.',
          },
          {
            kind: 'table',
            head: ['ভূমিকা', 'সাধারণত পারে'],
            rows: [
              ['ক্যাশিয়ার (CASHIER)', 'POS বিল, শিফট খোলা/বন্ধ, গ্রাহক দেখা ও তৈরি, বাকি আদায়, খরচ এন্ট্রি (সীমিত রিপোর্ট)'],
              ['ম্যানেজার (MANAGER)', 'ক্যাশিয়ারের সব + স্টক/ক্রয় দেখা, রিপোর্ট, রোল ছাড়া প্রায় সব দেখাশোনা'],
              ['অ্যাডমিন (ADMIN)', 'ক্যাশিয়ার+ম্যানেজারের সব, শাখা ও সেটিংস, অনুমোদন, ব্যবহারকারী, লয়্যালটি'],
              ['সুপার অ্যাডমিন (SUPER_ADMIN)', 'সব প্রতিষ্ঠানের সব — ব্যবহারকারী/রোল, ব্যাকআপ, অডিট, প্রতিষ্ঠান তৈরি, সেটিংস'],
            ],
          },
          {
            kind: 'note',
            bn: 'যে অনুমতি নেই, সেই মেনু/বোতাম আপনি দেখবেন না; সরাসরি লিংক দিয়ে গেলে সার্ভার “PERMISSION_DENIED” জানাবে। কোনো বোতাম খুঁজে না পেলে মালিককে বলুন রোল-এ সেই অনুমতি দেওয়ার জন্য (Users → Roles)।',
            en: 'Missing permission = the menu/button is hidden and the API refuses it.',
          },
        ],
      },
    ],
  },

  /* ═══════════════════════════ PART B ═══════════════════════════ */
  {
    titleBn: 'অংশ খ — নতুন ব্যবহারকারীর দৈনিক কাজ (ধাপে ধাপে)',
    titleEn: 'Part B — Daily work, step by step',
    summaryBn: 'সকালে শিফট খোলা থেকে রাতে Z-রিপোর্ট — একটি সাধারণ দিনের পুরো কাজ এই অংশে ক্রমানুসারে দেওয়া।',
    chapters: [
      {
        titleBn: '৫. দিন শুরু — শিফট খোলা',
        titleEn: 'Start of day — open the shift',
        blocks: [
          {
            kind: 'para',
            bn: 'বিল করার আগে শিফট খোলা জরুরি — এটি না খুললে POS-এ “NO SHIFT” দেখাবে এবং বিক্রয় হবে না।',
            en: 'No open shift = the till cannot bill.',
          },
          {
            kind: 'steps',
            items: [
              { bn: 'সাইডবার → Shifts → “Open Shift” চাপুন।', en: 'Shifts → Open Shift.' },
              { bn: '“Terminal / Counter ID” দিন (ডিফল্ট POS-01; একাধিক কাউন্টার থাকলে আলাদা নাম দিন)।', en: 'Terminal id, e.g. POS-01.' },
              { bn: '“Opening Float (৳)” — ড্রয়ারে যে টাকা দিয়ে শুরু করছেন সেটি লেখুন (গুনে)।', en: 'Count and enter the opening cash.' },
              { bn: '“Open Shift” চাপুন → কার্ডে “OPEN” ব্যাজ ও Opening Float দেখা যাবে।', en: 'Shift opens and the card turns OPEN.' },
            ],
          },
          { kind: 'note', bn: 'শিফট চলাকালে ব্যক্তিগত খরচ/টাকা ঢোকানো হলে Shifts পাতার “Petty Cash” দিয়ে লিখুন — নাহলে দিনশেষে ড্রয়ারের টাকা মিলবে না।', en: 'Record petty cash in/out so the drawer reconciles.' },
        ],
      },

      {
        titleBn: '৬. POS-এ বিক্রয় (সবচেয়ে জরুরি ধাপ)',
        titleEn: 'Selling at the POS',
        blocks: [
          { kind: 'sub', bn: '৬.১ পণ্য যোগ করা', en: 'Add items' },
          {
            kind: 'steps',
            items: [
              { bn: 'বারকোড স্ক্যানার দিয়ে স্ক্যান করুন; স্ক্যানার না থাকলে “Barcode Reader” ঘরে কোড লিখে Enter চাপুন।', en: 'Scan, or type the code and press Enter.' },
              { bn: 'নাম দিয়ে খুঁজতে “Product Search” (F2 দিয়ে কার্সর বসে) — কমপক্ষে ২ অক্ষর লেখুন; তালিকা থেকে “Add to Cart” চাপুন।', en: 'Product Search by name/SKU.' },
              { bn: 'ছবি-ভিত্তিক দ্রুত বিক্রয়ের জন্য “Catalog” বোতাম — ক্যাটাগরি বেছে পণ্যের ছবিতে চাপুন।', en: 'Catalog grid for touch selling.' },
              { bn: 'স্টকের বেশি যোগ করতে গেলে সফটওয়্যার “Max stock available: N” বলে থামিয়ে দেবে।', en: 'It refuses to sell beyond stock.' },
            ],
          },
          { kind: 'sub', bn: '৬.২ পরিমাণ বদলানো ও লাইন মুছা', en: 'Quantities & removing a line' },
          {
            kind: 'bullets',
            items: [
              { bn: 'পিস/বক্স জাতীয় পণ্যে –/+ চাপলে ১ করে বদলায়; কেজি/লিটার/গজ-এ ০.২৫ করে বদলায়।', en: 'Whole units step by 1; measured units by 0.25.' },
              { bn: 'একটি লাইন মুছতে সেটির ওপর ক্লিক করে Delete চাপুন বা ডাস্টবিন আইকনে চাপুন।', en: 'Highlight the line and press Delete.' },
              { bn: 'পুরো বিল বাতিল করতে Esc → “Cancel this sale and clear the cart?” — হ্যাঁ বললে সব খালি হবে।', en: 'Esc clears the whole ticket.' },
            ],
          },
          { kind: 'sub', bn: '৬.৩ ক্রেতা যোগ করা', en: 'Attach a customer' },
          {
            kind: 'steps',
            items: [
              { bn: '“Customer Info.” প্যানেলে “Member” বেছে নিন (চেনা খরিদ্দার), নইলে “General” রাখুন।', en: 'General or Member.' },
              { bn: '“Member ID” (F8) ড্রপডাউনে নাম বা ফোন লিখে গ্রাহক বেছুন; “Full Name” নিজে বসে যাবে।', en: 'Pick the member (F8).' },
              { bn: 'বাকিতে বিক্রয় করলে সিস্টেম ক্রেতার ক্রেডিট লিমিট দেখে — সীমা ছাড়ালে আটকে দেবে এবং “Outstanding due / limit” দেখাবে।', en: 'Customer Due is capped by credit limit.' },
            ],
          },
          { kind: 'sub', bn: '৬.৪ ডিসকাউন্ট ও লয়্যালটি পয়েন্ট', en: 'Discount & loyalty' },
          {
            kind: 'bullets',
            items: [
              { bn: '“Summary” প্যানেলের “Discount” ঘরে বিল-ভিত্তিক ছাড় লিখুন (৫০%-এর বেশি হলে ব্যবস্থাপকের অনুমোদন লাগবে)।', en: 'Bill discount; >50% needs a manager.' },
              { bn: 'গ্রাহকের পয়েন্ট থাকলে “Redeem” ঘরে পয়েন্ট লিখুন — ডান পাশে সমমূল্য ৳ দেখাবে, নিচে “Points” লাইনে বিয়োগ হয়ে যাবে।', en: 'Redeem points → live ৳ value.' },
              { bn: 'পয়েন্ট সংক্রান্ত ত্রুটি: “The customer does not have that many points” · “Minimum N points to redeem” · “Points can cover at most N% of this bill” — তখন পরিমাণ কমিয়ে দিন।', en: 'Clear error messages guide the cashier.' },
              { bn: 'ক্রেতা বদলালে পয়েন্ট আপনি নিজে থেকে মুছে যাবে (ভুল ক্রেতার পয়েন্ট যাতে না কাটে)।', en: 'Switching customer resets the redemption.' },
            ],
          },
          { kind: 'sub', bn: '৬.৫ পেমেন্ট ও রশিদ', en: 'Payment & receipt' },
          {
            kind: 'steps',
            items: [
              { bn: 'F12 (বা F9) চাপুন → “Payment & Tender” উইন্ডো আসবে।', en: 'F12 opens Payment & Tender.' },
              { bn: 'পেমেন্ট পদ্ধতি বেছে নিন: Cash · Card (POS) · bKash · Nagad · Customer Due (বাকি)।', en: 'Choose one method.' },
              { bn: 'Cash হলে “Cash Tendered” লিখুন (বা +100/+500/+1000, বা “Exact amount”); “Change to Return” নিজে হিসাব হবে।', en: 'Enter cash; change is calculated.' },
              { bn: '“Complete Sale (Enter)” চাপুন → ড্রয়ার খুলবে এবং “SALE RECEIPT” আসবে; সেখান থেকে Print দিন।', en: 'Complete the sale and print.' },
            ],
          },
          { kind: 'note', bn: 'বর্তমানে একটা বিলে একটিমাত্র পেমেন্ট পদ্ধতি নেওয়া যায় (স্প্লিট পেমেন্ট নেই)। দুইভাবে টাকা নিলে একটি বিল বাকিতে রেখে পরে Customers → Collect Due দিয়ে আদায় করুন।', en: 'One tender per bill; collect the balance later as a due payment.' },
          { kind: 'sub', bn: '৬.৬ কার্ট পাশে রাখা (Hold / Park)', en: 'Park a cart' },
          {
            kind: 'steps',
            items: [
              { bn: 'F4 (Hold / Park) চাপুন → নাম লিখুন (“Parked Cart” ডিফল্ট)।', en: 'F4 parks the cart with a label.' },
              { bn: 'আবার আনতে “Held Carts” বা Shift+F4 → তালিকা থেকে “Resume”।', en: 'Shift+F4 → Resume.' },
            ],
          },
          { kind: 'sub', bn: '৬.৭ টার্মিনালের শর্টকাট', en: 'POS keyboard shortcuts' },
          {
            kind: 'table',
            head: ['চাবি', 'কাজ'],
            rows: [
              ['F2', 'বারকোড ঘরে কার্সর'],
              ['F3', 'টার্মিনাল বন্ধ করে ড্যাশবোর্ডে যাওয়া'],
              ['F4 / Shift+F4', 'কার্ট পার্ক করা / পার্ক করা কার্টের তালিকা'],
              ['F8', 'ক্রেতা (Member ID) নির্বাচনে যাওয়া'],
              ['F9 / F12', 'পেমেন্ট উইন্ডো / বিল সম্পন্ন ও প্রিন্ট'],
              ['F11', 'নগদ গ্রহণের ঘরে কার্সর'],
              ['Delete', 'নির্বাচিত লাইন মুছা'],
              ['Ctrl+L', 'টার্মিনাল লক (PIN লাগবে)'],
              ['Esc / Enter', 'মোডাল বন্ধ / পেমেন্ট নিশ্চিত'],
            ],
          },
        ],
      },

      {
        titleBn: '৭. বিক্রয় ইতিহাস ও ফেরত (Return)',
        titleEn: 'Sales history & returns',
        blocks: [
          { kind: 'sub', bn: '৭.১ বিল খোঁজা ও প্রিন্ট', en: 'Find an invoice' },
          {
            kind: 'steps',
            items: [
              { bn: 'সাইডবার → Sales History → “Completed Sales”।', en: 'Sales History.' },
              { bn: 'উপরে ইনভয়েস নম্বর (যেমন INV-2026…) লিখে “Find” চাপুন; অথবা তালিকা থেকে খুঁজুন।', en: 'Search by invoice number.' },
              { bn: 'ইনভয়েস নম্বরে ক্লিক করলে বিস্তারিত পাতা (আইটেম, ট্যাক্স, ছাড়, গ্র্যান্ড টোটাল, পেমেন্ট) খুলবে।', en: 'The detail page shows items, tax and totals.' },
              { bn: 'প্রিন্ট করতে: “Print Receipt” (থার্মাল/স্লিপ) অথবা “Wholesale Invoice” (A4 ট্রেড ইনভয়েস, PDF ডাউনলোডসহ)।', en: 'Print Receipt or Wholesale Invoice (A4).' },
            ],
          },
          { kind: 'sub', bn: '৭.২ ফেরত নেওয়া', en: 'Processing a return' },
          {
            kind: 'steps',
            items: [
              { bn: 'ইনভয়েসের সারিতে লাল “Return” বোতাম (বা বিস্তারিত পাতায় “Process Return”) চাপুন।', en: 'Tap Return on the invoice.' },
              { bn: 'প্রতিটি পণ্যের “Return Qty (Max N)” লিখুন — বিক্রির বেশি লেখা যাবে না।', en: 'Enter return quantity per line.' },
              { bn: '“Item Condition” বেছে নিন: Resaleable (Restock) — স্টকে ফিরবে, নাকি Damaged (Wastage) — বাতিল হিসাবে যাবে।', en: 'Restock or wastage.' },
              { bn: '“Refund Disbursement”: Cash Refund (ড্রয়ার থেকে) নাকি Store Credit Voucher (ভবিষ্যতের জন্য ভাউচার)।', en: 'Cash refund or store credit.' },
              { bn: '“Manager PIN” (কমপক্ষে ৪ ডিজিট) ও “Reason for Return” লিখে “Authorize Return” চাপুন।', en: 'Manager PIN + reason, then authorize.' },
              { bn: 'সফল হলে “Return Processed Successfully!” এবং স্টোর ক্রেডিট হলে ভাউচার কোড দেখাবে।', en: 'A return number (and voucher code) is issued.' },
            ],
          },
          {
            kind: 'note',
            bn: 'স্টোর ক্রেডিট ভাউচারের কোড গ্রাহককে লিখে দিন — পরবর্তী বিলে সেটি টেন্ডার হিসাবে ব্যবহার করা যায় (Processed Returns ট্যাবে কোড দেখা যায়)।',
            en: 'The voucher code is listed on the Processed Returns tab.',
          },
        ],
      },

      {
        titleBn: '৮. দিনশেষ — শিফট বন্ধ ও Z-রিপোর্ট',
        titleEn: 'End of day — close shift & Z-report',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'দ্রব্যের সব টাকা গুনে নিন; Shifts পাতা → “Close Shift”।', en: 'Shifts → Close Shift.' },
              { bn: 'উপরের সারসংক্ষেপ দেখুন: Opening Float + Cash Sales + Petty Cash In − Cash Expenses − Petty Cash Out = Expected Cash।', en: 'The drawer summary is computed for you.' },
              { bn: '“Actual Cash Counted (৳)” ঘরে গোনা টাকা লিখুন → পার্থক্য দেখাবে (Surplus/Shortage)।', en: 'Enter counted cash; the difference shows.' },
              { bn: 'পার্থক্য ৳১০-এর বেশি হলে “Manager PIN Required” — ব্যবস্থাপকের PIN দিন।', en: 'Over ৳10 difference needs a manager PIN.' },
              { bn: 'চাইলে “Shift Notes” লিখে “Close Shift” চাপুন।', en: 'Close the shift.' },
              { bn: 'এরপর তালিকার Z-Report আইকনে ক্লিক করে রিপোর্ট দেখুন ও “Print Z-Report” দিন — এতে বিক্রয়, পেমেন্ট-ভিত্তিক বিভাজন, ড্রয়ার মিলকরণ, ফেরত ও স্বাক্ষরের জায়গা থাকে।', en: 'Open and print the Z-report.' },
            ],
          },
        ],
      },

      {
        titleBn: '৯. গ্রাহক ব্যবস্থাপনা ও বাকি আদায়',
        titleEn: 'Customers, dues & loyalty',
        blocks: [
          { kind: 'sub', bn: '৯.১ নতুন গ্রাহক যোগ করা', en: 'Add a customer' },
          {
            kind: 'steps',
            items: [
              { bn: 'Customers → “Add Customer”।', en: 'Customers → Add Customer.' },
              { bn: 'নাম (গ্রাহক/দোকান) ও ফোন নম্বর দিন — এই দুটি আবশ্যক। এছাড়া যোগাযোগকারী ব্যক্তি, ইমেইল, ঠিকানা ও “Credit Limit (৳)” দিন।', en: 'Name and phone are required.' },
              { bn: '“Save Customer” চাপুন।', en: 'Save.' },
            ],
          },
          { kind: 'sub', bn: '৯.২ বিদ্যমান গ্রাহক সম্পাদনা (বিস্তারিত ফিল্ড)', en: 'Edit a customer' },
          {
            kind: 'bullets',
            items: [
              { bn: 'মূল তথ্য: নাম, যোগাযোগকারী, ফোন, ইমেইল, ঠিকানা এবং “BIN / TIN” — এই নম্বরটি পাইকারি (Wholesale) ইনভয়েসে ছাপা হয়।', en: 'BIN/TIN prints on wholesale invoices.' },
              { bn: 'Price Tier: গ্রাহকের দামের স্তর (যেমন Dealer/Wholesaler) — POS-এ তার বিল নিজে থেকেই সেই ছাড়ে দাম নেবে।', en: 'Price tier prices the cart automatically.' },
              { bn: 'Credit Limit: সর্বোচ্চ কত টাকা বাকি রাখা যাবে।', en: 'Maximum allowable due.' },
              { bn: 'Account Status: Inactive করলে গ্রাহক আর কিনতে পারবেন না।', en: 'Inactive blocks purchases.' },
              { bn: 'লয়্যালটি পয়েন্ট শুধু Super Admin হাতে বদলাতে পারেন (অন্যরা গ্রাহকের পয়েন্ট দেখতে পারেন)।', en: 'Only a super admin overrides points.' },
            ],
          },
          { kind: 'sub', bn: '৯.৩ বাকি আদায় (Collect Due)', en: 'Collect a due payment' },
          {
            kind: 'steps',
            items: [
              { bn: 'Customers তালিকায় যার বাকি আছে তার পাশে “Collect Due” চাপুন (বাকি শূন্য হলে বোতামটি আসে না)।', en: 'Collect Due appears when a balance exists.' },
              { bn: 'টাকার পরিমাণ, তারিখ (আনলে দেরিতে এন্ট্রিও দিতে পারেন), টেন্ডার (Cash/bKash/Nagad/Bank Card) ও রেফারেন্স লিখুন।', en: 'Amount, date, tender and reference.' },
              { bn: '“Record Payment” চাপুন — ব্যালান্স কমে যাবে ও খতিয়ানে এন্ট্রি হবে।', en: 'The balance and ledger update.' },
            ],
          },
          { kind: 'sub', bn: '৯.৪ খতিয়ান ও লয়্যালটি বিবরণী', en: 'Ledger & loyalty statement' },
          {
            kind: 'bullets',
            items: [
              { bn: 'বাকির খতিয়ান: গ্রাহকের সারিতে খাতা আইকন (অথবা ইনভয়েস থেকে “View Bakir Khata Ledger”) — তারিখ, লেনদেন, ডেবিট/ক্রেডিট ও চলতি ব্যালান্স দেখা যায়।', en: 'Ledger shows every debit/credit.' },
              { bn: 'লয়্যালটি বিবরণী: “N pts” পিলে ক্লিক → ব্যালান্স, tier ব্যাজ, স্ট্যান্ডিং ভ্যালু, পরের tier-এর প্রগ্রেস এবং প্রতিটি পয়েন্ট নড়াচড়া (EARN/REDEEM/EXPIRE)।', en: 'Loyalty statement per customer.' },
            ],
          },
        ],
      },

      {
        titleBn: '১০. পণ্য, ক্যাটাগরি ও বারকোড লেবেল',
        titleEn: 'Products, categories & barcode labels',
        blocks: [
          { kind: 'sub', bn: '১০.১ নতুন পণ্য তৈরি', en: 'Create a product' },
          {
            kind: 'steps',
            items: [
              { bn: 'Products → “Add Product”।', en: 'Products → Add Product.' },
              { bn: '১. মূল তথ্য: পণ্যের নাম, ক্যাটাগরি (আবশ্যক), ব্র্যান্ড, পছন্দের সাপ্লায়ার, একক (Pcs/Kg/Box…), ভ্যাটের ধরন ও হার, বর্ণনা।', en: 'Name, category, unit, VAT.' },
              { bn: '“Show on online store” টিক দিলে পণ্যটি অনলাইন স্টোরফ্রন্টেও দেখাবে।', en: 'Publish to the storefront.' },
              { bn: '২. ভ্যারিয়েন্ট: “Add Variant” দিয়ে প্রতিটি রঙ/সাইজের জন্য Attribute name, SKU (অটো হয়, চাইলে বদলান), বারকোড, Cost/Retail/Wholesale দাম, Current Stock ও Alert Qty দিন।', en: 'One row per size/colour.' },
              { bn: '“Save Product” চাপুন। (পণ্য/ভ্যারিয়েন্ট মুছে ফেলা = নিষ্ক্রিয় করা — পুরনো বিক্রয়ের হিসাব নষ্ট হয় না।)', en: 'Save. Delete deactivates.' },
            ],
          },
          { kind: 'sub', bn: '১০.২ ক্যাটাগরি · ব্র্যান্ড · প্রোডাক্ট গ্রুপ', en: 'Taxonomy' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Categories: গাছের মতো প্রধান ও উপ-ক্যাটাগরি, ডিফল্ট ভ্যাটসহ (“+ Sub” দিয়ে উপ-শ্রেণি)।', en: 'Multi-level categories with default VAT.' },
              { bn: 'Brands: উৎপাদনকারীর নাম ও দেশ।', en: 'Brands & origin.' },
              { bn: 'Product Groups: নানা ক্যাটাগরির পণ্যকে একসাথে (যেমন “ঈদ কম্বো”) গ্রুপ করা — All Groups ও Tree View দুটো দৃশ্য আছে।', en: 'Cross-category grouping.' },
            ],
          },
          { kind: 'sub', bn: '১০.৩ বারকোড লেবেল ছাপা', en: 'Print barcode labels' },
          {
            kind: 'steps',
            items: [
              { bn: 'Products পাতার “Barcode Labels” (বা যেকোনো পণ্যের সারিতে বারকোড আইকন)।', en: 'Barcode Labels page.' },
              { bn: 'বাঁ দিকে পণ্য/ভ্যারিয়েন্ট বেছে নিন (নাম বা SKU দিয়ে খুঁজুন)।', en: 'Pick the variant.' },
              { bn: 'ডান দিকে হেডার লেখা, কপি সংখ্যা (১–২৪০) ও লেবেল কাগজের ধরন বেছে নিন — A4 গ্রিড (২৪/শিট), থার্মাল ৫০×৩০mm বা ৩৮×২৫mm।', en: 'Copies and paper format.' },
              { bn: 'কোন কোন অংশ ছাপবে টিক দিন (দোকানের নাম, পণ্যের নাম, SKU, বারকোড সংখ্যা, MRP) → প্রিভিউ দেখে “Print n Labels”।', en: 'Tick elements, then print.' },
            ],
          },
        ],
      },

      {
        titleBn: '১১. সাপ্লায়ার, ক্রয় আদেশ ও মাল গ্রহণ',
        titleEn: 'Suppliers, purchase orders & receiving',
        blocks: [
          { kind: 'sub', bn: '১১.১ সাপ্লায়ার যোগ করা', en: 'Add a supplier' },
          {
            kind: 'steps',
            items: [
              { bn: 'Suppliers → “Add Supplier”।', en: 'Add Supplier.' },
              { bn: 'কোম্পানির নাম, যোগাযোগকারী, ফোন (তিনটিই আবশ্যক), ইমেইল ও ঠিকানা দিন → “Save Supplier”।', en: 'Company, contact and phone are required.' },
              { bn: 'বাকি পরিশোধ করতে সারিতে “Pay” → পরিমাণ, কোন অ্যাকাউন্ট থেকে দিচ্ছেন এবং চেক/TrxID রেফারেন্স লিখুন। খতিয়ান দেখতে খাতা আইকনে ক্লিক করুন।', en: 'Pay dues from an account; view the ledger.' },
            ],
          },
          { kind: 'sub', bn: '১১.২ ক্রয় আদেশ (PO) তৈরি ও অনুমোদন', en: 'Raise & approve a PO' },
          {
            kind: 'steps',
            items: [
              { bn: 'Purchase Orders → “Create PO”।', en: 'Create PO.' },
              { bn: '১. সাপ্লায়ার ও সম্ভাব্য ডেলিভারির তারিখ বেছে নিন।', en: 'Supplier + expected date.' },
              { bn: '২. “Add Line Items”: পণ্য খুঁজে যোগ করুন, প্রতিটির Ordered Qty ও Unit Cost লিখুন।', en: 'Add products with qty and cost.' },
              { bn: '৩. ট্যাক্স ও পরিবহন খরচ দিয়ে Grand Total মিলিয়ে নিন → “Save as Draft” অথবা “Save & Mark as Ordered”।', en: 'Check totals, save as draft or ordered.' },
              { bn: 'নির্ধারিত সীমার (Settings → PO Approval Threshold) বেশি হলে PO “Awaiting approval” হবে; অনুমোদনকারী (approvals:manage / procurement:manage) “Approve” বা কারণসহ “Reject” করবেন।', en: 'Above the threshold a manager must approve.' },
              { bn: 'অনুমোদন ছাড়া ORDERED করা বা মাল গ্রহণ করা যাবে না — মেসেজ: “This purchase order is waiting for manager approval”।', en: 'Receiving is blocked until approved.' },
            ],
          },
          { kind: 'sub', bn: '১১.৩ মাল গ্রহণ (GRN) — স্টক ও সাপ্লায়ার হিসাব', en: 'Receive goods (GRN)' },
          {
            kind: 'steps',
            items: [
              { bn: 'দ্রুত পথ: Purchase Receive পাতা → “Receive all” → পরিমাণ ও পণ্য মিলিয়ে “Confirm receipt” (পুরো বাকি পরিমাণ একবারে স্টকে যায়)।', en: 'Receive all — books the whole outstanding qty.' },
              { bn: 'আংশিক পথ: PO-র সারিতে “Receive” বা বিস্তারিত পাতায় “Receive Goods (GRN)” → প্রতি লাইনে “Receiving Now (Max: …)” লিখুন; প্রয়োজনে Batch No ও Expiry Date (FEFO) দিন → “Receive & Update Stock”।', en: 'Per-line partial receipt with batch/expiry.' },
              { bn: 'চাইলে “Vendor invoice no.” লিখুন এবং “Paid now” দিলে সাপ্লায়ারকে সেই পরিমাণ পরিশোধ হিসাব হবে।', en: 'Vendor invoice + part payment.' },
              { bn: 'গ্রহণের পর সিস্টেম নিজে থেকেই: স্টক বাড়ায়, ওয়েটেড-অ্যাভারেজ কস্ট (WAC) ঠিক করে, ব্যাচ লিখে, সাপ্লায়ারের পাওনা বাড়ায় (Supplier Ledger: PO_GRN_BILL) এবং অ্যাকাউন্টিং জার্নাল পোস্ট করে।', en: 'Stock, WAC, batch, ledger and journal all post together.' },
            ],
          },
          {
            kind: 'note',
            bn: '“Receive all” চাপলে সম্ভাব্য সব প্রভাব একবারে বসে — তাই মাল হাতে পেয়ে, গুনে-মিলিয়ে তারপর চাপুন। ভুল হলে সহজে ফেরানোর পথ নেই; সেক্ষেত্রে Purchase Return (ডেবিট নোট) ব্যবহার করুন।',
            en: 'Receive all is irreversible — receive a purchase return instead if you over-booked.',
          },
          { kind: 'sub', bn: '১১.৪ ক্রয় ফেরত (ডেবিট নোট)', en: 'Purchase return / debit note' },
          {
            kind: 'steps',
            items: [
              { bn: 'Purchase Orders → “Returns”। ধাপ ১: যে PO-র বিপরীতে ফেরত দিচ্ছেন সেটি “Select” করুন (শুধু RECEIVED বা PARTIAL PO দেখাবে)।', en: 'Step 1 — pick the received PO.' },
              { bn: 'ধাপ ২: প্রতি লাইনে Return Qty (গ্রহণের বেশি নয়) ও কারণ বেছে নিন — Damaged / Expired / Wrong item / Quality issue / Over-delivered / Other; চাইলে নোট লিখুন।', en: 'Step 2 — quantities and reasons.' },
              { bn: 'ধাপ ৩: টাকা ফেরতের ধরন — Adjust against payable (খাতায় সমন্বয়), Cash refund, Bank transfer, বা Credit note for future purchase → “Confirm Return & Generate Debit Note”।', en: 'Step 3 — refund method.' },
              { bn: 'ডেবিট নোট প্রিন্ট করুন (“Print Debit Note”) এবং প্রয়োজনে পরে “Confirm” / “Mark refunded” দিয়ে স্ট্যাটাস এগিয়ে নিন।', en: 'Print the debit note; advance its status.' },
              { bn: 'সিস্টেম নিজে থেকে স্টক কমায়, সাপ্লায়ারের পাওনা কমায় ও জার্নাল পোস্ট করে (Dr Payable / Cr Inventory)।', en: 'Stock, payable and journals update.' },
            ],
          },
        ],
      },

      {
        titleBn: '১২. ইনভেন্টরি, স্টক ট্রান্সফার ও শাখা',
        titleEn: 'Inventory, stock transfer & branches',
        blocks: [
          { kind: 'sub', bn: '১২.১ স্টক দেখা ও ক্ষতি লেখা (Wastage)', en: 'Valuation & wastage' },
          {
            kind: 'steps',
            items: [
              { bn: 'Inventory পাতা → “On-Hand Stock Valuation” ট্যাবে খুঁজে দেখুন: WAC দাম, স্টক ও মোট মূল্য (কোন পণ্য কমে গেলে লাল/অ্যাম্বার ব্যাজ)।', en: 'See WAC value and low stock.' },
              { bn: 'নষ্ট/ফেলে দেওয়া মাল লিখতে “Write-off” (বা উপর থেকে “Record Wastage / Damage”) → পণ্য, পরিমাণ ও কারণ (যেমন Expired batch) দিয়ে “Write-off & Book Loss”।', en: 'Write off damaged stock with a reason.' },
              { bn: '“Wastage Audit History” ট্যাবে কে কখন কী লিখল তা দেখা যায় — হিসাবও (ক্ষতি) সাথে সাথে বসে যায়।', en: 'The audit tab shows who wrote it off.' },
            ],
          },
          { kind: 'sub', bn: '১২.২ শাখায়-শাখায় স্টক পাঠানো (Stock Transfer)', en: 'Branch to branch transfer' },
          {
            kind: 'steps',
            items: [
              { bn: 'Stock Transfers → “New Transfer” → From/To শাখা বেছে পণ্য যোগ করে পরিমাণ লিখুন (প্রতিটি শাখায় যত আছে তার বেশি নয়) → “Create transfer”।', en: 'Create the transfer with quantities.' },
              { bn: 'স্টাফ পাঠালে সেটি প্রথমে অনুমোদনের অপেক্ষায় যায় (Waiting Approval ট্যাব) — ব্যবস্থাপক “Approve & issue” বা কারণসহ “Reject” করবেন।', en: 'Staff requests need a manager approval.' },
              { bn: '“Issue” = মাল রওনা (স্ট্যাটাস IN TRANSIT)।', en: 'Issue dispatches it.' },
              { bn: 'গন্তব্য শাখায় “Incoming Stock” ট্যাব → “Receive stock” → গুনে “Confirm receipt” (যা পাওয়া গেছে তাই যোগ হবে; কম এলে বাকিটা যোগ হয় না)।', en: 'Receiving branch confirms what arrived.' },
              { bn: 'সব ধাপে স্ট্যাটাস: PENDING → IN_TRANSIT → RECEIVED, অথবা CANCELLED।', en: 'Statuses: PENDING → IN_TRANSIT → RECEIVED / CANCELLED.' },
            ],
          },
          { kind: 'sub', bn: '১২.৩ চেইন ড্যাশবোর্ড ও শাখার লাভ-ক্ষতি', en: 'Chain dashboard' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Chain Management পাতায় সব শাখার আজকের বিক্রয়, স্টক মূল্য, খোলা PO, কর্মীসংখ্যা একসাথে দেখা যায়।', en: 'Every branch in one view.' },
              { bn: 'নিচের “Profit & loss by branch” টেবিলে শাখাভিত্তিক রেভিনিউ, COGS, গ্রস প্রফিট, মার্জিন, খরচ ও নিট লাভ — শেষে “Chain total”।', en: 'Per-branch P&L with chain totals.' },
              { bn: '“Add Branch” দিয়ে নতুন শাখা (নাম, কোড BR-001, শহর, ফোন, ডিফল্ট দামের ধরন, হেড অফিস কিনা, নেগেটিভ স্টক অনুমতি?) তৈরি করা যায়।', en: 'Add branches with their own defaults.' },
            ],
          },
        ],
      },

      {
        titleBn: '১৩. দাম ব্যবস্থাপনা — Price Tier ও Volume Pricing',
        titleEn: 'Pricing — tiers & volume bands',
        blocks: [
          {
            kind: 'bullets',
            items: [
              { bn: 'Price Tier (দামের স্তর): যেমন Dealer/Distributor — একটি ছাড়ের হার (বিক্রয় মূল্যের উপর x%)। গ্রাহকের অ্যাকাউন্টে tier বসালে POS-এ তার বিল নিজে থেকেই সেই দামে হবে; কোনো পণ্যে চাইলে নির্দিষ্ট “fixed tier price” দেওয়া যায়।', en: 'A tier = a discount band assigned to customers.' },
              { bn: 'Volume / Trade Pricing: পরিমাণভিত্তিক ব্যান্ড — যেমন “১০+ নিলে ৫% ছাড়”, “৫০+ নিলে ৳২১০ দাম”। রিটেইল/হোলসেল/সব ক্রেতা — যাদের জন্য প্রযোজ্য তা বেছে নিন; “Max qty” খালি রাখলে ব্যান্ড খোলা থাকে; “Fixed price” দিলে ছাড়ের হারের চেয়ে সেটিই প্রাধান্য পায়।', en: 'Quantity bands that discount or fix the unit price.' },
              { bn: 'পরীক্ষা করুন: রুল ফর্মের নিচে “Pricing preview” — বেস দাম ও পরিমাণ দিলে ফলাফল দেখাবে (“<disc>% off” / “Fixed band price” / “No volume tier”)।', en: 'Use the preview calculator before saving.' },
              { bn: 'POS-এ প্রয়োগ হলে কার্টের লাইনে “VOLUME PRICE” বা “VOL −x%” ব্যাজ দেখা যাবে।', en: 'POS shows a volume badge on the line.' },
            ],
          },
        ],
      },

      {
        titleBn: '১৪. পাইকারি ইনভয়েস ও মূল্যতালিকা',
        titleEn: 'Wholesale invoice & price list',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'কোনো বিক্রয়ের বিস্তারিত পাতায় “Wholesale Invoice” চাপুন → A4 ট্রেড ইনভয়েস দেখা যাবে (লেটারহেড, ক্রেতার নাম-ঠিকানা-BIN/TIN, লাইনভিত্তিক ভ্যাট, গ্র্যান্ড টোটাল, বাকি, শর্তাবলি, দুই স্বাক্ষরের ঘর)।', en: 'A4 trade invoice from any sale.' },
              { bn: '“Print” দিয়ে সরাসরি ছাপুন বা “Download PDF” দিয়ে ফাইল নামান (খাতায় রেকর্ড থাকা তথ্যই ছাপা হয় — কোনো ভুয়া লাইন নয়)।', en: 'Print or download the PDF.' },
              { bn: 'সম্পূর্ণ পাইকারি মূল্যতালিকা: Products → “Wholesale Price List” — ক্যাটাগরি অনুযায়ী পণ্য, SKU, একক, খুচরা (কাটা দাগ) ও পাইকারি দাম; “Print” বা “Download PDF” (SR হাতে ডিলারকে দিতে পারেন)।', en: 'Printable trade catalogue by category.' },
            ],
          },
        ],
      },

      {
        titleBn: '১৫. ফিল্ড সেলস — টেরিটরি, রুট ও SR অর্ডার',
        titleEn: 'Field sales — territories, routes & SR orders',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'Distribution → “Territories & Routes”: আগে টেরিটরি (নাম+কোড) তৈরি করুন, তারপর রুট (কোন টেরিটরি, কোন কোন দিন সার্ভিস, দায়িত্বে কোন SR)।', en: 'Create territories, then routes with service days.' },
              { bn: 'রুটের “Shops” সংখ্যায় ক্লিক করলে সেই রুটের দোকানের তালিকা (নাম, ফোন, বাকি) দেখা যায় — এটি SR-এর দৈনিক কল-লিস্ট।', en: 'The route shop list is the SR call list.' },
              { bn: 'SR ফিল্ডে অর্ডার নিলে Distribution পাতার “SR Orders” ট্যাবে আসে (PENDING)। ব্যবস্থাপক “Confirm” করলে CONFIRMED, তারপর “Convert to Sale” চাপলে সত্যিকারের বিক্রয় ইনভয়েস তৈরি হয় এবং স্টক কমে।', en: 'SR order → confirm → convert to a real sale.' },
              { bn: 'ডিলার/হোলসেল গ্রাহকের জন্য ডেলিভারি পয়েন্ট ও বাকির সীমা Customers পাতায় সেট করুন।', en: 'Set dealer credit limits on the customer.' },
            ],
          },
        ],
      },

      {
        titleBn: '১৬. হিসাব — খরচ, জার্নাল ও বছর-শেষ',
        titleEn: 'Accounts — expenses, journals & year close',
        blocks: [
          { kind: 'sub', bn: '১৬.১ খরচ লেখা', en: 'Record an expense' },
          {
            kind: 'steps',
            items: [
              { bn: 'Expenses → “Add Expense” → খরচের ধরন/ক্যাটাগরি, পরিমাণ, তারিখ, কোন অ্যাকাউন্ট থেকে (নগদ/ব্যাংক), বিবরণ ও রেফারেন্স দিন।', en: 'Category, amount, account, note.' },
              { bn: 'বড়/অস্বাভাবিক খরচ নির্ধারিত নিয়মে অনুমোদনের অপেক্ষায় যেতে পারে — “Approvals” পাতা থেকে অনুমোদন হবে, তার আগে খতিয়ানে পোস্ট হয় না।', en: 'Some expenses await approval before posting.' },
            ],
          },
          { kind: 'sub', bn: '১৬.২ চার্ট অব অ্যাকাউন্টস ও জার্নাল ভাউচার', en: 'Chart of accounts & vouchers' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Accounts → “Chart of Accounts”: অ্যাসেট/লায়াবিলিটি/ইকুইটি/আয়/ব্যয় — হিসাবের প্রধান ছক।', en: 'Account heads used by every posting.' },
              { bn: '“Day Book / Journal”: দিনের সব ভাউচার; উপরে তারিখ/স্ট্যাটাস ছাঁকনি।', en: 'All vouchers by date with a status filter.' },
              { bn: '“New Journal Voucher”: দুই তরফা এন্ট্রি (ডেবিট = ক্রেডিট) — বড় ভাউচার অনুমোদন ছাড়া পোস্ট হয় না।', en: 'Balanced entries; large ones need approval.' },
              { bn: '“Opening Balances” ও “Year-End Closing”: বছরের প্রথম দিনের ব্যালান্স বসানো এবং বছর ক্লোজ করে পরের বছরে হস্তান্তর — সাধারণত সুপার অ্যাডমিনের কাজ; ক্লোজ করার পর পুরনো তারিখে ভাউচার লেখা বন্ধ হয়ে যায় (Closed Books)।', en: 'Opening balances and year-end close are super-admin tasks.' },
            ],
          },
          { kind: 'sub', bn: '১৬.৩ রিপোর্টের সাথে মিলিয়ে দেখা', en: 'Cross-check with reports' },
          {
            kind: 'para',
            bn: 'মাস শেষে Reports → Accounts: Trial Balance মিলছে কি না, P&L-এ লাভ-ক্ষতি, Balance Sheet-এ দায়-সম্পদ এবং Cash Flow দেখে নিন। ব্যাংক/নগদ অ্যাকাউন্টের ব্যালান্স Accounts পাতায় এবং ব্যাংক স্টেটমেন্টের সাথে মিলিয়ে দেখুন।',
            en: 'Reconcile using Trial Balance, P&L, Balance Sheet and Cash Flow.',
          },
        ],
      },

      {
        titleBn: '১৭. অন্যান্য মডিউল — দ্রুত ধাপ',
        titleEn: 'Other modules — quick steps',
        blocks: [
          { kind: 'sub', bn: '১৭.১ CRM — যোগাযোগ, ক্যাম্পেইন, টিকিট, লয়্যালটি', en: 'CRM' },
          {
            kind: 'bullets',
            items: [
              { bn: 'CRM → “Activities”: গ্রাহকের সাথে ফোন/ভিজিট/অভিযোগ লিখে রাখুন (কেন্দ্র, সময়সীমা ও যাকে দিয়েছেন)।', en: 'Log calls, visits and complaints.' },
              { bn: '“Campaigns”: SMS/WhatsApp/ফোন/ইমেইল ক্যাম্পেইন — কোন ক্রেতাশ্রেণি, কত খরচ/কত কেনা, কত দিন নিষ্ক্রিয় — সেই শর্তে তালিকা তৈরি করে চালান।', en: 'Segment-based campaigns.' },
              { bn: 'Support → Tickets: গ্রাহকের সমস্যা টিকিট করে অগ্রাধিকার ও স্ট্যাটাসে রাখুন; সময়মতো উত্তর না দিলে রিপোর্টে “breach” দেখাবে।', en: 'Track tickets and SLA breaches.' },
              { bn: 'Leads: সম্ভাব্য ক্রেতার নাম-ফোন লিখে ফলোআপ করুন; অর্ডার হলে গ্রাহক হিসাবে রূপান্তর করুন।', en: 'Capture leads and convert them.' },
              { bn: 'লয়্যালটি প্রোগ্রাম: Settings → Loyalty Programme পাতায় পয়েন্ট হার, পয়েন্টের ৳ মূল্য, সর্বনিম্ন রিডিম, সর্বোচ্চ % ছাড়, মেয়াদ (দিন) ও tier ল্যাডার (SILVER/GOLD/PLATINUM) ঠিক করুন; “Run expiry sweep now” দিয়ে মেয়াদোত্তীর্ণ পয়েন্ট এখনই বাতিল করতে পারেন।', en: 'Configure earning, redemption, expiry and tiers.' },
            ],
          },
          { kind: 'sub', bn: '১৭.২ HR — কর্মী, হাজিরা, ছুটি ও বেতন', en: 'HR & payroll' },
          {
            kind: 'bullets',
            items: [
              { bn: 'HR → Employees: কর্মীর নাম, পদ, বেতন, যোগদানের তারিখ ও প্রয়োজনীয় তথ্য দিয়ে যোগ করুন।', en: 'Employee records.' },
              { bn: 'Attendance: দৈনিক হাজিরা (উপস্থিত/ছুটি/অনুপস্থিত) লিখুন — বেতন হিসাবে এটিই ভিত্তি।', en: 'Daily attendance feeds payroll.' },
              { bn: 'Advances: কর্মীর অগ্রিম লিখুন; বেতন রানে সেটি সমন্বয় হবে।', en: 'Salary advances are adjusted.' },
              { bn: 'Payroll: মাস ও কর্মী বেছে বেতন রান চালান, পার্থক্য দেখে অনুমোদন/পরিশোধ করুন।', en: 'Run and post payroll.' },
              { bn: 'Leave Requests: কর্মীর ছুটির আবেদন আসে — অনুমোদন/বাতিল করুন; Leave Register রিপোর্টে ছুটি দেখুন।', en: 'Approve or reject leave.' },
            ],
          },
          { kind: 'sub', bn: '১৭.৩ ই-কমার্স ও কুরিয়ার', en: 'eCommerce & courier' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Ecommerce → Online Orders: অনলাইনে আসা অর্ডার দেখা, নিশ্চিত করা, প্রস্তুত করে কুরিয়ারে দেওয়া; স্টক কমে ও বিক্রয় হয়।', en: 'Process online orders.' },
              { bn: 'Courier: ডেলিভারি পার্টনার (Pathao/RedX বা নিজের ডেলিভারিম্যান) বেছে পাঠান; ট্র্যাকিং আইডি রাখুন।', en: 'Assign a courier and tracking id.' },
              { bn: 'সিএমডি (COD): কুরিয়ার টাকা নিয়ে এলেই অর্ডার PAID হবে — কুরিয়ার মিলকরণ/Reconciliation রিপোর্টে মিলিয়ে নিন।', en: 'COD turns paid when the courier settles.' },
            ],
          },
          { kind: 'sub', bn: '১৭.৪ প্রোডাকশন (BOM) ও আমদানি-রপ্তানি (LC)', en: 'Production & LC' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Production: আগে “BOM” তৈরি করুন (১ একক তৈরি পণ্যে কত কাঁচামাল লাগে), তারপর “Production Run” চালালে কাঁচামাল স্টক কমে ও তৈরি পণ্য স্টকে বাড়ে; খরচ গড় দামে যোগ হয়।', en: 'Define a BOM, then run production.' },
              { bn: 'Import/Export: LC তৈরি (ব্যাংক, সুবিধাভোগী, মুদ্রা, মেয়াদ) → প্রফর্মা ইনভয়েস → কমার্শিয়াল ইনভয়েস → মাল আসার পর “Landed cost” (ফ্রেইট/ডিউটি/অন্য খরচ) চালান, যেটি পণ্যের দামে বসে; সিএন্ডএফ এজেন্টের বিল ও পরিশোধ ঐ ট্যাবে লিখুন।', en: 'LC → proforma → commercial invoice → landed cost.' },
            ],
          },
          { kind: 'sub', bn: '১৭.৫ অনুমোদন (Approvals) ও প্রকল্প (Projects)', en: 'Approvals & projects' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Approvals: যেসব কাজ অনুমোদনের অপেক্ষায় (বড় PO, বড় খরচ, জার্নাল ভাউচার, LC) সেগুলো এক পাতায় — কে, কত টাকা, কত লেভেল, কত দিন অপেক্ষা — দেখে Approve/Reject করুন।', en: 'One inbox for every pending approval.' },
              { bn: 'Projects: প্রকল্প তৈরি করে (কোড, ক্রেতা, বাজেট, দায়িত্বপ্রাপ্ত) তার সাথে কেনাকাটা/খরচ যুক্ত করুন; “Project P&L” রিপোর্টে রেভিনিউ, খরচ, লাভ ও বাজেটের ব্যবহার দেখুন।', en: 'Job costing per project.' },
            ],
          },
        ],
      },

      {
        titleBn: '১৮. রিপোর্ট পড়া ও ডাউনলোড',
        titleEn: 'Reading & exporting reports',
        blocks: [
          {
            kind: 'para',
            bn: 'প্রতিটি মডিউলের নিজের “Reports & Analytics” থাকে (সাইডবারে ওই মডিউলের ড্রপডাউনে)। এছাড়া “All Reports” পাতায় সব রিপোর্ট মডিউল অনুযায়ী একসাথে সাজানো। রিপোর্ট পাতাগুলো: তারিখ সীমা (Period) দিন → Refresh → টেবিল/চার্ট দেখুন; উপরের PDF · Excel · CSV · Print বোতামে ফাইল নামান বা ছাপুন।',
            en: 'Every module carries its own reports; All Reports groups them by module.',
          },
          {
            kind: 'table',
            head: ['রিপোর্ট', 'কী দেখায়'],
            rows: [
              ['Sales Summary / Sales Insights', 'মোট বিক্রয়, ইনভয়েস, ট্যাক্স, ছাড়; দৈনিক বিক্রয় রেজিস্টার'],
              ['Category / Brand / Group Analysis', 'কোন ক্যাটাগরি/ব্র্যান্ড/গ্রুপ থেকে কত আয় ও কত লাভ'],
              ['Wholesale vs Retail', 'পাইকারি-খুচরা চ্যানেলের বিক্রয়, গড় বিল ও বাকি'],
              ['Purchase Analysis / Purchases', 'সাপ্লায়ারভিত্তিক ক্রয়, দাম তুলনা, ক্রয় বনাম বিক্রয়'],
              ['Inventory / Inventory Suite', 'স্টক ভ্যালুয়েশন, লেজার, মুভমেন্ট, মেয়াদোত্তীর্ণ, লো-স্টক, ডেড স্টক, রি-অর্ডার'],
              ['Barcode Tracker', 'একটি বারকোডের পুরো নড়াচড়া (কত ঢুকল/বেরুলো, ব্যালান্স)'],
              ['Customer Aging / Supplier Payable', 'গ্রাহকের বাকি বয়সভিত্তিক (০–৩০/৩১–৬০/৬১–৯০/৯০+) ও সাপ্লায়ারকে দেয়'],
              ['P&L · Trial Balance · Balance Sheet · Cash Flow', 'লাভ-ক্ষতি, রেওয়ামিল, উদ্বৃত্তপত্র, নগদ প্রবাহ'],
              ['Wastage', 'নষ্ট/ফেলে দেওয়া মালের ক্ষতি ও কারণ'],
              ['Loyalty Analytics', 'পয়েন্ট কত অর্জিত/ব্যবহৃত/মেয়াদোত্তীর্ণ, দায় (liability) কত, শীর্ষ গ্রাহক'],
              ['Business Operations', 'বিভাগভিত্তিক সমন্বিত চিত্র (বিক্রয়, ই-কমার্স, সিআরএম, এইচআর)'],
            ],
          },
          { kind: 'sub', bn: 'নিজে থেকেই ইমেইলে রিপোর্ট পাঠানো', en: 'Scheduled reports' },
          {
            kind: 'steps',
            items: [
              { bn: 'Scheduled Reports → “New” → রিপোর্টের ধরন, কত ঘন ঘন (দৈনিক/সাপ্তাহিক/মাসিক), কখন, কোন ফরম্যাট (PDF/Excel) ও কার ইমেইলে পাঠাবে লিখুন।', en: 'Pick the report, schedule, format and recipients.' },
              { bn: 'চালু রাখলে নির্দিষ্ট সময়ে সিস্টেম নিজেই ইমেইল করবে; “Run Now” দিয়ে সাথে সাথে পরীক্ষা করুন এবং “Last run” কলামে ফল দেখুন।', en: 'Run Now tests it immediately.' },
            ],
          },
        ],
      },
    ],
  },

  /* ═══════════════════════════ PART C ═══════════════════════════ */
  {
    titleBn: 'অংশ গ — সুপার অ্যাডমিন গাইড',
    titleEn: 'Part C — Super Admin guide',
    summaryBn: 'নতুন দোকান/শাখা চালু করা, ব্যবহারকারী ও রোল বানানো, সেটিংস ঠিক করা, ব্যাকআপ ও অডিট — প্রতিষ্ঠানের মালিকের অংশ।',
    chapters: [
      {
        titleBn: '১৯. প্রতিষ্ঠান (Organization) ব্যবস্থাপনা',
        titleEn: 'Managing organizations',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'সুপার অ্যাডমিন লগইনের পর “Organizations” পাতা — প্রতিটি প্রতিষ্ঠানের নাম, কোড, যোগাযোগ ও স্ট্যাটাস দেখা যায়।', en: 'The organizations list.' },
              { bn: '“New Organization” দিয়ে নতুন প্রতিষ্ঠান তৈরি করুন (নাম, কোড, ঠিকানা, যোগাযোগ)। একটি প্রতিষ্ঠান = একটি সম্পূর্ণ আলাদা দুনিয়া: তার নিজের পণ্য, বিক্রয়, হিসাব, ব্যবহারকারী।', en: 'Each organization is fully isolated.' },
              { bn: 'প্রতিষ্ঠান “Suspend” করলে তার কেউ ঢুকতে পারবে না; “Activate” করলে আবার চালু হবে।', en: 'Suspend or reactivate.' },
              { bn: 'কাজ শুরু করার আগে হেডারের OrgSwitcher থেকে সঠিক প্রতিষ্ঠান বেছে নিন — নাহলে সব অনুরোধ “ORG_CONTEXT_REQUIRED” জানাবে।', en: 'Always switch into the org you are working on.' },
            ],
          },
          {
            kind: 'note',
            bn: 'একাধিক প্রতিষ্ঠান থাকলে তথ্য কখনও মিশে যায় না: প্রতিটি প্রশ্ন নিজে থেকেই প্রতিষ্ঠান-নামসম্বলিত ফিল্টার পায়, আর অডিটে দেখা যায় কে কোন প্রতিষ্ঠানে কী করেছে।',
            en: 'Tenant isolation is enforced by the data layer, not by the UI.',
          },
        ],
      },

      {
        titleBn: '২০. ব্যবহারকারী ও পাসওয়ার্ড',
        titleEn: 'Users & passwords',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'Administration → Users → “Add User”: পূর্ণ নাম, ইউজারনেম, ইমেইল/ফোন, পাসওয়ার্ড, রোল এবং (থাকলে) শাখা বেছে দিন।', en: 'Create the login with a role and branch.' },
              { bn: 'ক্যাশের জন্য ৪ ডিজিটের POS PIN সেট করুন — এটিই টার্মিনাল লক খুলতে ব্যবহার হয়।', en: 'Set the 4-digit till PIN.' },
              { bn: 'কর্মী চলে গেলে বা পাসওয়ার্ড ভুলে গেলে ইউজারের পাতায় “Reset password” ব্যবহার করুন (তিনি ইমেইলও পেতে পারেন)। কাজ থেকে বিরত থাকলে অ্যাকাউন্ট Inactive করে দিন — মুছে ফেলার দরকার নেই, ইতিহাস থেকে যাবে।', en: 'Reset passwords; deactivate leavers.' },
              { bn: 'কোনো ব্যবহারকারীকে কোনো শাখায় বসাতে “Assign user to branch” ব্যবহার করুন — এরপর তার বিক্রয় ওই শাখার হিসাবে যাবে।', en: 'Assign users to branches.' },
            ],
          },
        ],
      },

      {
        titleBn: '২১. রোল ও অনুমতি (Permission)',
        titleEn: 'Roles & permissions',
        blocks: [
          {
            kind: 'steps',
            items: [
              { bn: 'Administration → Roles → “New Role” → নাম দিন (যেমন “স্টোর ম্যানেজার”)।', en: 'Create a role.' },
              { bn: 'অনুমতির ছকটি ১৩টি গ্রুপে সাজানো (POS ও বিক্রয় · ইনভেন্টরি · ক্রয় · গ্রাহক/সিআরএম · হিসাব ও খরচ · দাম · ফিল্ড সেলস · এইচআর · প্রোডাকশন · ই-কমার্স · রিপোর্ট · প্রশাসন) — যতটুকু দরকার শুধু সেটাই টিক দিন।', en: 'Tick only the permissions the role needs.' },
              { bn: 'মনে রাখুন: অনুমতি নেই মানে মেনু/বোতাম দেখা যাবে না এবং সার্ভারও অনুরোধ আটকে দেবে।', en: 'No permission = hidden menu and refused API.' },
              { bn: 'একই ধারণার রোল সব প্রতিষ্ঠানে আলাদা — এক প্রতিষ্ঠানের রোল বদলালে অন্যটি বদলায় না।', en: 'Roles are per organization.' },
            ],
          },
          {
            kind: 'table',
            head: ['কাজ', 'দরকারি অনুমতি'],
            rows: [
              ['বিল করা, শিফট চালানো', 'pos:checkout · shifts:operate'],
              ['ফেরত অনুমোদন', 'returns:authorize'],
              ['পণ্য/স্টক সম্পাদনা, ক্ষতি লেখা', 'inv:manage · inv:adjust'],
              ['বারকোড লেবেল ছাপা', 'inv:labels'],
              ['PO তৈরি/পরিবর্তন, মাল গ্রহণ, সাপ্লায়ার পেমেন্ট', 'procurement:manage · procurement:receive · procurement:pay'],
              ['অনুমোদন দেওয়া (বড় PO/খরচ/ভাউচার)', 'approvals:manage'],
              ['গ্রাহক তৈরি/সম্পাদনা, বাকি আদায়, খতিয়ান', 'customers:create · customers:manage · customers:pay_due · customers:edit_ledger'],
              ['লয়্যালটি নিয়ম বদলানো', 'crm:loyalty'],
              ['হিসাব/খরচ', 'accounts:manage · accounts:transfer · expenses:create'],
              ['রিপোর্ট দেখা/ডাউনলোড', 'reports:dashboard … reports:export'],
              ['ব্যবহারকারী, রোল, সেটিংস, ব্যাকআপ, অডিট', 'users:manage · roles:manage · settings:manage · audit:view'],
            ],
          },
        ],
      },

      {
        titleBn: '২২. সেটিংস — কোন সুইচ কী নিয়ন্ত্রণ করে',
        titleEn: 'Settings reference',
        blocks: [
          {
            kind: 'table',
            head: ['সেটিং', 'প্রভাব'],
            rows: [
              ['দোকানের নাম, ঠিকানা, ফোন, ইমেইল, লোগো', 'রশিদ, রিপোর্ট PDF, ইনভয়েস ও সাইডবারের লেটারহেড'],
              ['মুদ্রা প্রতীক (৳) ও ডিফল্ট ভ্যাট %', 'সব দাম, ট্যাক্স ও রিপোর্টের হিসাব'],
              ['নেগেটিভ স্টক অনুমতি', 'স্টক শূন্য হলেও বিক্রয় করা যাবে কি না'],
              ['মেমো প্রিন্ট মোড ও কাগজের মাপ', 'থার্মাল/কাস্টম সাইজে স্লিপ ছাপা'],
              ['রশিদের হেডার/ফুটার', 'যা রশিদের উপরে/নিচে ছাপা হয় (যেমন “Thank you, come again”)'],
              ['PO Approval Threshold (৳)', 'এই টাকার বেশি PO ব্যবস্থাপকের অনুমোদন ছাড়া অর্ডার করা যাবে না (০ = কখনও নয়)'],
              ['বারকোড লেবেল ফরম্যাট', 'লেবেল পাতা সাজানোর ডিফল্ট ধরন'],
              ['ক্যাশ ড্রয়ার ট্রিগার কোড', 'ক্যাশে বিল হলে ড্রয়ার খোলার ESC/POS কমান্ড'],
              ['বন্ধ খাতা (Books closed up to)', 'এই তারিখের আগে আর কোনো ভাউচার লেখা যাবে না (বছর ক্লোজিং)'],
            ],
          },
          {
            kind: 'note',
            bn: 'সেটিংস বদলানোর আগে ভাবুন — মুদ্রা, ভ্যাট বা ক্লোজড-ডেট বদলালে পুরনো হিসাব নতুনভাবে প্রতি-হিসাব হবে না, শুধু নতুন লেনদেন প্রভাবিত হবে।',
            en: 'Some settings only affect future transactions.',
          },
        ],
      },

      {
        titleBn: '২৩. ব্যাকআপ, অডিট ও রক্ষণাবেক্ষণ',
        titleEn: 'Backup, audit & maintenance',
        blocks: [
          {
            kind: 'bullets',
            items: [
              { bn: 'Backup: Administration → Backup — “Create backup” দিয়ে ফাইল নামিয়ে নিরাপদ জায়গায় রাখুন (মাসে অন্তত একবার এবং বছরের ক্লোজিংয়ের আগে অবশ্যই)। স্বয়ংক্রিয় ব্যাকআপ রাতে নির্দিষ্ট সময়ে চলে।', en: 'Take a backup before every year close.' },
              { bn: 'Audit Logs: কে, কখন, কোন পাতায় কী করল — ছাঁকনি (ব্যবহারকারী, তারিখ, কাজের ধরন) দিয়ে খুঁজে দেখা যায়; সন্দেহ হলে এখানেই প্রমাণ পাবেন।', en: 'Every sensitive action is recorded.' },
              { bn: 'নোটিফিকেশন: হেডারের ঘণ্টা আইকনে নতুন ঘটনা (নতুন বিক্রয়, কম স্টক, অনুমোদনের অপেক্ষা, বাকি সীমা ছাড়ানো, সিস্টেম) দেখা যায়; এক ক্লিকে সংশ্লিষ্ট পাতায় যাওয়া যায়।', en: 'The bell shows live events.' },
              { bn: 'রক্ষণাবেক্ষণ স্ক্রিপ্ট (ডেভেলপার/টেকনিশিয়ান): ইনডেক্স যাচাই (verify-indexes), মাল্টি-অর্গ মাইগ্রেশন ও ডেটা ব্যাকফিল — বছরে একবার বা আপগ্রেডের পর চালানো ভালো।', en: 'Index verification & migrations after upgrades.' },
            ],
          },
          {
            kind: 'note',
            bn: 'ব্যাকআপের ফাইল আর ডেটাবেস একই জায়গায় রাখবেন না; এবং payroll/বছর-ক্লোজিং-এর আগে সবসময় ফ্রেশ ব্যাকআপ নিন।',
            en: 'Keep backups off the machine that runs the shop.',
          },
        ],
      },
    ],
  },

  /* ═══════════════════════════ PART D ═══════════════════════════ */
  {
    titleBn: 'অংশ ঘ — সমস্যা ও সমাধান, পরিশিষ্ট',
    titleEn: 'Part D — Troubleshooting & annex',
    summaryBn: 'হঠাৎ কোনো সমস্যা হলে প্রথমে এই অংশ দেখুন — বেশিরভাগ সমস্যার সহজ সমাধান এখানেই আছে।',
    chapters: [
      {
        titleBn: '২৪. সাধারণ সমস্যা ও সমাধান',
        titleEn: 'Troubleshooting',
        blocks: [
          {
            kind: 'table',
            head: ['সমস্যা', 'সমাধান'],
            rows: [
              ['“Invalid username or password”', 'ইউজারনেম/পাসওয়ার্ড যাচাই করুন; Caps Lock বন্ধ করুন; ভুলে গেলে “Forgot password?” বা অ্যাডমিনকে বলুন।'],
              ['“Too many attempts…”', 'কিছুক্ষণ অপেক্ষা করুন (নিরাপত্তার জন্য অস্থায়ীভাবে বন্ধ থাকে)।'],
              ['“Cannot connect to server”', 'ইন্টারনেট/সার্ভার ঠিকানা দেখুন; মোবাইল ডেটায় বদলে চেষ্টা করুন; ব্রাউজারে Ctrl+Shift+R দিয়ে হার্ড রিফ্রেশ করুন।'],
              ['“ORG_CONTEXT_REQUIRED”', 'হেডারের OrgSwitcher থেকে প্রতিষ্ঠান নির্বাচন করুন।'],
              ['“PERMISSION_DENIED”', 'আপনার রোলে ওই অনুমতি নেই — মালিক/অ্যাডমিনকে বলুন।'],
              ['পর্দায় “NO SHIFT”', 'Shifts পাতা থেকে শিফট খুলুন — তারপর বিল করা যাবে।'],
              ['স্টক ০ দেখাচ্ছে কিন্তু মাল আছে', 'সঠিক শাখা নির্বাচন করা আছে কি না দেখুন; নাহলে Inventory → Stock Ledger-এ শেষ নড়াচড়া দেখে মিলিয়ে নিন ও প্রয়োজনে stock transfer/adjustment করুন।'],
              ['রশিদ প্রিন্ট হচ্ছে না', 'প্রিন্টার সেটিংস (মেমো মোড/কাগজের মাপ) দেখুন; ব্রাউজার প্রিন্ট ডায়ালগ খুললে সেখান থেকে সঠিক প্রিন্টার বেছে নিন।'],
              ['অফলাইনে বিল হয়েছে, সিঙ্ক হয়নি', 'নেট এনে “Sync N Sale(s)” চাপুন; লয়্যালটি পয়েন্ট তখন ব্যালান্স না মিললে সিঙ্ক স্পষ্ট বার্তা দেবে — Points দেখে ঠিক করে আবার চালান।'],
              ['রিপোর্টে পুরনো সংখ্যা', 'রিপোর্ট ৬০ সেকেন্ড ক্যাশ হয় — Refresh চাপুন বা এক মিনিট পরে দেখুন।'],
              ['ভুল গ্রাহককে পয়েন্ট রিডিম', 'রিডিম ক্রেতা বদলালেই বাতিল হয়ে যায়; বিল সম্পন্ন হয়ে গেলে ফেরত প্রক্রিয়ায় সমন্বয় করুন।'],
            ],
          },
        ],
      },

      {
        titleBn: '২৫. স্ট্যাটাস ও শব্দের অর্থ',
        titleEn: 'Status reference',
        blocks: [
          {
            kind: 'table',
            head: ['শব্দ', 'অর্থ'],
            rows: [
              ['PO: DRAFT → ORDERED → PARTIAL → RECEIVED / CANCELLED', 'খসড়া → অর্ডার দেওয়া → আংশিক এসেছে → পুরো এসেছে / বাতিল'],
              ['Approval: PENDING_APPROVAL → APPROVED / REJECTED / AUTO_APPROVED', 'অনুমোদনের অপেক্ষায় → অনুমোদিত / বাতিল / সীমার নিচে হওয়ায় নিজে থেকেই অনুমোদিত'],
              ['Stock transfer: PENDING → IN_TRANSIT → RECEIVED / CANCELLED', 'অপেক্ষায় → পথে → পৌঁছেছে / বাতিল'],
              ['Purchase return: DRAFT → CONFIRMED → REFUNDED', 'খসড়া → নিশ্চিত (স্টক/হিসাব বসেছে) → টাকা ফেরত সম্পন্ন'],
              ['SR order: PENDING → CONFIRMED → CONVERTED / CANCELLED', 'অপেক্ষায় → নিশ্চিত → বিক্রয় ইনভয়েসে রূপান্তরিত / বাতিল'],
              ['Tender: CASH · CARD · bKash · Nagad · STORE_CREDIT · CUSTOMER_DUE', 'নগদ · কার্ড · বিকাশ · নগদ (MFS) · দোকান ক্রেডিট · গ্রাহকের বাকি'],
              ['WAC', 'ওয়েটেড-অ্যাভারেজ কস্ট — স্টকের গড় ক্রয়মূল্য'],
              ['FEFO', 'যেটির মেয়াদ আগে শেষ হবে সেটি আগে'],
              ['GRN', 'মাল গ্রহণের দাখিলা (Goods Received Note)'],
              ['BIN / TIN', 'ব্যবসার ট্যাক্স নিবন্ধন নম্বর — পাইকারি ইনভয়েসে ছাপা হয়'],
            ],
          },
        ],
      },

      {
        titleBn: '২৬. অনুমতির তালিকা (Reference)',
        titleEn: 'Permission reference',
        blocks: [
          {
            kind: 'table',
            head: ['গ্রুপ', 'অনুমতি'],
            rows: [
              ['POS ও বিক্রয়', 'pos:checkout · sales:view · returns:authorize · shifts:operate · shifts:view'],
              ['ইনভেন্টরি', 'inv:view · inv:manage · inv:adjust · inv:labels'],
              ['ক্রয়', 'procurement:view · procurement:manage · procurement:receive · procurement:pay'],
              ['গ্রাহক ও সিআরএম', 'customers:view/create/manage/pay_due/edit_ledger · crm:view · crm:manage · crm:loyalty'],
              ['হিসাব ও খরচ', 'accounts:view/manage/transfer · expenses:view/create/manage'],
              ['দাম', 'pricing:manage'],
              ['ফিল্ড সেলস', 'sr:view · sr:manage · sr:operate · dealer:manage · distribution:manage'],
              ['এইচআর', 'hr:view · hr:manage · hr:attendance · hr:payroll'],
              ['প্রোডাকশন', 'production:view · production:manage · production:execute'],
              ['ই-কমার্স', 'ecom:view · ecom:manage'],
              ['রিপোর্ট', 'reports:dashboard · sales · inventory · purchases · dues · payables · pnl · export'],
              ['প্রশাসন', 'audit:view · settings:manage · users:view/manage · roles:view/manage · approvals:manage'],
            ],
          },
        ],
      },

      {
        titleBn: '২৭. সহায়তা ও যোগাযোগ',
        titleEn: 'Support',
        blocks: [
          {
            kind: 'bullets',
            items: [
              { bn: 'সমস্যা জানানোর সময় দেবেন: লগইন করা ব্যবহারকারীর নাম, প্রতিষ্ঠানের নাম, পর্দার ঠিকানা (URL),time ও সমস্যার স্ক্রিনশট বা “Trace ID”।', en: 'Always include user, org, URL, time and a screenshot.' },
              { bn: 'যে কোনো সংবেদনশীল কাজের (বছর ক্লোজ, পুরনো ভাউচার সংশোধন, ইনডেক্স মাইগ্রেশন) আগে ব্যাকআপ নিন।', en: 'Back up before sensitive operations.' },
              { bn: 'এই ম্যানুয়ালটি সফটওয়্যারের সংস্করণের সাথে বদলায়; নতুন ফিচার যোগ হলে নতুন সংস্করণ দেখে নিন (“Software by” অংশে যোগাযোগের তথ্য থাকে)।', en: 'Ask for the matching manual version after upgrades.' },
            ],
          },
        ],
      },
    ],
  },
  /* ═══════════════════════════ PART E ═══════════════════════════ */
  {
    titleBn: 'অংশ ঙ — ডেস্কটপ ইনস্টল, লাইসেন্স ও সাবস্ক্রিপশন',
    titleEn: 'Part E — Desktop install, licence and subscription',
    summaryBn:
      'যে দোকান অনলাইন ছাড়াই নিজের পিসিতে চালাবে — MongoDB ইনস্টল থেকে অ্যাপ ইনস্টল, লাইসেন্স অ্যাক্টিভেশন ও মেয়াদ শেষের সময় কী করতে হবে, সব ধাপে ধাপে।',
    chapters: [
      {
        titleBn: '২৮. ডেস্কটপ অ্যাপ ইনস্টল (Windows)',
        titleEn: 'Installing the desktop app',
        blocks: [
          {
            kind: 'para',
            bn: 'ডেস্কটপ সংস্করণ দোকানের নিজের পিসিতে চলে — বিক্রি, স্টক সব লোকালি জমা থাকে, তাই ইন্টারনেট না থাকলেও বিক্রি বন্ধ হয় না। এর জন্য পিসিতে আগে MongoDB (ডেটাবেস) ইনস্টল করতে হয়, তারপর BDBBC POS Desktop ইনস্টল করতে হয়। অ্যাপ নিজে থেকেই ওই ডেটাবেসের সাথে যুক্ত হয়ে যায়।',
            en: 'Runs on the shop PC with a local MongoDB, so it keeps selling offline. The app links to that database automatically.',
          },
          { kind: 'sub', bn: 'দরকার', en: 'Requirements' },
          {
            kind: 'bullets',
            items: [
              { bn: 'Windows ১০ বা ১১ (৬৪-বিট)।', en: 'Windows 10/11 (64-bit).' },
              { bn: '৩টা পোর্ট খালি থাকতে হবে: 27017, 5000, 3000 — অন্য কোনো প্রোগ্রাম যেন এগুলো দখল না করে।', en: 'Ports 27017, 5000, 3000 must be free.' },
            ],
          },
          { kind: 'sub', bn: 'ধাপ ১ — MongoDB ইনস্টল', en: 'Step 1 — Install MongoDB' },
          {
            kind: 'steps',
            items: [
              { bn: 'MongoDB Community Server (Windows x64) MSI ইনস্টল করুন।', en: 'Install the MongoDB Community Server MSI.' },
              { bn: 'ইনস্টলের সময় “Install MongoDB as a Service” টিক দিন (সাধারণত ডিফল্ট থাকে)।', en: 'Tick “Install MongoDB as a Service”.' },
              { bn: 'সার্ভিস চালু আছে কি না দেখুন: Windows Services (services.msc) → MongoDB → Running।', en: 'Confirm the MongoDB service is running.' },
            ],
          },
          { kind: 'sub', bn: 'ধাপ ২ — ডেটাবেসকে replica set বানান (বাধ্যতামূলক)', en: 'Step 2 — replica set (required)' },
          {
            kind: 'note',
            bn: 'সাধারণ MongoDB ইনস্টল standalone হয়, কিন্তু BDBBC POS-এর বিক্রয়, ফেরত, wastage, ফান্ড ট্রান্সফার — সব অল-অর-নাথিং লেনদেন (transaction) ব্যবহার করে, যা শুধু replica set-এ চলে। তাই এই ধাপ বাদ দিলে প্রথম বিক্রিতেই সমস্যা আসবে।',
            en: 'Transactions require a replica set — do not skip this step.',
          },
          {
            kind: 'steps',
            items: [
              { bn: 'সহজ উপায়: “8-SETUP-MONGODB-REPLSET.bat” ফাইলটি ডান-ক্লিক করে “Run as administrator” দিন — এটা config ঠিক করে, service restart করে, আর replica set চালু করে দেয়।', en: 'Run 8-SETUP-MONGODB-REPLSET.bat as Administrator.' },
              { bn: 'ম্যানুয়ালি: mongod.cfg-এ replication: replSetName: rs0 যোগ করে MongoDB service restart দিন।', en: 'Or add replication.replSetName: rs0 to mongod.cfg and restart.' },
              { bn: 'এরপর একবার rs.initiate() চালান।', en: 'Then run rs.initiate() once.' },
            ],
          },
          { kind: 'sub', bn: 'ধাপ ৩ — অ্যাপ ইনস্টল', en: 'Step 3 — Install the app' },
          {
            kind: 'steps',
            items: [
              { bn: '“BDBBC POS Desktop Setup.exe” ডাবল-ক্লিক করে Next → Next → Install।', en: 'Run the installer.' },
              { bn: 'প্রথমবার Windows সতর্কতা এলে “More info → Run anyway” দিন (অ্যাপটা code-signed নয়)।', en: 'Allow the unsigned app.' },
              { bn: 'ডেস্কটপ শর্টকাট থেকে BDBBC POS খুলুন।', en: 'Open BDBBC POS from the shortcut.' },
            ],
          },
          {
            kind: 'note',
            bn: 'যদি “MongoDB is not running” লেখা আসে — MongoDB সার্ভিস চালু নেই। ধাপ ১–২ আবার দেখুন।',
            en: 'If “MongoDB is not running” appears, re-check steps 1–2.',
          },
        ],
      },
      {
        titleBn: '২৯. লাইসেন্স অ্যাক্টিভেশন ও সাবস্ক্রিপশন',
        titleEn: 'Licence activation and subscription',
        blocks: [
          {
            kind: 'para',
            bn: 'অ্যাপ প্রথমবার খুললে একটা অ্যাক্টিভেশন পর্দা আসে। সরবরাহকারী যে license key দিয়েছেন সেটা পেস্ট করে Activate চাপলে অ্যাপ চালু হয় এবং যত দিনের মেয়াদ কেনা হয়েছে তত দিন চলে।',
            en: 'Paste the license key your provider gave you, then Activate.',
          },
          {
            kind: 'steps',
            items: [
              { bn: 'দেওয়া license.key ফাইলটা Notepad দিয়ে খুলে পুরো লাইনটা কপি করুন।', en: 'Copy the whole key from license.key.' },
              { bn: 'অ্যাপের অ্যাক্টিভেশন পর্দায় পেস্ট করে “Activate” চাপুন।', en: 'Paste and press Activate.' },
              { bn: 'এরপর প্রথম লগইন: ব্যবহারকারী admin, পাসওয়ার্ড Admin@123 — সাথে সাথে পাসওয়ার্ড বদলে নিন।', en: 'First login admin / Admin@123 — change it at once.' },
            ],
          },
          { kind: 'sub', bn: 'মেয়াদ শেষ হওয়ার আগে', en: 'Before expiry' },
          {
            kind: 'bullets',
            items: [
              { bn: 'মেয়াদ শেষ হওয়ার ১৫ দিন আগে থেকে অ্যাপ উপরে একটা হলুদ সতর্কবার্তা দেখায় — তখনই সরবরাহকারীকে জানিয়ে নতুন key নিয়ে নিন।', en: 'A yellow warning appears within 15 days of expiry.' },
              { bn: 'মেয়াদ শেষ হলেও কয়েক দিনের grace থাকে; তারপর অ্যাপ “Software Locked” পর্দায় চলে যায়।', en: 'A grace window, then the app locks.' },
            ],
          },
          { kind: 'sub', bn: '“Software Locked” পর্দায় কী করবেন', en: 'On the Software Locked screen' },
          {
            kind: 'steps',
            items: [
              { bn: 'নতুন license key বা renewal key (যেমন POS-XXXXXXXX-30D) হাতে নিন।', en: 'Get the new licence / renewal key.' },
              { bn: 'Software Locked পর্দায় key পেস্ট করে Activate চাপুন।', en: 'Paste it and Activate.' },
              { bn: 'সফল হলে মেয়াদ বাড়বে আর অ্যাপ আবার চালু হবে — ডেটা মুছে যাবে না।', en: 'The term extends and the app unlocks; data is untouched.' },
            ],
          },
          {
            kind: 'note',
            bn: 'মেয়াদ শেষ মানে শুধু অ্যাপ বন্ধ — আপনার ডেটা কখনো মুছে যায় না। নতুন key দিলেই সব আগের মতো ফিরে আসে।',
            en: 'Expiry locks access only — your data is never lost.',
          },
        ],
      },
    ],
  },
];
