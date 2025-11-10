# 🎥 Render Deployment - Video Rehberi

Bu rehber video çekerken takip edeceğiniz adımları içerir. Her adım ekranda gösterilebilir.

---

## 📌 Video Başlangıcı

**Ekranda göster:**
"CCSnapshotApp Sync Worker'ı Render'a Deploy Etme"

---

## ADIM 1: Render'a Giriş Yap

### Yapılacaklar:
1. Tarayıcıda yeni sekme aç
2. https://render.com adresine git
3. **"Sign In"** butonuna tıkla
4. GitHub ile giriş yap (veya email/şifre)

### Ekranda göster:
- Render ana sayfası
- Sign In butonu
- Dashboard'a giriş

**Video notu:** "Render.com'a giriş yapıyoruz. Eğer hesabınız yoksa Sign Up ile ücretsiz hesap oluşturabilirsiniz."

---

## ADIM 2: Yeni Web Service Oluştur

### Yapılacaklar:
1. Dashboard'da sağ üstteki **"New +"** butonuna tıkla
2. Açılan menüden **"Web Service"** seç

### Ekranda göster:
- New + butonu
- Web Service seçeneği

**Video notu:** "Yeni bir Web Service oluşturuyoruz. Bu bizim sync worker'ımız olacak."

---

## ADIM 3: GitHub Repository Bağla

### Yapılacaklar:
1. "Connect a repository" ekranında **"+ Connect Account"** tıkla (ilk defa ise)
2. veya direkt repository listesinden seç
3. Arama kutusuna **"CCSnapshotWorker"** yaz
4. **"clickcreate/CCSnapshotWorker"** repository'sini bul
5. Sağındaki **"Connect"** butonuna tıkla

### Ekranda göster:
- Repository arama kutusu
- CCSnapshotWorker'ı seçme
- Connect butonu

**Video notu:** "GitHub'daki CCSnapshotWorker repository'sini Render'a bağlıyoruz."

---

## ADIM 4: Service Ayarlarını Yapılandır

### Yapılacaklar:

**1. Name (İsim):**
```
ccsnapshot-worker
```
Ekranda göster: Name kutusuna yazarken

**2. Region (Bölge):**
```
Oregon (US West)
```
Dropdown'dan seç, ekranda göster

**3. Branch (Dal):**
```
main
```
Zaten seçili olmalı, kontrol et

**4. Build Command (Kurulum komutu):**
```
npm install
```
Ekranda göster: Build Command kutusuna yazarken

**5. Start Command (Başlatma komutu):**
```
npm start
```
Ekranda göster: Start Command kutusuna yazarken

**6. Instance Type (Plan):**
```
Starter (Free - $0/month)
```
Dropdown'dan seç, ekranda göster

### Ekranda göster:
- Her alanı doldururken
- Tüm ayarların son hali

**Video notu:** "Service ayarlarını yapılandırıyoruz. Build Command npm install, Start Command npm start olmalı. Free plan'ı seçiyoruz."

---

## ADIM 5: Environment Variables (Çevre Değişkenleri) Ekle

### Yapılacaklar:

Sayfayı aşağı kaydır, **"Environment Variables"** bölümünü bul

### Değişken 1: POSTGRES_URL

1. **"Add Environment Variable"** butonuna tıkla
2. **Key** kutusuna yaz:
```
POSTGRES_URL
```
3. **Value** kutusuna database connection string'i yapıştır:
```
postgres://username:password@host.neon.tech/database?sslmode=require
```
⚠️ **ÖNEMLİ:** Gerçek değeri kullanıcıdan al!

### Değişken 2: NEXT_PUBLIC_ALCHEMY_API_KEY

1. **"Add Environment Variable"** butonuna tıkla
2. **Key** kutusuna yaz:
```
NEXT_PUBLIC_ALCHEMY_API_KEY
```
3. **Value** kutusuna Alchemy API key'i yapıştır
⚠️ **ÖNEMLİ:** Gerçek değeri kullanıcıdan al!

### Değişken 3: PORT

1. **"Add Environment Variable"** butonuna tıkla
2. **Key** kutusuna yaz:
```
PORT
```
3. **Value** kutusuna yaz:
```
3001
```

### Ekranda göster:
- Her değişkeni eklerken
- Key ve Value alanlarını doldururken
- Üç değişkenin de eklenmiş hali

**Video notu:** "Environment variables ekliyoruz. POSTGRES_URL, NEXT_PUBLIC_ALCHEMY_API_KEY ve PORT. Bu değerleri kullanıcıdan alacaksınız."

---

## ADIM 6: Deploy Et

### Yapılacaklar:
1. Sayfanın en altına kaydır
2. **"Create Web Service"** butonuna tıkla (mavi, büyük buton)
3. Deploy işleminin başlamasını bekle

