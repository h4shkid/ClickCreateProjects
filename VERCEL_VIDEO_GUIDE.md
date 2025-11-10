# 🎥 Vercel Deployment - Video Rehberi

Bu rehber Vercel'e frontend deploy ederken video için takip edeceğiniz adımları içerir.

---

## 📌 Video Başlangıcı

**Ekranda göster:**
"CCSnapshotApp Frontend'i Vercel'e Deploy Etme"

---

## ADIM 1: Vercel'e Giriş Yap

### Yapılacaklar:
1. Tarayıcıda yeni sekme aç
2. https://vercel.com adresine git
3. **"Login"** veya **"Sign In"** butonuna tıkla
4. GitHub ile giriş yap
5. Dashboard'a ulaş

### Ekranda göster:
- Vercel ana sayfası
- Login butonu
- Dashboard ekranı

**Video notu:** "Vercel'e giriş yapıyoruz. GitHub hesabımızla bağlanıyoruz."

---

## ADIM 2: Yeni Proje Oluştur

### Yapılacaklar:
1. Dashboard'da **"Add New..."** butonuna tıkla (sağ üstte)
2. Açılan menüden **"Project"** seç

### Ekranda göster:
- Add New... butonu
- Project seçeneği

**Video notu:** "Yeni bir proje oluşturuyoruz. Add New, Project."

---

## ADIM 3: Repository İmport Et

### Yapılacaklar:

**3.1 ClickCreate Organization'ı Seç:**
1. "Import Git Repository" ekranında
2. Üstteki dropdown'dan **"clickcreate"** organization'ı seç

**3.2 Repository Bul:**
1. Arama kutusuna **"CCSnapshotApp"** yaz
2. **"clickcreate/CCSnapshotApp"** repository'sini bul
3. Sağındaki **"Import"** butonuna tıkla

### Ekranda göster:
- Organization dropdown
- Repository listesi
- CCSnapshotApp'i bulma
- Import butonu

**Video notu:** "GitHub'daki CCSnapshotApp repository'sini import ediyoruz. ClickCreate organization'ından seçiyoruz."

---

## ADIM 4: Proje Ayarlarını Yapılandır

### Yapılacaklar:

**1. Project Name:**
```
ccsnapshot-app
```
veya otomatik gelen ismi bırak

**2. Framework Preset:**
```
Next.js
```
Otomatik algılanmalı, kontrol et

**3. Root Directory:**
⚠️ **ÇOK ÖNEMLİ!**

- **"Edit"** butonuna tıkla
- Açılan listeden **"ClickFrontEnd"** seç
- veya manuel yaz: `ClickFrontEnd`

**4. Build and Output Settings:**

Aşağı kaydır, **"Build and Output Settings"** bölümünü bul

- **Build Command:** `npm run build` (otomatik dolu olmalı)
- **Output Directory:** `.next` (otomatik dolu olmalı)
- **Install Command:** `npm install` (otomatik dolu olmalı)

### Ekranda göster:
- Project Name alanı
- Framework Preset (Next.js)
- Root Directory - EDIT butonu
- ClickFrontEnd seçimi ⭐ (ÖNEMLI!)
- Build settings kontrolleri

**Video notu:** "Proje ayarlarını yapılandırıyoruz. EN ÖNEMLİ NOKTA: Root Directory'yi ClickFrontEnd olarak seçmeliyiz. Edit'e tıklayıp ClickFrontEnd'i seçiyoruz."

---

## ADIM 5: Environment Variables Ekle

### Yapılacaklar:

Aşağı kaydır, **"Environment Variables"** bölümünü bul

### Değişken 1: POSTGRES_URL

1. **Key** kutusuna:
```
POSTGRES_URL
```

2. **Value** kutusuna database connection string yapıştır:
```
postgres://username:password@host.neon.tech/database?sslmode=require
```

3. Environment seç: **Production** ✅ **Preview** ✅

4. **"Add"** butonuna tıkla

### Değişken 2: NEXT_PUBLIC_ALCHEMY_API_KEY

