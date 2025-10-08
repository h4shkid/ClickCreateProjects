# Vercel Environment Variables

Bu dosya Vercel deployment için gerekli tüm environment variable'ları içerir.

## 📋 Vercel'e Eklenecek Environment Variables

Vercel Dashboard → Settings → Environment Variables bölümünden aşağıdaki tüm değişkenleri ekleyin.

---

### 🔗 Blockchain RPC Providers

#### NEXT_PUBLIC_ALCHEMY_API_KEY
- **Değer**: `1oDESwnqliWhcoV1gxVme`
- **Açıklama**: Alchemy RPC API key (tüm EVM zincirler için)
- **Gerekli**: ✅ Zorunlu
- **Environment**: Production, Preview, Development

#### NEXT_PUBLIC_ALCHEMY_WS_URL
- **Değer**: `wss://eth-mainnet.g.alchemy.com/v2/1oDESwnqliWhcoV1gxVme`
- **Açıklama**: Alchemy WebSocket endpoint (real-time monitoring için)
- **Gerekli**: ⚠️ Opsiyonel (monitor sayfası için)
- **Environment**: Production, Preview, Development

---

### 🔍 API Keys

#### OPENSEA_API_KEY
- **Değer**: `cca5c2b50be64cb7ad43dd9e972138d8`
- **Açıklama**: OpenSea API v2 key (collection metadata için)
- **Gerekli**: ✅ Zorunlu
- **Environment**: Production, Preview, Development

#### ETHERSCAN_API_KEY
- **Değer**: `K92SWY7FW63C5RV7YUI5EHSJ32XHXXRU5T`
- **Açıklama**: Etherscan API key (deployment block detection için)
- **Gerekli**: ✅ Zorunlu
- **Environment**: Production, Preview, Development

---

### 🔐 Authentication

#### JWT_SECRET
- **Değer**: `your-super-secret-jwt-key-for-production-change-this-to-something-secure`
- **Açıklama**: JWT token imzalama için secret key
- **Gerekli**: ✅ Zorunlu
- **Environment**: Production, Preview, Development
- **⚠️ ÖNEMLİ**: Production için mutlaka güçlü bir random string kullanın!

#### NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
- **Değer**: `your-walletconnect-project-id-here`
- **Açıklama**: WalletConnect v2 Project ID (RainbowKit için)
- **Gerekli**: ✅ Zorunlu
- **Environment**: Production, Preview, Development
- **Nereden alınır**: https://cloud.walletconnect.com

---

### 🗄️ Database Configuration (PRODUCTION)

#### DATABASE_TYPE
- **Değer**: `postgres`
- **Açıklama**: Database türü (production'da Postgres, local'de SQLite)
- **Gerekli**: ✅ Zorunlu (Vercel deployment için)
- **Environment**: Production, Preview

#### POSTGRES_URL
- **Değer**: `postgres://4a19748bd89c5611c016aaa027d3ac32d517833ab46e1c08f23b5f8a710b0a56:sk_-hLlPVbV73iiRW67YAwC1@db.prisma.io:5432/postgres?sslmode=require`
- **Açıklama**: Prisma Postgres connection string
- **Gerekli**: ✅ Zorunlu (Vercel deployment için)
- **Environment**: Production, Preview

#### DATABASE_URL
- **Değer**: `postgres://4a19748bd89c5611c016aaa027d3ac32d517833ab46e1c08f23b5f8a710b0a56:sk_-hLlPVbV73iiRW67YAwC1@db.prisma.io:5432/postgres?sslmode=require`
- **Açıklama**: Postgres connection string (compatibility)
- **Gerekli**: ⚠️ Opsiyonel (bazı kütüphaneler DATABASE_URL kullanır)
- **Environment**: Production, Preview

#### PRISMA_DATABASE_URL
- **Değer**: `postgres://4a19748bd89c5611c016aaa027d3ac32d517833ab46e1c08f23b5f8a710b0a56:sk_-hLlPVbV73iiRW67YAwC1@db.prisma.io:5432/postgres?sslmode=require`
- **Açıklama**: Prisma Accelerate connection string
- **Gerekli**: ⚠️ Opsiyonel (Prisma kullanımı için)
- **Environment**: Production, Preview

---

### 🏗️ Contract Configuration (DEPRECATED)

#### NEXT_PUBLIC_CONTRACT_ADDRESS
- **Değer**: `0x300e7a5fb0ab08af367d5fb3915930791bb08c2b`
- **Açıklama**: Default contract address (legacy, artık gerekli değil)
- **Gerekli**: ❌ Opsiyonel
- **Environment**: Production, Preview, Development

#### NEXT_PUBLIC_CHAIN_ID
- **Değer**: `1`
- **Açıklama**: Default chain ID (legacy, artık gerekli değil)
- **Gerekli**: ❌ Opsiyonel
- **Environment**: Production, Preview, Development