### Ekranda göster:
- Create Web Service butonu
- Deploy başlıyor ekranı
- Build logları (kırmızı/yeşil satırlar)

**Video notu:** "Artık deploy edebiliriz. Create Web Service'e tıklayıp deployment'ın tamamlanmasını bekliyoruz."

---

## ADIM 7: Deployment İlerlemesini İzle

### Yapılacaklar:
1. **"Logs"** sekmesinde kal
2. Build aşamasını izle:
   - `npm install` çalışıyor
   - Dependencies yükleniyor
   - Build tamamlanıyor
3. Deploy başarılı olunca **"Live"** yeşil badge'i görünecek

### Ekranda göster:
- Build logs akışı
- npm install çalışırken
- "Build successful" mesajı
- "Live" yeşil badge

**Video notu:** "Deployment ilerliyor. npm install çalışıyor, package'lar yükleniyor. Yaklaşık 1-2 dakika sürebilir."

---

## ADIM 8: Service URL'ini Al

### Yapılacaklar:
1. Üstteki service URL'ini kopyala (örnek: `https://ccsnapshot-worker.onrender.com`)
2. Not defterine kaydet veya panoya kopyala

### Ekranda göster:
- Service URL'i (üst kısımda)
- Kopyalama işlemi

**Video notu:** "Service URL'imizi kopyalıyoruz. Bu URL'i worker'a erişmek için kullanacağız."

---

## ADIM 9: Health Check Testi

### Yapılacaklar:
1. Service URL'ine `/health` ekle
2. Tarayıcıda yeni sekmede aç: `https://ccsnapshot-worker.onrender.com/health`
3. JSON response'u kontrol et:

