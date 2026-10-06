# VPS-এ নিজের সার্ভারে চালানো (Global, Vercel ছাড়া) — ধাপে ধাপে

এই গাইডে আপনার পুরো প্রজেক্ট (backend + frontend + MongoDB) **নিজের একটা VPS**-এ চালাবেন।
ফলে Vercel/Railway-এর free limit শেষ হলেও **পৃথিবীর যেকোনো জায়গা থেকে** ব্রাউজারে `https://আপনার-ডোমেইন` দিয়ে পুরো ERP চলবে — কোনো limit নেই।

> উদাহরণ: Ubuntu 22.04 VPS + Nginx + PM2 + Node 20। VPS প্রোভাইডার যেকোনো হতে পারে
> (আপনার নিজের সার্ভার বা ক্লাউডে মাসিক একটা ছোট instance)।

---

## ০) যা লাগবে
- একটা Ubuntu VPS (কমপক্ষে 1 vCPU / 1 GB RAM; 2 GB আরামদায়ক)
- একটা **ডোমেইন** (তার DNS-এর A record VPS-এর IP-তে পয়েন্ট করা)
- VPS-এ SSH অ্যাক্সেস (root/sudo)

---

## ১) VPS-এ বেসিক সফটওয়্যার
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (প্রসেস ম্যানেজার)
sudo npm install -g pm2
```

## ২) MongoDB
**অপশন ক — VPS-এ লোকাল MongoDB:** (আপনার নিজের ডেটা নিজের সার্ভারে)
```bash
sudo apt install -y mongodb-org   # অথবা official MongoDB apt repo যোগ করে ইনস্টল
sudo systemctl enable --now mongod
```
**অপশন খ — MongoDB Atlas (managed cloud):** কিছু ইনস্টল না করে শুধু Atlas-এর connection string `MONGODB_URI`-তে বসাবেন।

> দ্রুত শুরু করতে Atlas সুবিধাজনক; নিজের সার্ভারে localized থাকতে চাইলে লোকাল MongoDB।

## ৩) কোড নামান + backend এনভায়রনমেন্ট
```bash
sudo mkdir -p /var/www && cd /var/www
git clone https://github.com/zikoislam/point-of-sale-webbase.git pos
cd pos
```

`backend/.env` বানান:
```bash
cp deploy/backend.env.example backend/.env
nano backend/.env
```
সেট করুন:
- `MONGODB_URI` — আপনার DB (লোকাল হলে `mongodb://127.0.0.1:27017/pos_db`)
- `JWT_SECRET` — `openssl rand -hex 32` দিয়ে বানিয়ে বসান
- `CLIENT_URL=https://আপনার-ডোমেইন` (শেষে স্ল্যাশ ছাড়া)
- দরকার হলে `SUBSCRIPTION_*`, `BACKUP_*`

## ৪) Build
```bash
# Backend
cd /var/www/pos/backend
npm ci
npm run build            # tsc → dist/

# Frontend (Next.js standalone)
cd /var/www/pos/frontend
npm ci
npm run build            # output: 'standalone' next.config.mjs-এ আছে

# Next standalone-এ static ও public কপি করতে হয়
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

## ৫) PM2 দিয়ে চালু
```bash
cd /var/www/pos
pm2 start deploy/ecosystem.config.js     # pos-api (5000) + pos-web (3000)
pm2 save
pm2 startup                              # boot-এ auto-start (দেওয়া কমান্ডটা চালান)
pm2 status
```
পরীক্ষা: `curl -s http://127.0.0.1:5000/api/v1/health` → `{"success":true,...}` এলে backend ঠিক।

