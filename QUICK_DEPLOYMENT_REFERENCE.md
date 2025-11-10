# ⚡ Quick Deployment Reference

Hızlı referans için özet deployment bilgileri.

---

## 📦 Repository'ler

| Component | Repository | URL |
|-----------|------------|-----|
| **Frontend** | clickcreate/CCSnapshotApp | https://github.com/clickcreate/CCSnapshotApp |
| **Sync Worker** | clickcreate/CCSnapshotWorker | https://github.com/clickcreate/CCSnapshotWorker |

---

## 🚀 Vercel (Frontend)

### Temel Ayarlar
```
Repository: clickcreate/CCSnapshotApp
Root Directory: ClickFrontEnd ⭐ (ÇOK ÖNEMLİ!)
Framework: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### Environment Variables (6 adet)

| Variable | Environment | Nereden? |
|----------|-------------|----------|
| `POSTGRES_URL` | Production, Preview | Neon/Supabase |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Production, Preview, Development | Alchemy.com |
| `OPENSEA_API_KEY` | Production, Preview | OpenSea API |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Production, Preview, Development | Reown Cloud |
| `JWT_SECRET` | Production, Preview | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Production | `https://snapshot.clickcreate.io` |

### Domain
```
Domain: snapshot.clickcreate.io
DNS: CNAME → cname.vercel-dns.com
SSL: Auto (Vercel)
```

---

## ⚙️ Render (Sync Worker)

### Temel Ayarlar
```
Repository: clickcreate/CCSnapshotWorker
Name: ccsnapshot-worker
Region: Oregon (US West)
Branch: main
Build Command: npm install
Start Command: npm start
Instance Type: Starter (Free)
```

### Environment Variables (3 adet)

| Variable | Value |
|----------|-------|
| `POSTGRES_URL` | Vercel ile aynı! |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Vercel ile aynı! |
| `PORT` | `3001` |

### Health Check
```
URL: https://ccsnapshot-worker.onrender.com/health
Expected: {"status":"healthy","database":"connected"}
```

---

## 🔑 API Keys Toplama

### 1. Neon Database (5 dakika)
```
URL: https://neon.tech
Action: Create Project → CCSnapshotApp
Output: postgres://user:pass@host.neon.tech/db?sslmode=require
```

### 2. Alchemy (5 dakika)
```
URL: https://www.alchemy.com
Action: Create App → Ethereum Mainnet
Output: API Key (örn: xyz123abc456)
```

### 3. OpenSea (1-2 gün approval)
```
URL: https://docs.opensea.io/reference/api-keys
Action: Request API Key
Output: API Key
Note: Olmadan da çalışır (metadata gelmez)
```

### 4. WalletConnect/Reown (3 dakika)
```
URL: https://cloud.reown.com
Action: Create Project → AppKit → Add domain
Domain: snapshot.clickcreate.io
Output: Project ID
```

### 5. JWT Secret (1 dakika)
```bash
# Mac/Linux:
openssl rand -base64 32

# Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Online:
https://generate-secret.vercel.app/32
```

---

## 📋 Deployment Sırası

### Adım 1: Database Setup (10 dakika)
1. Neon'da project oluştur
2. Connection string'i kopyala
3. SQL Editor'de `ClickFrontEnd/database/multi-contract-schema.sql` çalıştır
4. Tüm tabloların oluştuğunu kontrol et

### Adım 2: API Keys (15 dakika)
1. Alchemy key al
2. WalletConnect ID al
3. JWT secret generate et
4. OpenSea key iste (beklerken devam edilebilir)

### Adım 3: Vercel Deploy (15 dakika)
1. New Project → Import CCSnapshotApp
2. Root Directory: **ClickFrontEnd** ⭐
3. 6 environment variable ekle
4. Deploy
5. Test: deployment URL'ini aç

### Adım 4: Custom Domain (5-30 dakika)
1. Vercel → Settings → Domains
2. snapshot.clickcreate.io ekle
3. DNS: CNAME kaydı ekle
4. Propagation bekle
5. Test: https://snapshot.clickcreate.io

### Adım 5: Render Deploy (10 dakika)
1. New Web Service → CCSnapshotWorker
2. Settings yapılandır
3. 3 environment variable ekle (POSTGRES_URL aynı!)
4. Deploy
5. Test: /health endpoint

### Adım 6: Final Test (5 dakika)
1. snapshot.clickcreate.io aç
2. Wallet bağla
3. Collection ekle: `0x300e7a5fb0ab08af367d5fb3915930791bb08c2b`
4. Snapshot generate et
5. CSV/JSON export test

**Toplam Süre:** ~1 saat (DNS propagation hariç)

---

## ✅ Verification Checklist