**Başarılı response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": "123 seconds"
}
```

### Ekranda göster:
- URL'e /health ekleme
- Tarayıcıda açma
- JSON response'u

**Video notu:** "Worker'ın çalıştığını test ediyoruz. /health endpoint'ine gidiyoruz ve status: healthy görmemiz gerekiyor."

---

## ADIM 10: Logs Kontrolü

### Yapılacaklar:
1. Render dashboard'da **"Logs"** sekmesine dön
2. Service başladıktan sonraki logları kontrol et
3. Şu mesajları arıyoruz:
```
🚀 NFT Snapshot Sync Worker starting...
✅ Database connected successfully
🔄 Starting sync loop
📡 Service ready on port 3001
```

### Ekranda göster:
- Logs sekmesi
- Başarılı startup mesajları
- Emoji'li log satırları

**Video notu:** "Logs'ları kontrol ediyoruz. Database connected ve Service ready mesajlarını görmeliyiz."

---

## ADIM 11: Environment Variables'ı Doğrula (Opsiyonel)

### Yapılacaklar:
1. Sol menüden **"Environment"** sekmesine tıkla
2. Tüm değişkenlerin ekli olduğunu kontrol et:
   - ✅ POSTGRES_URL
   - ✅ NEXT_PUBLIC_ALCHEMY_API_KEY
   - ✅ PORT

### Ekranda göster:
- Environment sekmesi
- Üç değişken listesi

**Video notu:** "Environment variables'ların doğru eklendiğini kontrol ediyoruz."

---

## ADIM 12: Auto-Deploy Ayarı (Opsiyonel)

### Yapılacaklar:
1. Sol menüden **"Settings"** sekmesine tıkla
2. **"Auto-Deploy"** bölümünü bul
3. **"Yes"** seçili olduğundan emin ol (varsayılan)

### Ekranda göster:
- Settings sekmesi
- Auto-Deploy: Yes

**Video notu:** "Auto-Deploy aktif. GitHub'a her push'ta otomatik deploy olacak."

---

## ✅ DEPLOYMENT TAMAMLANDI

### Final Ekran:

**Başarılı deployment göstergeleri:**
- ✅ Status: **Live** (yeşil)
- ✅ Health check: **healthy**
- ✅ Logs: Database connected
- ✅ URL: Aktif ve erişilebilir

### Son kontroller:

1. **Service Dashboard:**
   - Status: Live (yeşil)
   - Last deploy: Az önce
   - Deployment: Successful

2. **Health Endpoint:**
   - Response: 200 OK
   - Status: healthy
   - Database: connected

3. **Logs:**
   - Hata mesajı yok
   - Başarılı startup mesajları var
   - Sync loop başladı

**Video notu:** "Deployment başarıyla tamamlandı! Worker artık çalışıyor ve blockchain'den veri senkronize edecek."

---

## 🎬 Video Bitişi

### Son ekranda göster:

**Özet:**
- ✅ Repository bağlandı
- ✅ Service yapılandırıldı
- ✅ Environment variables eklendi
- ✅ Deploy edildi
- ✅ Health check başarılı
- ✅ Sistem aktif

**Notlar kullanıcıya:**
```
Service URL: https://ccsnapshot-worker.onrender.com
Status: Live ✅
Database: Connected ✅
Ready to sync blockchain events ⛓️
```

---

## 🎨 Video İpuçları

### Video çekerken dikkat edilecekler:

1. **Yavaş git:** Her adımı net göster
2. **Zoom yap:** Text alanlarını yakınlaştır
3. **Highlight:** Mouse ile işaret et
4. **Bekle:** Her işlem sonrası 2-3 saniye bekle
5. **Kontrol et:** Her adımda başarılı olduğunu göster

### Ses kaydı için script:

**Giriş (0:00-0:10):**
> "Merhaba! Bu videoda CCSnapshotApp'in sync worker'ını Render'a nasıl deploy edeceğinizi göstereceğim. Çok basit, yaklaşık 5 dakika sürecek."

**Render Login (0:10-0:30):**
> "İlk olarak Render.com'a giriş yapıyoruz. Eğer hesabınız yoksa ücretsiz hesap oluşturabilirsiniz. GitHub ile giriş yapıyorum."

**Repository Bağlama (0:30-1:00):**
> "Şimdi New Plus Web Service diyoruz. GitHub'daki CCSnapshotWorker repository'sini arıyoruz ve Connect diyoruz."

**Ayarlar (1:00-2:30):**
> "Service ayarlarını yapılandırıyoruz. Name'e ccsnapshot-worker yazıyorum. Build Command npm install, Start Command npm start. Free plan'ı seçiyorum."

**Environment Variables (2:30-4:00):**
> "En önemli kısım: Environment Variables. Üç değişken ekleyeceğiz. Birincisi POSTGRES_URL - database bağlantı string'inizi buraya yapıştıracaksınız. İkincisi NEXT_PUBLIC_ALCHEMY_API_KEY - Alchemy API key'inizi buraya. Üçüncüsü PORT - buraya 3001 yazıyoruz."

**Deploy (4:00-5:00):**
> "Artık hazırız. Create Web Service'e tıklıyorum. Build başladı, npm install çalışıyor. Yaklaşık 1-2 dakika sürecek. Build tamamlandı, service Live durumda!"

**Test (5:00-5:30):**
> "Şimdi test edelim. Service URL'ine /health ekleyip tarayıcıda açıyorum. Status healthy, database connected - mükemmel! Worker başarıyla çalışıyor."

**Kapanış (5:30-5:45):**
> "İşte bu kadar! Worker artık otomatik olarak blockchain'den veri senkronize edecek. Sorularınız için yorumlarda buluşalım!"

---

## 📋 Video Checklist

Videoda mutlaka gösterilecekler:

- [ ] Render.com ana sayfası
- [ ] Sign In butonu
- [ ] New + → Web Service
- [ ] Repository seçimi (CCSnapshotWorker)
- [ ] Name alanı doldurma
- [ ] Build ve Start command'lar
- [ ] Instance Type (Free tier)
- [ ] Her environment variable ekleme (3 tane)
- [ ] Create Web Service butonu
- [ ] Build logs akışı
- [ ] "Live" yeşil badge
- [ ] Service URL
- [ ] /health endpoint test
- [ ] Başarılı JSON response
- [ ] Final logs kontrolü

---

## 🔧 Kullanıcıdan İstenen Bilgiler

Video öncesi hazırlanacak:

1. **POSTGRES_URL:**
   - Neon'dan alınacak
   - Format: `postgres://user:pass@host/db?sslmode=require`

2. **NEXT_PUBLIC_ALCHEMY_API_KEY:**
   - Alchemy.com'dan alınacak
   - Ethereum Mainnet app oluşturulmalı

3. **PORT:**
   - Sabit: `3001`

---

## ⚠️ Olası Hatalar ve Çözümleri

### Hata 1: "Build Failed"

**Ekranda görünür:**
```
Error: Build failed
npm install exited with code 1
```

**Çözüm:**
- Settings → Build Command kontrol et
- `npm install` yazılı olmalı
- Redeploy dene: Manual Deploy → Deploy Latest Commit

### Hata 2: "Database Connection Failed"

**Logs'da görünür:**
```
❌ Database connection failed
Error: connect ECONNREFUSED
```

**Çözüm:**
- Environment → POSTGRES_URL kontrol et
- Sonunda `?sslmode=require` var mı?
- Neon database aktif mi kontrol et

### Hata 3: "Service Crashed"

**Status görünür:**
```
Status: Deploy failed
```

**Çözüm:**
- Logs sekmesine git
- Hata mesajını oku
- Environment variables eksik olabilir
- Tüm 3 değişken ekli mi kontrol et

---

**Video Hazırlama Notu:** Bu rehberi yanında tut, her adımı sırayla takip et. Kullanıcı hiçbir teknik bilgi bilmiyor varsayımıyla çek!