1. **Key:**
```
NEXT_PUBLIC_ALCHEMY_API_KEY
```

2. **Value:** Alchemy API key

3. Environment: **Production** ✅ **Preview** ✅ **Development** ✅

4. **"Add"** tıkla

### Değişken 3: OPENSEA_API_KEY

1. **Key:**
```
OPENSEA_API_KEY
```

2. **Value:** OpenSea API key

3. Environment: **Production** ✅ **Preview** ✅

4. **"Add"** tıkla

### Değişken 4: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

1. **Key:**
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

2. **Value:** Reown Project ID

3. Environment: **Production** ✅ **Preview** ✅ **Development** ✅

4. **"Add"** tıkla

### Değişken 5: JWT_SECRET

1. **Key:**
```
JWT_SECRET
```

2. **Value:** Random 32+ karakter secret
   - Terminalde: `openssl rand -base64 32`
   - veya: https://generate-secret.vercel.app/32

3. Environment: **Production** ✅ **Preview** ✅

4. **"Add"** tıkla

### Değişken 6: NEXT_PUBLIC_APP_URL

1. **Key:**
```
NEXT_PUBLIC_APP_URL
```

2. **Value:**
```
https://snapshot.clickcreate.io
```

3. Environment: **Production** ✅

4. **"Add"** tıkla

### Ekranda göster:
- Her değişkeni eklerken
- Key ve Value alanlarını doldururken
- Environment checkbox'larını seçerken
- Add butonuna tıklarken
- 6 değişkenin tamamı eklenmiş hali

**Video notu:** "Environment variables ekliyoruz. Toplam 6 değişken. Database URL, Alchemy key, OpenSea key, WalletConnect ID, JWT secret ve app URL. Her birini dikkatle giriyoruz."

---

## ADIM 6: Deploy Et

### Yapılacaklar:
1. Sayfanın en altına kaydır
2. **"Deploy"** butonuna tıkla (büyük, siyah buton)
3. Deployment başlıyor

### Ekranda göster:
- Deploy butonu
- "Deploying..." ekranı
- Build aşaması başlıyor

**Video notu:** "Artık deploy edebiliriz. Deploy butonuna tıklıyoruz ve build'in tamamlanmasını bekliyoruz."

---

## ADIM 7: Build İlerlemesini İzle

### Yapılacaklar:
1. **"Building"** aşamasını izle
2. Build logs akışını göster:
   - Installing dependencies
   - Running build command
   - Collecting page data
   - Generating static pages

### Build aşamaları:
```
⏳ Queued
🔨 Building
📦 Deploying
✅ Ready
```

### Ekranda göster:
- Build progress bar
- Build logs (yeşil satırlar)
- Her aşamayı göster
- "Building" → "Ready" geçişi

**Video notu:** "Build işlemi yaklaşık 2-3 dakika sürecek. Next.js uygulaması build ediliyor, sayfalar generate ediliyor."

---

## ADIM 8: Deployment Başarılı

### Yapılacaklar:
1. ✅ **"Deployment Ready"** mesajını bekle
2. Otomatik deployment URL'i göster (örnek: `ccsnapshot-app-xxx.vercel.app`)
3. **"Visit"** butonuna tıkla
4. Yeni sekmede site açılır

### Ekranda göster:
- ✅ Başarılı deployment mesajı
- Deployment URL
- Visit butonu
- Açılan website (homepage)

**Video notu:** "Deployment başarılı! İlk deployment URL'imiz oluştu. Şimdi siteyi açıp test edelim."

---

## ADIM 9: İlk Test

### Yapılacaklar:
1. Homepage yüklendiğini kontrol et
2. Sayfayı aşağı kaydır
3. Butonların çalıştığını göster
4. **"Connect Wallet"** butonunu test et (modal açılmalı)

### Ekranda göster:
- Homepage tamamen yüklenmiş
- Animasyonlar çalışıyor
- Wallet modal açılıyor

