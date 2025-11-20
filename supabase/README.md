# Supabase-integraatio

Tämä dokumentti kuvaa Supabase-integraation konfiguroinnin ja käytön.

## Asennus

### 1. Luo Supabase-projekti

1. Mene osoitteeseen [supabase.com](https://supabase.com)
2. Luo uusi projekti
3. Odota projektin valmistumista

### 2. Luo tietokantataulu

1. Avaa Supabase Dashboard → SQL Editor
2. Kopioi `supabase/schema.sql`-tiedoston sisältö
3. Suorita SQL-skripti

Tämä luo:
- `traffic_data`-taulun liikennetiedoille
- Tarvittavat indeksit
- RLS-policyt (Row Level Security)
- `latest_traffic_data`-näkymän viimeisimmille mittauksille

### 3. Konfiguroi ympäristömuuttujat

Luo `.env.local`-tiedosto projektin juureen:

```env
# Supabase-asetukset (löydät nämä Supabase Dashboardista)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (valinnainen, parempi suojaus)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cron-suojaus (valinnainen)
CRON_SECRET=your-secret-key-here
```

**Huom!** Service Role Key:tä käytetään vain palvelinpuolella ja sillä on täydet oikeudet.

## Cron-endpointin käyttö

### Paikallinen testaus

```bash
# Ilman CRON_SECRET:ia
curl http://localhost:3000/api/cron

# CRON_SECRET:in kanssa
curl -H "Authorization: Bearer your-secret-key-here" http://localhost:3000/api/cron
```

### Vercel Cron Jobs

Lisää `vercel.json`-tiedostoon:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Tämä ajaa cron-jobin joka 5. minuutti.

**Cron schedule -esimerkkejä:**
- `*/5 * * * *` - Joka 5. minuutti
- `*/15 * * * *` - Joka 15. minuutti
- `0 * * * *` - Joka tunti
- `0 */6 * * *` - Joka 6. tunti
- `0 0 * * *` - Kerran päivässä keskiyöllä

### Seurattavien risteysten konfigurointi

Muokkaa `app/api/cron/route.ts`-tiedostossa `MONITORED_DEVICES`-arraytä:

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
  // Lisää muut risteydet tähän
];
```

## API-vastauksen muoto

### Onnistunut vastaus

```json
{
  "success": true,
  "timestamp": "2025-11-20T10:30:00.000Z",
  "summary": {
    "processed": 6,
    "saved": 4,
    "skipped": 2,
    "failed": 0
  },
  "details": [
    {
      "deviceId": "OULU002",
      "detectorId": "D01",
      "status": "saved"
    },
    {
      "deviceId": "OULU002",
      "detectorId": "D02",
      "status": "skipped_exists"
    }
  ]
}
```

### Virhetilanne

```json
{
  "success": false,
  "error": "Connection failed",
  "timestamp": "2025-11-20T10:30:00.000Z"
}
```

## Tietokannan kyselyt

### Hae viimeisimmät mittaukset

```sql
SELECT * FROM latest_traffic_data
ORDER BY measured_time DESC;
```

### Hae tietyn risteyksen tiedot

```sql
SELECT * FROM traffic_data
WHERE device_id = 'OULU002'
ORDER BY measured_time DESC
LIMIT 100;
```

### Hae tietyn aikavälin tiedot

```sql
SELECT * FROM traffic_data
WHERE measured_time BETWEEN '2025-11-20 00:00:00' AND '2025-11-20 23:59:59'
AND device_id = 'OULU002'
ORDER BY measured_time DESC;
```

### Tilastot risteyksittäin

```sql
SELECT 
  device_id,
  detector_id,
  COUNT(*) as measurement_count,
  AVG(value) as avg_value,
  MAX(measured_time) as latest_measurement
FROM traffic_data
GROUP BY device_id, detector_id
ORDER BY device_id, detector_id;
```

## Vianmääritys

### Cron-endpoint ei vastaa

1. Tarkista ympäristömuuttujat
2. Tarkista Supabase-projektin tila
3. Tarkista cron-lokit Vercel Dashboardista

### Data ei tallennu

1. Tarkista RLS-policyt Supabasessa
2. Varmista että Service Role Key on asetettu
3. Tarkista konsoliloki virheviestejä varten

### API-rajapinnan virheet

1. Varmista että TPM API on saatavilla
2. Tarkista device_id ja detector_id oikeinkirjoitus
3. Lisää viivettä API-kutsujen välille jos tarpeellista

## Turvallisuus

- **CRON_SECRET**: Käytä vahvaa satunnaista merkkijonoa
- **Service Role Key**: Älä koskaan jaa julkisesti tai commitoi Gitiin
- **RLS-policyt**: Määrittele tarkasti kuka voi lukea ja kirjoittaa dataa
- **Rate limiting**: Harkitse rate limiting -toiminnallisuuden lisäämistä

## Seuranta

Voit seurata cron-jobin toimintaa:

1. Vercel Dashboard → Deployments → Functions
2. Supabase Dashboard → Table Editor → traffic_data
3. Supabase Dashboard → Database → Logs

## Jatkokehitys

Mahdollisia parannuksia:

- Lisää virhetilanteiden seuranta (esim. Sentry)
- Lisää webhook-ilmoitukset epäonnistuneista ajoista
- Lisää data-aggregointi (tunti/päivä-tasolla)
- Lisää automaattinen vanhan datan arkistointi
- Lisää Grafana/dashboard-integraatio visualisointiin
