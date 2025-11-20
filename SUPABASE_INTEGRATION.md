# Supabase-integraatio - Yhteenveto

## 📋 Luodut tiedostot

### API-endpointit
- ✅ `app/api/cron/route.ts` - Pääasiallinen cron-endpoint liikennetietojen tallentamiseen
- ✅ `app/api/test-supabase/route.ts` - Testausendpoint Supabase-yhteyden varmistamiseen

### Tietokanta
- ✅ `supabase/schema.sql` - SQL-skripti tietokantataulun luomiseen
- ✅ `types/supabase.ts` - TypeScript-tyyppimäärittelyt

### Dokumentaatio
- ✅ `supabase/README.md` - Yksityiskohtainen käyttöohje
- ✅ `SUPABASE_SETUP.md` - Vaiheittainen asennusohje
- ✅ `.env.local.example` - Esimerkkiympäristömuuttujat

### Konfiguraatio
- ✅ `vercel.json` - Vercel Cron Jobs -konfiguraatio
- ✅ Päivitetty `utils/supabase/server.ts` - Kommentit lisätty
- ✅ Päivitetty `README.md` - Supabase-osio lisätty

## 🎯 Toiminnallisuus

### Mitä tehtiin?

1. **Supabase-yhteys**
   - Luo yhteyden Supabase-tietokantaan
   - Käyttää service role key:tä turvalliseen tallennukseen
   - Tukee sekä anon että service role -avaimia

2. **Cron-endpoint** (`/api/cron`)
   - Hakee määriteltyjen risteysten liikennetiedot TPM API:sta
   - Tarkistaa aikaleiman duplikaattien välttämiseksi
   - Tallentaa tiedot Supabase-tietokantaan
   - Palauttaa yhteenvedon tallennetuista tietueista
   - Suojattu valinnaisella CRON_SECRET-ympäristömuuttujalla

3. **Tietokantarakenne**
   - `traffic_data`-taulu tallentaa liikennemittaukset
   - `latest_traffic_data`-näkymä näyttää viimeisimmät mittaukset
   - Indeksit optimoivat kyselyt
   - RLS-policyt hallitsevat käyttöoikeuksia

4. **Testausendpoint** (`/api/test-supabase`)
   - Testaa Supabase-yhteyden
   - Testaa taulun olemassaolon
   - Testaa luku- ja kirjoitusoikeudet
   - Antaa selkeän palautteen konfiguraation tilasta

5. **Automaattinen ajastus**
   - Vercel Cron Jobs ajaa `/api/cron`-endpointin automaattisesti
   - Oletuksena joka 15. minuutti (`*/15 * * * *`)
   - Muokattavissa `vercel.json`-tiedostossa

## 🚀 Pika-aloitusohje

```bash
# 1. Asenna riippuvuudet
npm install @supabase/supabase-js

# 2. Kopioi ympäristömuuttujat
cp .env.local.example .env.local

# 3. Muokkaa .env.local omilla Supabase-asetuksillasi
# (ks. SUPABASE_SETUP.md vaiheittaiset ohjeet)

# 4. Aja schema.sql Supabase SQL Editorissa

# 5. Testaa yhteys
npm run dev
# Avaa: http://localhost:3000/api/test-supabase

# 6. Testaa cron-endpoint
# Avaa: http://localhost:3000/api/cron

# 7. Deployaa Verceliin ja cron-job alkaa toimia automaattisesti
```

## 📊 Tietokantarakenne

```sql
traffic_data
├── id (UUID, primary key)
├── device_id (VARCHAR, risteyksen ID)
├── detector_id (VARCHAR, ilmaisimen ID)
├── measured_time (TIMESTAMP, mittausaika)
├── sg_name (VARCHAR, signal group)
├── detector_name (VARCHAR, ilmaisimen nimi)
├── measurement_name (VARCHAR, mittauksen tyyppi)
├── value (NUMERIC, mitattu arvo)
├── unit (VARCHAR, yksikkö)
├── interval (INTEGER, mittausväli)
├── reliability_value (NUMERIC, luotettavuus)
└── created_at (TIMESTAMP, tallennettu)
```

## 🔧 Seurattavien risteysten konfigurointi

Muokkaa `app/api/cron/route.ts`:

```typescript
const MONITORED_DEVICES = [
  {
    deviceId: 'OULU002',
    detectors: ['D01', 'D02', 'D03', 'D04']
  },
  {
    deviceId: 'OULU001', 
    detectors: ['D01', 'D02']
  }
  // Lisää haluamasi risteydet
];
```

## 📈 Cron-aikataulun muuttaminen

Muokkaa `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/5 * * * *"  // Joka 5. minuutti
    }
  ]
}
```

Esimerkkejä:
- `*/5 * * * *` - Joka 5. minuutti
- `*/15 * * * *` - Joka 15. minuutti (oletus)
- `0 * * * *` - Joka tunti
- `0 */6 * * *` - Joka 6. tunti

## 🔐 Turvallisuus

- ✅ Service Role Key käytetään vain palvelinpuolella
- ✅ CRON_SECRET suojaa endpointia ei-toivotuilta kutuilta
- ✅ RLS-policyt rajoittavat tietokannan käyttöä
- ✅ Aikaleiman tarkistus estää duplikaatit
- ✅ Ympäristömuuttujat eivät päädy klientille

## 📖 Lisäresurssit

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Vaiheittainen asennus
- [supabase/README.md](./supabase/README.md) - Yksityiskohtainen dokumentaatio
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

## ✅ Seuraavat askeleet

1. [ ] Asenna @supabase/supabase-js
2. [ ] Luo Supabase-projekti
3. [ ] Aja schema.sql
4. [ ] Konfiguroi ympäristömuuttujat
5. [ ] Testaa /api/test-supabase
6. [ ] Konfiguroi seurattavat risteydet
7. [ ] Testaa /api/cron paikallisesti
8. [ ] Deployaa Verceliin
9. [ ] Varmista että cron toimii
10. [ ] Tarkastele dataa Supabasessa

## 🎉 Valmista!

Supabase-integraatio on nyt valmis. Liikennetiedot tallentuvat automaattisesti tietokantaan ja niitä voidaan käyttää analytiikkaan, visualisointiin ja raportointiin.