**Video notu:** "Site çalışıyor! Homepage yüklendi, wallet bağlama modalı açılıyor. Şimdi custom domain ekleyelim."

---

## ADIM 10: Custom Domain Ekle

### Yapılacaklar:

**10.1 Settings'e Git:**
1. Vercel dashboard'a dön (tarayıcı sekmesi)
2. Proje sayfasında üstteki **"Settings"** tıkla

**10.2 Domains Bölümü:**
1. Sol menüden **"Domains"** seç

**10.3 Domain Ekle:**
1. Domain input kutusuna yaz:
```
snapshot.clickcreate.io
```
2. **"Add"** butonuna tıkla

**10.4 Domain Tipi Seç:**
1. **"Add snapshot.clickcreate.io"** seç (subdomain olarak)
2. **"Add"** tıkla

### Ekranda göster:
- Settings sekmesi
- Domains menüsü
- Domain input alanı
- snapshot.clickcreate.io yazma
- Add butonu
- Domain eklendi mesajı

**Video notu:** "Şimdi custom domain'i ekliyoruz. snapshot.clickcreate.io adresini giriyoruz."

---

## ADIM 11: DNS Ayarları

### Yapılacaklar:

Vercel otomatik DNS ayarlarını gösterir:

**CNAME Kaydı:**
```
Type: CNAME
Name: snapshot
Value: cname.vercel-dns.com
```

### Domain sağlayıcıda (örn: Namecheap, Cloudflare):

1. Domain yönetim paneline git
2. DNS kayıtlarına gir
3. Yeni CNAME kaydı ekle:
   - **Type:** CNAME
   - **Name:** snapshot
   - **Value:** cname.vercel-dns.com
   - **TTL:** Auto veya 3600
4. Save/Kaydet

### Ekranda göster:
- Vercel'deki DNS talimatları
- Domain sağlayıcı paneli (opsiyonel, sadece bahset)
- CNAME kaydı ekleme

**Video notu:** "DNS ayarlarını yapmamız gerekiyor. Domain sağlayıcınızda CNAME kaydı ekleyeceksiniz. Name'e snapshot, Value'ya cname.vercel-dns.com yazacaksınız."

---

## ADIM 12: Domain Doğrulamasını Bekle

### Yapılacaklar:
1. Vercel Domains sayfasında kal
2. Domain status'u izle:
   - ⏳ **"Invalid Configuration"** (sarı)
   - ⏳ **"Pending"** (turuncu)
   - ✅ **"Valid"** (yeşil)

3. DNS propagation 5-30 dakika sürebilir
4. **Refresh** butonuna ara ara tıkla

### Ekranda göster:
- Domain status değişimi
- Invalid → Valid geçişi
- SSL certificate provisioning

**Video notu:** "DNS propagation'ı bekliyoruz. Bu 5-30 dakika sürebilir. Status yeşil Valid olunca hazır demektir. SSL sertifikası otomatik oluşuyor."

---

## ADIM 13: Production Domain Test

### Yapılacaklar:
1. https://snapshot.clickcreate.io adresine git
2. Sitenin açıldığını kontrol et
3. SSL sertifikasını kontrol et (🔒 kilidi göster)
4. Wallet bağlamayı test et
5. "Generate Snapshot" butonuna tıkla
6. /collections sayfasına gittiğini göster

### Ekranda göster:
- Custom domain'de açılan site
- SSL kilidi (güvenli bağlantı)
- Homepage
- Wallet connection
- Navigation

**Video notu:** "İşte production domain'imiz! snapshot.clickcreate.io adresinden erişiliyor. SSL sertifikası aktif, güvenli bağlantı kurulmuş. Tüm özellikler çalışıyor."

---

## ADIM 14: Environment Variables Kontrolü

### Yapılacaklar:
1. Settings → **"Environment Variables"** sekmesine git
2. Tüm değişkenlerin listelendiğini göster:
   - ✅ POSTGRES_URL (Production, Preview)
   - ✅ NEXT_PUBLIC_ALCHEMY_API_KEY (Production, Preview, Development)
   - ✅ OPENSEA_API_KEY (Production, Preview)
   - ✅ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (Production, Preview, Development)
   - ✅ JWT_SECRET (Production, Preview)
   - ✅ NEXT_PUBLIC_APP_URL (Production)

