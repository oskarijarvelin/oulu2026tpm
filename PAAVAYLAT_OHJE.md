# Päävaylät-sivun käyttöohje

## Yleiskatsaus

Päävaylät-sivu (`/paavaylat`) näyttää kaikki Supabase-tietokannasta haetut liikennemäärät risteyskohtaisesti taulukkomuodossa ja graafeina.

## Ominaisuudet

### 1. Yhteenvetokortit
- **Kaupunkiin saapuvat (IN)**: Näyttää kaikkien seurattujen risteysten IN-suunnan yhteenlasketun liikennemäärän
- **Kaupungista poistuvat (OUT)**: Näyttää kaikkien seurattujen risteysten OUT-suunnan yhteenlasketun liikennemäärän
- Molemmissa korteissa näkyy viimeisin mittausaika

### 2. Suodattimet

#### Aikaväli (Aggregointi)
Määrittää miten data ryhmitellään:
- **5 minuuttia**: Liikennemäärät 5 minuutin välein
- **15 minuuttia**: Liikennemäärät 15 minuutin välein (oletus)
- **Tunti**: Tuntikohtaiset liikennemäärät
- **Päivä**: Päiväkohtaiset liikennemäärät
- **Viikko**: Viikoittaiset liikennemäärät
- **Kuukausi**: Kuukausittaiset liikennemäärät
- **Vuosi**: Vuosittaiset liikennemäärät

#### Aloitusaika ja Lopetusaika
- Voit rajata tarkasteltavan aikavälin valitsemalla aloitus- ja lopetusajan
- Jätä tyhjäksi jos haluat nähdä kaiken datan

#### Nollaa filtterit
- Palauttaa kaikki suodattimet oletusarvoihin

### 3. Risteyskohtainen taulukko

Taulukko näyttää jokaisen risteyksen yhteenvedon:

| Sarake | Kuvaus |
|--------|--------|
| **Risteys** | Risteyksen ID ja kuvaus. Näyttää myös ilmaisimien määrän IN/OUT-suunnille |
| **Saapuvat (IN)** | Kaupunkiin saapuvien ajoneuvojen määrä (vihreä) |
| **Poistuvat (OUT)** | Kaupungista poistuvien ajoneuvojen määrä (sininen) |
| **Viimeisin mittaus** | Viimeisimmän mittauksen aikaleima |

#### Järjestäminen
- Klikkaa sarakkeen otsikkoa järjestääksesi sen mukaan
- Klikkaa uudelleen vaihtaaksesi nouseva/laskeva järjestys
- Nuoli (▲/▼) näyttää nykyisen järjestyksen

#### Rivin klikkaaminen
- Klikkaa riviä nähdäksesi yksityiskohtaiset ilmaisintiedot kyseisestä risteyksestä

### 4. Graafit

#### Yhteenveto-graafi
- Näyttää kaikkien risteysten yhteenlasketun liikenteen kehityksen
- **Vihreä viiva**: Kaupunkiin saapuvat (IN)
- **Sininen viiva**: Kaupungista poistuvat (OUT)
- X-akseli: Aika (suodattimien mukaan)
- Y-akseli: Ajoneuvojen määrä

#### Risteyskohtainen graafi
- Näyttää jokaisen risteyksen IN/OUT-liikenteen erikseen
- Katkoviiva: IN-suunta
- Yhtenäinen viiva: OUT-suunta
- Väri vaihtelee risteyksen mukaan

### 5. Yksityiskohtaiset ilmaisintiedot

Kun klikkaat taulukon riviä, avautuu yksityiskohtainen näkymä:

- **Risteyksen nimi ja ID**
- **Suunta** (IN/OUT)
- **Ilmaisimien tilastot**:
  - Jokaisen ilmaisimen ID
  - Mittausten määrä
  - Viimeisin arvo
  - Aikaleima

Sulje näkymä klikkaamalla "Sulje"-nappia.

## Käyttöesimerkkejä

### Esimerkki 1: Tarkastele viikon liikennemääriä tunneittain
1. Valitse "Aikaväli": **Tunti**
2. Aseta "Aloitusaika": esim. `2024-01-15 00:00`
3. Aseta "Lopetusaika": esim. `2024-01-22 00:00`
4. Taulukko ja graafit päivittyvät automaattisesti

### Esimerkki 2: Etsi vilkkain risteys
1. Klikkaa "Saapuvat (IN)" sarakkeen otsikkoa
2. Klikkaa uudelleen järjestääksesi laskevaan järjestykseen (▼)
3. Vilkkain risteys on nyt ylimpänä

### Esimerkki 3: Vertaa päiväkohtaisia liikennemääriä
1. Valitse "Aikaväli": **Päivä**
2. Valitse "Aloitusaika" ja "Lopetusaika" haluamallesi aikavälille
3. Tarkastele graafeja nähdäksesi päivittäiset vaihtelut

## Tietolähde

Data haetaan Supabase-tietokannasta taulusta `traffic_data`. Cron-job päivittää dataa automaattisesti 15 minuutin välein TPM API:sta.

## Seuratut risteydet

Nykyiset seuratut risteyket löytyvät tiedostosta `config/monitored-devices.ts`:

- OULU002: Saaristonkatu - Rautatienkatu
- OULU016: Pokkinen
- OULU022: Isokatu-Heikinkatu
- OULU024: Heikinkatu-Rautatienkatu
- OULU35: Limingantie-Joutsentie

Jokainen risteys seurataan molempiin suuntiin (IN/OUT).

## Tekninen toteutus

- **Frontend**: Next.js 16, React, TypeScript
- **Graafikirjasto**: Recharts
- **Tietokanta**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Data-aggregointi**: Client-side JavaScript

## Vinkkejä

- 💡 Käytä suurempia aikavälejä (päivä/viikko) pitkien ajanjaksojen tarkasteluun
- 💡 Käytä pieniä aikavälejä (5/15 min) yksityiskohtaiseen analyysiin
- 💡 Järjestä taulukkoa eri sarakkeiden mukaan löytääksesi kiinnostavia trendejä
- 💡 Klikkaa riviä nähdäksesi mitä ilmaisimia kyseisessä risteyksessä on
- 💡 Tarkastele graafeja nähdäksesi liikenteen kehityksen visuaalisesti