---

## 📝 Vercel'de Environment Variable Nasıl Eklenir?

### Yöntem 1: Dashboard (Önerilen)

1. Vercel Dashboard'a gidin: https://vercel.com/dashboard
2. Projenize tıklayın
3. **Settings** → **Environment Variables**
4. Her bir variable için:
   - **Key**: Variable adı (örn: `DATABASE_TYPE`)
   - **Value**: Yukarıdaki değer
   - **Environment**: Production, Preview, Development (hepsini seçin)
5. **Save** butonuna tıklayın

### Yöntem 2: Vercel CLI

```bash
# Tüm environment'lar için (production, preview, development)
vercel env add DATABASE_TYPE production preview development
# Değer girildiğinde: postgres

vercel env add POSTGRES_URL production preview development
# Değer girildiğinde: postgres://4a19748bd89c5611c016aaa027d3ac32d517833ab46e1c08f23b5f8a710b0a56:sk_-hLlPVbV73iiRW67YAwC1@db.prisma.io:5432/postgres?sslmode=require

# Diğerleri için de aynı şekilde...
```

---

## ✅ Kontrol Listesi

Vercel'e ekledikten sonra aşağıdaki kontrolleri yapın:

- [ ] **DATABASE_TYPE** = `postgres` olarak ayarlandı
- [ ] **POSTGRES_URL** Prisma connection string ile ayarlandı
- [ ] **NEXT_PUBLIC_ALCHEMY_API_KEY** ayarlandı
- [ ] **OPENSEA_API_KEY** ayarlandı
- [ ] **ETHERSCAN_API_KEY** ayarlandı
- [ ] **JWT_SECRET** güçlü bir random string ile değiştirildi
- [ ] **NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID** WalletConnect Cloud'dan alındı
- [ ] Tüm değişkenler için **Production, Preview, Development** seçildi
- [ ] Deployment yeniden başlatıldı (Deployments → ... → Redeploy)

---

## 🔒 Güvenlik Notları

⚠️ **ÖNEMLİ:**

1. **JWT_SECRET**: Production için mutlaka güçlü, random bir string kullanın
   ```bash
   # Güvenli JWT secret oluşturma:
   openssl rand -base64 32
   ```

2. **POSTGRES_URL**: Bu connection string içinde şifre var, asla public repo'ya commit etmeyin

3. **API Keys**: Tüm API key'ler private tutulmalı, .env.local dosyası .gitignore'da olmalı

4. **NEXT_PUBLIC_** ile başlayan değişkenler browser'da görünür olacaktır

---

## 🚀 Deployment Sonrası Test

Environment variable'lar eklendikten sonra:

1. **Redeploy** yapın (Vercel otomatik yapmazsa manuel redeploy edin)
2. **Function Logs** kontrol edin:
   - Vercel Dashboard → Deployments → Son deployment → Functions
   - Log'larda `[DatabaseAdapter] DATABASE_TYPE: postgres` görünmeli
   - Log'larda `[DatabaseAdapter] POSTGRES_URL exists: true` görünmeli
3. **My Collections** sayfasını test edin - kontratlar görünmeli
4. **Contract ekleme** test edin - yeni kontrat eklenebilmeli
5. **Snapshot oluşturma** test edin - holder snapshots çalışmalı

---

## 📞 Sorun Giderme

### Hata: "POSTGRES_URL environment variable is required"

**Çözüm:**
1. Vercel Dashboard → Settings → Environment Variables
2. `POSTGRES_URL` değişkenini kontrol edin
3. Value'nun doğru olduğundan emin olun
4. Production, Preview, Development'ın hepsinin seçili olduğunu kontrol edin
5. Deployment'ı yeniden başlatın (Redeploy)

### Hata: "Collections not appearing in My Collections"

**Çözüm:**
1. `DATABASE_TYPE=postgres` ayarlandığından emin olun
2. `POSTGRES_URL` connection string'in doğru olduğundan emin olun
3. Vercel Function Logs'larını kontrol edin
4. Browser console'da API errors kontrol edin

### Environment Variables Değişmiyor

**Çözüm:**
1. Environment variable ekledikten/değiştirdikten sonra mutlaka **Redeploy** yapın
2. Vercel build cache'i temizlemek için: Deployments → ... → Redeploy (with clear cache)
3. Her değişken için doğru environment seçildiğinden emin olun

---

## 📚 İlgili Dosyalar

- **Local Development**: `.env.local` (git'e commit edilmez)
- **Database Adapter**: `lib/database/adapter.ts`
- **Postgres Migration**: `migrations/001_initial_postgres_schema.sql`
- **Import Script**: `scripts/fast-import-to-postgres.ts`