### Ekranda göster:
- Environment Variables listesi
- Her değişkenin environment'ları

**Video notu:** "Environment variables'ları kontrol ediyoruz. 6 değişkenin tamamı doğru şekilde eklenmiş."

---

## ADIM 15: Deployment Ayarları (Opsiyonel)

### Yapılacaklar:

**15.1 Auto-Deploy:**
1. Settings → **"Git"** sekmesi
2. **"Production Branch"** kontrol et: `main` olmalı
3. **"Auto-Deploy"** aktif olmalı (varsayılan)

**15.2 Build Settings:**
1. Settings → **"General"** sekmesi
2. Root Directory: `ClickFrontEnd` ✅
3. Build Command: `npm run build` ✅
4. Output Directory: `.next` ✅

### Ekranda göster:
- Git settings
- Production branch
- Build settings özeti

**Video notu:** "Son ayarları kontrol ediyoruz. Auto-deploy aktif, her GitHub push'ta otomatik deploy olacak."

---

## ✅ DEPLOYMENT TAMAMLANDI

### Final Kontroller:

**1. Production Site:**
- ✅ https://snapshot.clickcreate.io açılıyor
- ✅ SSL sertifikası aktif (🔒)
- ✅ Homepage yükleniyor
- ✅ Wallet bağlanıyor
- ✅ Navigation çalışıyor

**2. Vercel Dashboard:**
- ✅ Status: Ready (yeşil)
- ✅ Domain: Valid
- ✅ Build: Successful
- ✅ Deployment: Active

**3. Environment Variables:**
- ✅ 6/6 değişken ekli
- ✅ Production ve Preview environment'lar set
- ✅ Sensitive data hidden (gösterilmiyor)

### Ekranda göster:
- Production site açık
- Vercel dashboard overview
- "Deployment successful" badge

**Video notu:** "Harika! Vercel deployment'ı tamamlandı. Frontend artık canlıda ve snapshot.clickcreate.io adresinden erişilebilir durumda."

---

## ADIM 16: Son Test - Tam Akış

### Yapılacaklar:

**16.1 Wallet Bağla:**
1. "Connect Wallet" tıkla
2. MetaMask seç ve bağlan
3. Wallet adresinin göründüğünü kontrol et

**16.2 Collection Ekle:**
1. "Generate Snapshot" butonuna tıkla
2. Test contract adresi gir: `0x300e7a5fb0ab08af367d5fb3915930791bb08c2b`
3. Contract validate olduğunu göster
4. Snapshot sayfasına yönlendiğini göster

**16.3 Sync Status:**
1. Sync durumunu kontrol et
2. "Sync blockchain" veya "Generate snapshot" butonunu göster

### Ekranda göster:
- Wallet bağlama akışı
- Contract ekleme
- Snapshot sayfası
- Tüm UI elementleri çalışıyor

**Video notu:** "Son bir tam test yapalım. Wallet bağlıyorum, collection ekliyorum, her şey mükemmel çalışıyor. Frontend hazır, backend worker'ı bekliyoruz."

---

## 🎬 Video Bitişi

### Son ekranda göster:

**Başarıyla Tamamlanan Görevler:**
```
✅ Repository import edildi
✅ Root directory yapılandırıldı (ClickFrontEnd)
✅ 6 environment variable eklendi
✅ İlk deployment yapıldı
✅ Custom domain eklendi (snapshot.clickcreate.io)
✅ SSL sertifikası aktif
✅ Production test başarılı
✅ Sistem canlıda! 🚀
```

**Sıradaki Adım:**
```
🔄 Render'da sync worker'ı deploy edin
   (Ayrı video)
```

**Production URL:**
```
https://snapshot.clickcreate.io
```