### Frontend (Vercel)
- [ ] Homepage açılıyor (https://snapshot.clickcreate.io)
- [ ] SSL aktif (🔒 kilidi)
- [ ] Wallet connection çalışıyor
- [ ] Navigation çalışıyor
- [ ] Console'da hata yok

### Sync Worker (Render)
- [ ] Status: Live (yeşil)
- [ ] Health check: healthy
- [ ] Logs: "Database connected"
- [ ] Logs: "Service ready on port 3001"
- [ ] Hata mesajı yok

### Database (Neon)
- [ ] Connection active
- [ ] Tüm tablolar var (contracts, events, current_state, etc.)
- [ ] Vercel'den bağlanabiliyor
- [ ] Render'dan bağlanabiliyor

### Full Flow Test
- [ ] Wallet bağlanıyor
- [ ] Contract eklenebiliyor
- [ ] Sync başlıyor (worker aktifse)
- [ ] Snapshot generate oluyor
- [ ] CSV export çalışıyor
- [ ] JSON export çalışıyor

---

## ⚠️ Common Issues

### Vercel Build Failed
```
Sorun: Build failed - Module not found
Çözüm: Root Directory = ClickFrontEnd olmalı!
       Settings → General → Root Directory → Edit → ClickFrontEnd
```

### Database Connection Error
```
Sorun: Connection refused / SSL error
Çözüm: POSTGRES_URL sonunda ?sslmode=require var mı kontrol et
```

### Wallet Connect Çalışmıyor
```
Sorun: WalletConnect modal açılmıyor
Çözüm: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID doğru mu?
       Reown'da domain eklenmiş mi? (snapshot.clickcreate.io)
```

### Render Worker Crash
```
Sorun: Service keeps restarting
Çözüm: Logs kontrol et
       Environment variables tam mı? (3 adet)
       POSTGRES_URL Vercel ile aynı mı?
```

### Domain Not Working
```
Sorun: snapshot.clickcreate.io açılmıyor
Çözüm: DNS propagation bekle (5-30 dakika)
       CNAME kaydı doğru mu?
       Name: snapshot
       Value: cname.vercel-dns.com
```

---

## 📞 Support Resources

### Dokümantasyon
- **Video Guide (Vercel):** `VERCEL_VIDEO_GUIDE.md`
- **Video Guide (Render):** `RENDER_VIDEO_GUIDE.md`
- **Complete Setup:** `VERCEL_SETUP_GUIDE.md`
- **Environment Vars:** `ENV_VARIABLES.md`
- **Full Checklist:** `HANDOFF_CHECKLIST.md`

### Service Status
- Vercel: https://www.vercel-status.com/
- Render: https://status.render.com/
- Neon: https://status.neon.tech/
- Alchemy: https://status.alchemy.com/

### Test Contracts
```
ClickCreate: 0x300e7a5fb0ab08af367d5fb3915930791bb08c2b
Azuki: 0xed5af388653567af2f388e6224dc7c4b3241c544
Bored Apes: 0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d
```

---

## 🎯 Quick Commands

### Generate JWT Secret
```bash
openssl rand -base64 32
```

### Test Database Connection
```bash
psql "postgres://user:pass@host/db?sslmode=require"
```

### Test Render Health
```bash
curl https://ccsnapshot-worker.onrender.com/health
```

### Check Vercel Deployment
```bash
# Vercel CLI (optional)
vercel --prod
```

---

## 📊 Expected Performance

| Metric | Expected Value |
|--------|----------------|
| Vercel Build Time | 2-3 minutes |
| Vercel Cold Start | < 1 second |
| Page Load Time | < 2 seconds |
| API Response | < 500ms |
| Render Startup | 30-60 seconds |
| Worker Sync Speed | ~5,000 blocks/batch |
| Database Query | < 100ms |

---

## 🔐 Security Notes

- ✅ Tüm environment variables Vercel/Render'da encrypted
- ✅ JWT_SECRET asla git'e commit edilmemeli
- ✅ Database SSL required
- ✅ API keys asla frontend'de expose edilmemeli
- ✅ NEXT_PUBLIC_* değişkenler browser'da görülebilir (güvenli)

---

## 🎉 Success Criteria

Deployment başarılı sayılır:

- ✅ https://snapshot.clickcreate.io açılıyor
- ✅ SSL sertifikası aktif
- ✅ Wallet bağlanıyor (MetaMask, WalletConnect)
- ✅ Collection eklenebiliyor
- ✅ Snapshot generate ediliyor
- ✅ CSV/JSON export çalışıyor
- ✅ Worker health check: healthy
- ✅ Database: connected
- ✅ Console'da critical error yok

---

**Last Updated:** November 2024
**Platform:** CCSnapshotApp by ClickCreate
**Deployment:** Vercel (Frontend) + Render (Worker) + Neon (Database)
