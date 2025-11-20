/**
 * Seurattavien risteysten ja ilmaisimien konfiguraatio
 * 
 * Tämä tiedosto määrittelee mitkä TPM-risteydet ja niiden ilmaisimet
 * tallennetaan automaattisesti Supabase-tietokantaan.
 * 
 * Lisää tai poista risteyksii ja ilmaisimia tarpeen mukaan.
 * Cron-job käyttää tätä listaa päättääkseen mitä dataa haetaan.
 */

/**
 * Seurattavan laitteen tyyppi
 */
export interface MonitoredDevice {
  deviceId: string;      // Risteyksen tunniste (esim. "OULU002")
  detectors: string[];   // Ilmaisimien tunnisteet (esim. ["D01", "D02"])
  direction: 'IN' | 'OUT' | 'ALL';  // Liikenteen suunta: IN = kaupunkiin, OUT = kaupungista, ALL = kaikki
  description?: string;  // Valinnainen kuvaus (helpottaa hallintaa)
  keywords?: string[];   // Avainsanat risteyksen merkitsemiseen ja suodattamiseen
}

/**
 * Lista seurattavista risteyksistä ja niiden ilmaisimista
 * 
 * Muokkaa tätä listaa lisätäksesi tai poistaaksesi seurattavia risteyksii.
 * 
 * Esimerkki:
 * {
 *   deviceId: 'OULU002',
 *   detectors: ['D01', 'D02', 'D03', 'D04'],
 *   direction: 'IN',
 *   description: 'Liikenneristeyksen nimi tai sijainti',
 *   keywords: ['keskusta', 'päätie', 'vilkas']
 * }
 */
export const MONITORED_DEVICES: MonitoredDevice[] = [
  {
    deviceId: 'OULU002',
    detectors: ['D1_50'],
    direction: 'IN',
    description: 'Saaristonkatu - Rautatienkatu',
    keywords: ['Pääväylä']
  }, 
  {
    deviceId: 'OULU002',
    detectors: ['LL3', 'LL4'],
    direction: 'OUT',
    description: 'Saaristonkatu - Rautatienkatu',
    keywords: ['Pääväylä']
  }, 
  {
    deviceId: 'OULU016',
    detectors: ['D1_30_1', 'D1_30_2', 'D5_30'],
    direction: 'IN',
    description: 'Pokkinen',
    keywords: ['Pääväylä', 'Sandy']
  },
  {
    deviceId: 'OULU016',
    detectors: ['LL1', 'LL2', 'LL3'],
    direction: 'OUT',
    description: 'Pokkinen',
    keywords: ['Pääväylä', 'Sandy']
  },
  {
    deviceId: 'OULU020',
    detectors: ['D1_50', 'D2_60_1', 'D2_60_2', 'D3_40', 'D3_50_1', 'D4_40'],
    direction: 'ALL',
    description: 'Saaristonkatu - Aleksanterinkatu',
    keywords: ['Sandy']
  },
  {
    deviceId: 'OULU022',
    detectors: ['D1_40'],
    direction: 'IN',
    description: 'Isokatu-Heikinkatu',
    keywords: ['Pääväylä']
  },
  {
    deviceId: 'OULU024',
    detectors: ['D2_60_1M', 'D2_60_2M', 'D3_60M', 'D4_60', 'D11-60M'],
    direction: 'IN',
    description: 'Heikinkatu-Rautatienkatu',
    keywords: ['Pääväylä']
  },
  {
    deviceId: 'OULU024',
    detectors: ['LL1', 'LL2', 'LL6'],
    direction: 'OUT',
    description: 'Heikinkatu-Rautatienkatu',
    keywords: ['Pääväylä']
  },
  {
    deviceId: 'OULU35',
    detectors: ['D3_55_1M', 'D3_55_2M', 'D6_40_1M', 'D15_60M', 'D11-60M'],
    direction: 'IN',
    description: 'Limingantie-Joutsentie',
    keywords: ['Pääväylä']
  },
  {
    deviceId: 'OULU35',
    detectors: ['D1_55_1M', 'D1_55_2M', 'D1_55_3M', 'D2_40M'],
    direction: 'OUT',
    description: 'Limingantie-Joutsentie',
    keywords: ['Pääväylä']
  },
  // Lisää uusia risteyksii tähän:
  // {
  //   deviceId: 'OULU003',
  //   detectors: ['D01', 'D02', 'D03'],
  //   direction: 'IN',
  //   description: 'Kuvaus risteyksestä',
  //   keywords: ['avainsana1', 'avainsana2']
  // },
];

/**
 * Palauttaa kaikkien seurattavien laitteiden määrän
 */
export function getTotalDeviceCount(): number {
  return MONITORED_DEVICES.length;
}

/**
 * Palauttaa kaikkien seurattavien ilmaisimien määrän
 */
export function getTotalDetectorCount(): number {
  return MONITORED_DEVICES.reduce((total, device) => total + device.detectors.length, 0);
}

/**
 * Palauttaa tietyn laitteen ilmaisimien määrän
 */
export function getDetectorCountForDevice(deviceId: string): number {
  const device = MONITORED_DEVICES.find(d => d.deviceId === deviceId);
  return device ? device.detectors.length : 0;
}

/**
 * Tarkistaa onko tietty laite seurattavien listalla
 */
export function isDeviceMonitored(deviceId: string): boolean {
  return MONITORED_DEVICES.some(d => d.deviceId === deviceId);
}

/**
 * Tarkistaa onko tietty ilmaisin seurattavien listalla
 */
export function isDetectorMonitored(deviceId: string, detectorId: string): boolean {
  const device = MONITORED_DEVICES.find(d => d.deviceId === deviceId);
  return device ? device.detectors.includes(detectorId) : false;
}