**Video notu:** "İşte bu kadar! Frontend başarıyla Vercel'e deploy edildi. Sırada Render'a worker deploy etmek var, onu başka bir videoda göstereceğim. Sorularınız için yorumlarda buluşalım!"

---

## 🎨 Video İpuçları

### Çekim Notları:

1. **Ekran Çözünürlüğü:**
   - 1920x1080 (Full HD)
   - Tarayıcıyı tam ekran yap
   - Zoom: 100% (browser)

2. **Ses Kalitesi:**
   - Mikrofon test et
   - Sessiz ortam
   - Net konuş, yavaş açıkla

3. **Mouse Hareketleri:**
   - Yavaş ve net
   - Tıkladığın yerleri highlight et
   - İşaretçi çok hızlı hareket ettirme

4. **Bekleme Süreleri:**
   - Her işlem sonrası 2-3 saniye bekle
   - Kullanıcı takip edebilsin
   - Build logs akışını tam göster

5. **Hatalar:**
   - Hata yaparsan kurtar, kesme
   - Gerçek senaryoyu göster
   - Troubleshooting fırsatı

### Video Bölümleri (Timestamps):

```
0:00 - Giriş
0:30 - Vercel Login
1:00 - Repository Import
2:00 - Root Directory (ÖNEMLİ!)
3:00 - Environment Variables (6 adet)
8:00 - İlk Deploy
10:00 - Build İzleme
12:00 - İlk Test
13:00 - Custom Domain Ekleme
14:00 - DNS Ayarları
15:00 - Domain Doğrulama
17:00 - Production Test
18:00 - Final Kontroller
19:00 - Tam Akış Test
20:00 - Kapanış
```

---

## 📋 Video Checklist

Videoda mutlaka gösterilecekler:

- [ ] Vercel.com ana sayfası
- [ ] Login butonu ve GitHub auth
- [ ] Add New → Project
- [ ] Organization seçimi (clickcreate)
- [ ] Repository import (CCSnapshotApp)
- [ ] ⭐ ROOT DIRECTORY → ClickFrontEnd (ÇOK ÖNEMLİ!)
- [ ] Her 6 environment variable'ı tek tek ekleme
- [ ] Deploy butonu
- [ ] Build logs akışı
- [ ] "Ready" durumu
- [ ] İlk deployment URL
- [ ] Homepage test
- [ ] Wallet connection test
- [ ] Custom domain ekleme (snapshot.clickcreate.io)
- [ ] DNS ayarları açıklaması
- [ ] SSL sertifikası aktif
- [ ] Production domain test
- [ ] Tam kullanıcı akışı (wallet → collection → snapshot)

---

## 🔧 Kullanıcıdan İstenen Bilgiler

Video öncesi hazırlanacak:

1. **POSTGRES_URL** (Neon/Supabase)
2. **NEXT_PUBLIC_ALCHEMY_API_KEY** (Alchemy.com)
3. **OPENSEA_API_KEY** (OpenSea)
4. **NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID** (Reown)
5. **JWT_SECRET** (Generate edilecek)
6. **Domain DNS Erişimi** (snapshot.clickcreate.io için)

---

## ⚠️ Kritik Noktalar

### ⭐ EN ÖNEMLİ:

**ROOT DIRECTORY = ClickFrontEnd**

Bunu atlarsanız build BAŞARISIZ olur!

Mutlaka:
1. Root Directory → Edit tıkla
2. ClickFrontEnd seç
3. Save

### Environment Variables:

- NEXT_PUBLIC_* → Production + Preview + Development
- Diğerleri → Production + Preview
- NEXT_PUBLIC_APP_URL → Sadece Production

### DNS Ayarları:

- CNAME kaydı doğru girilmeli
- snapshot → cname.vercel-dns.com
- Propagation 5-30 dakika

---

**Video Hazırlama Notu:** Bu rehberi adım adım takip et. Root Directory ayarını MUTLAKA vurgula, çok önemli! Kullanıcı teknik bilmiyor varsayımıyla çek, her şeyi detaylı göster.
