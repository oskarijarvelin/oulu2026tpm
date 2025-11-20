# Oulu 2026 TPM - Liikenne- ja laskenta-asemien visualisointisovellus

Interaktiivinen Next.js-sovellus Oulun liikenteen ja jalankulkijoiden/pyöräilijöiden seurantaan. Sovellus visualisoi reaaliaikaista dataa TPM-risteyksistä ja Eco Counter -laskenta-asemilta.

## Ominaisuudet

### 🚦 TPM-risteysdata
- Interaktiivinen kartta TPM-risteyksistä Oulussa
- Reaaliaikainen liikennedata eri ilmaisimilla
- Yksityiskohtainen näkymä risteyskohtaiseen dataan
- Suodattimet ajanjaksojen tarkasteluun

### 🚶‍♂️ Jalankulkija- ja pyöräilijälaskennat
- Eco Counter -laskenta-asemien karttanäkymä
- Yksityiskohtaiset tilastot ja graafit
- Interaktiiviset kaaviot tooltipeilla
- Monikanavadata (saapuvat/poistuvat jalankulkijat ja pyöräilijät)
- Joustavat aikavälit: 15 min, tunti, päivä, viikko, kuukausi, vuosi
- Vapaavalintaiset alku- ja loppupäivämäärät

## Teknologiat

- **Next.js 16.0.3** - React-pohjainen web-framework
- **TypeScript** - Tyypitetty JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet** - Interaktiiviset kartat
- **GraphQL** - API-kyselyt Oulun liikenteen avoimeen dataan
- **Proj4** - Koordinaattimuunnokset (TM35FIN → WGS84)
- **Supabase** - Liikennetietojen tallennus ja hallinta

## Käynnistäminen

Asenna riippuvuudet:

```bash
npm install
```

Konfiguroi ympäristömuuttujat:

```bash
cp .env.local.example .env.local
# Muokkaa .env.local -tiedostoa omilla Supabase-asetuksillasi
```

Käynnistä kehityspalvelin:

```bash
npm run dev
```

Avaa [http://localhost:3000](http://localhost:3000) selaimessa.

## Supabase-integraatio

Sovellus tallentaa liikennetiedot automaattisesti Supabase-tietokantaan.

### Asennus ja konfigurointi

Katso yksityiskohtaiset ohjeet: [supabase/README.md](./supabase/README.md)

Lyhyesti:
1. Luo Supabase-projekti
2. Aja `supabase/schema.sql` SQL Editorissa
3. Konfiguroi `.env.local` -tiedosto
4. Cron-endpoint `/api/cron` hakee ja tallentaa dataa automaattisesti

### Cron-job

Vercel-deploymentissa cron-job ajaa automaattisesti joka 15. minuutti ja tallentaa uudet liikennemittaukset tietokantaan.

## Sivurakenne

- `/` - TPM-risteysten karttanäkymä
- `/jalankulkijat` - Laskenta-asemien karttanäkymä
- `/jalankulkijat/[id]` - Yksittäisen laskenta-aseman yksityiskohtainen näkymä
- `/risteys` - Risteyskohtainen datanäkymä
- `/api/cron` - Automaattinen liikennetietojen tallennus (cron-endpoint)

## API:t

Sovellus käyttää Oulun liikenteen avointa dataa:
- **GraphQL API**: `https://api.oulunliikenne.fi/proxy/graphql`
- **Risteysdata**: CSV-muotoinen TPM-data
- **Laskenta-asemat**: Eco Counter -data

## Lisätietoja

- [Oulun liikenteen avoin data](https://wp.oulunliikenne.fi/avoin-data/)
- [Next.js dokumentaatio](https://nextjs.org/docs)

## Tekijä

© 2025 Oskari Järvelin
