# Supabase API-avainten hakeminen

## Ongelma löytyi! ❌

`.env.local`-tiedostossa oli väärä API-avain. Avain `sb_publishable_...` on väärää muotoa.

## Oikeat Supabase API-avaimet

Supabase-avaimet alkavat yleensä `eyJ...` ja ovat pitkiä JWT-tokeneita.

### Hae oikeat avaimet näin:

1. **Mene Supabase Dashboardiin**
   - https://supabase.com/dashboard/project/hizjuayjprbyepsnaitz

2. **Avaa Settings → API**
   - Vasemmasta sivupalkista: Settings (rattaan ikoni)
   - Sitten: API

3. **Kopioi seuraavat avaimet:**

   **Project URL:**
   ```
   https://hizjuayjprbyepsnaitz.supabase.co
   ```
   ✅ Tämä on jo oikein!

   **anon public key:**
   - Kopioi "Project API keys" -osiosta
   - Avain alkaa: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Tämä on pitkä merkkijono (useita satoja merkkejä)

   **service_role key:**
   - Sama osio kuin yllä
   - Myös alkaa: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **VAROITUS:** Tätä avainta EI SAA jakaa julkisesti!

## Päivitä .env.local

Korvaa `.env.local`-tiedostossa avaimet näin:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hizjuayjprbyepsnaitz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhpemp1YXlqcHJieWVwc25haXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhpemp1YXlqcHJieWVwc25haXR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMi...

CRON_SECRET=xutnH7Njk2znLREbzL7Q
```

## Testaa yhteys uudelleen

Kun olet päivittänyt avaimet:

```bash
# 1. Käynnistä dev-palvelin uudelleen (jotta .env.local päivittyy)
npm run dev

# 2. Testaa yhteyttä
# Avaa selaimessa: http://localhost:3000/api/test-supabase
```

Pitäisi nähdä:
```json
{
  "success": true,
  "recommendation": "✅ Supabase on konfiguroitu oikein!"
}
```

## Miksi virhe tapahtui?

1. ❌ **Väärä avaimen nimi** - Käytettiin `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` → korjattu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. ❌ **Väärä avain** - Avain `sb_publishable_...` ei ole oikea Supabase anon key
3. ✅ **Korjaus** - Hae oikeat avaimet Supabase Dashboardista

## Jos yhteys ei vieläkään toimi

Tarkista että:
- [ ] Olet kopioinut **anon public** avaimen (ei service_role vielä tässä vaiheessa)
- [ ] Avain alkaa `eyJ...`
- [ ] Avain on useita satoja merkkejä pitkä
- [ ] Olet käynnistänyt dev-palvelimen uudelleen
- [ ] Supabase-projekti on käynnissä (ei paused)

## Supabase Dashboard

Suora linkki projektin API-asetuksiin:
https://supabase.com/dashboard/project/hizjuayjprbyepsnaitz/settings/api