## ৬) Nginx + HTTPS (ডোমেইন)
```bash
sudo cp deploy/nginx.pos.conf /etc/nginx/sites-available/pos
sudo nano /etc/nginx/sites-available/pos     # server_name আপনার ডোমেইন দিন
sudo ln -s /etc/nginx/sites-available/pos /etc/nginx/sites-enabled/pos
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# ফ্রি SSL (Let's Encrypt) — HTTPS বাধ্যতামূলক (auth cookie SameSite=None; Secure)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d আপনার-ডোমেইন
```
এরপর `https://আপনার-ডোমেইন` খুললে লগইন পেজ আসবে।

## ৭) ফায়ারওয়াল
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```
(শুধু 80/443 ও SSH খোলা থাকবে; 3000/5000 শুধু লোকাল।)

## ৮) Super Admin — প্রতি shop সেটআপ
1. `https://আপনার-ডোমেইন` → `admin` / `Admin@123` (সাথেই পাসওয়ার্ড বদলান)।
2. **Organizations** → প্রতিটা shop-এর জন্য **New Organization** (তাদের নাম/যোগাযোগ + permission envelope)।
3. প্রতিটা org-এর **admin user** বানান (Manage → Add member)।
4. **Plans** পেজে Plan 1/2/3 (duration + price + feature + permission set) বানান, তারপর org-এর Manage → License থেকে **plan বেছে key** generate করে shop-কে দিন।
   - Shop সেটা `https://আপনার-ডোমেইন/locked`-এ redeem করলে subscription বাড়বে, আর plan-এর permission set ওই org-এ সেট হবে।
- প্রতিটা shop শুধু **নিজের org-এর ডেটা** দেখবে (orgId দিয়ে আলাদা)।

## ৯) (ঐচ্ছিক) ডেস্কটপ exe-গুলোর সাথে sync
- প্রতিটা shop-এর PC-র `%APPDATA%\BDBBC POS\config.json`-এ `cloudMongoUri` = এই সার্ভারের DB (বা Atlas) দিলে exe ইন্টারনেট থাকলে sync করবে, না থাকলে লোকালি চলবে।
- ⚠ আলাদা কোম্পানিকে **একই DB**-তে দিলে ডেটা মিশে যাবে; আলাদা রাখতে **প্রতি shop = আলাদা org** অথবা **আলাদা DB**।

## ১০) আপডেট
```bash
cd /var/www/pos
git pull
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
cd .. && pm2 restart pos-api pos-web
```

## ১১) ব্যাকআপ
- অ্যাপের **Backup** পেজ থেকে manual snapshot, বা `backend/.env`-এ `BACKUP_AUTO_ENABLED=true` (daily auto)।
- MongoDB: মাঝে মাঝে `mongodump`/`mongorestore`।
- `backend/uploads/` (লোগো/অ্যাভাটার) আলাদা কপি রাখুন।

## ট্রাবলশুট
- **`Missing script: build` / tsc not found (Railway-এ):** Vercel-এর মতোই — backend root `backend` আর `NODE_CONFIG_PRODUCTION=false` (VPS-এ সমস্যা হয় না, শুধু managed host-এ)।
- **লগইনের পর সাথে সাথে সেশন চলে যায়:** HTTPS নেই বা `CLIENT_URL` ভুল → certbot + সঠিক ডোমেইন।
- **`/api` 404:** Nginx-এ `/api/` proxy ব্লক ঠিক আছে কি না দেখুন।
- **Socket.io কানেক্ট করছে না:** `/socket.io/` ব্লকে `Upgrade`/`Connection` header আছে কি না দেখুন (`nginx.pos.conf`-এ দেওয়া আছে)।
- **DB কানেক্ট হচ্ছে না:** Atlas হলে Network Access-এ VPS IP (বা `0.0.0.0/0`) allow করা আছে কি না দেখুন।

---
সংশ্লিষ্ট ডক: [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`DESKTOP-BN.md`](./DESKTOP-BN.md) · [`DESKTOP-EXTERNAL-MONGODB.md`](./DESKTOP-EXTERNAL-MONGODB.md) · [`NEW-SHOP-BN.md`](./NEW-SHOP-BN.md)
