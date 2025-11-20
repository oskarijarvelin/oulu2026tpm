# Supabase-integraation asennus

## Vaihe 1: Asenna tarvittavat riippuvuudet

```bash
npm install @supabase/supabase-js
```

## Vaihe 2: Luo Supabase-projekti

1. Mene osoitteeseen https://supabase.com
2. Kirjaudu sisään tai luo tili
3. Klikkaa "New Project"
4. Anna projektille nimi (esim. "oulu-tpm")
5. Aseta vahva tietokannan salasana
6. Valitse alue (suositus: eu-north-1 Tukholma)
7. Klikkaa "Create new project"
8. Odota että projekti on valmis (kestää n. 2 minuuttia)

## Vaihe 3: Luo tietokantataulu

1. Supabase Dashboardissa, mene kohtaan **SQL Editor** (vasemmasta sivupalkista)
2. Klikkaa "+ New query"
3. Kopioi koko `supabase/schema.sql` -tiedoston sisältö
4. Liitä se SQL-editoriin
5. Klikkaa "Run" (tai paina Ctrl+Enter)
6. Varmista että näet vihreän "Success" -viestin

## Vaihe 4: Hae API-avaimet

1. Mene kohtaan **Settings → API** (vasemmasta sivupalkista)
2. Kopioi seuraavat arvot:

   - **Project URL** (esim. https://xxxxx.supabase.co)
   - **anon public** key (pitkä JWT-token)
   - **service_role** key (pitkä JWT-token) - **ÄLÄ JAA JULKISESTI!**

## Vaihe 5: Konfiguroi ympäristömuuttujat

1. Kopioi `.env.local.example` → `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Avaa `.env.local` ja täytä arvot:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   CRON_SECRET=luo-vahva-satunnainen-merkkijono-tähän
   ```

## Vaihe 6: Testaa yhteys

1. Käynnistä kehityspalvelin:
   ```bash
   npm run dev
   ```

2. Avaa selaimessa:
   ```
   http://localhost:3000/api/test-supabase
   ```

3. Tarkista vastaus:
   - ✅ Jos kaikki on vihreää, olet valmis!
   - ❌ Jos näet virheitä, tarkista ympäristömuuttujat

## Vaihe 7: Konfiguroi seurattavat risteydet

Muokkaa `app/api/cron/route.ts` -tiedostoa:

```typescript
const MONITORED_DEVICES = [
  {
    deviceId: 'OULU002',
    detectors: ['D01', 'D02', 'D03', 'D04']
  },
  {
    deviceId: 'OULU001',
    detectors: ['D01', 'D02']
  },
  // Lisää haluamasi risteydet ja ilmaisimet
];
```

## Vaihe 8: Testaa cron-endpointia paikallisesti

```bash
# Windowsissa (PowerShell)
Invoke-WebRequest -Uri "http://localhost:3000/api/cron"

# Tai selaimessa
http://localhost:3000/api/cron
```

Pitäisi nähdä JSON-vastaus jossa on yhteenveto tallennetuista tietueista.

## Vaihe 9: Ota käyttöön Vercelissä

1. Deployaa sovellus Verceliin normaalisti
2. Lisää ympäristömuuttujat Vercel Dashboardissa:
   - Settings → Environment Variables
   - Lisää kaikki `.env.local` -muuttujat

3. Vercel huomaa automaattisesti `vercel.json` -tiedoston ja ajaa cron-jobin
   joka 15. minuutti

## Vaihe 10: Seuraa toimintaa

### Supabasessa:
1. Table Editor → traffic_data
2. Näet tallennetut mittaukset

### Vercelissä:
1. Deployments → Functions
2. Näet cron-jobin ajot ja lokit

## Vianmääritys

### "Connection failed"
- Tarkista että NEXT_PUBLIC_SUPABASE_URL on oikein
- Tarkista että Supabase-projekti on käynnissä

### "Table 'traffic_data' does not exist"
- Aja `supabase/schema.sql` uudelleen SQL Editorissa

### "Insert failed" tai "Permission denied"
- Tarkista että SUPABASE_SERVICE_ROLE_KEY on asetettu
- Tarkista RLS-policyt Supabasessa

### Cron ei aja Vercelissä
- Varmista että `vercel.json` on projektin juuressa
- Varmista että olet Vercel Pro -tilauksella (ilmainen tier ei tue croneja)
- Tarkista Vercel Dashboard → Cron Jobs

## Seuraavat askeleet

✅ Testaa että data tallentuu  
✅ Tarkista Supabase Table Editorista että tietueet näkyvät  
✅ Deployaa Verceliin  
✅ Seuraa että cron-job toimii  
✅ Harkitse datan visualisointia omalla sivulla  

## Tuki

Jos kohtaat ongelmia:
1. Tarkista `supabase/README.md` yksityiskohtaiset ohjeet
2. Katso Supabase-dokumentaatio: https://supabase.com/docs
3. Tarkista konsoliloki virheviestejä
