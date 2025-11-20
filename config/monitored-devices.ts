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
  description?: string;  // Valinnainen kuvaus (helpottaa hallintaa)
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
 *   description: 'Liikenneristeyksen nimi tai sijainti'
 * }
 */
export const MONITORED_DEVICES: MonitoredDevice[] = [
  {
    deviceId: 'OULU002',
    detectors: ['D1_50', 'LL3', 'LL4'],
    description: 'Saaristonkatu - Rautatienkatu'
  }, 
  {
    deviceId: 'OULU016',
    detectors: ['D1_30_1', 'D1_30_2', 'D5_30', 'LL1', 'LL2', 'LL3'],
    description: 'Pokkinen'
  },
  {
    deviceId: 'OULU022',
    detectors: ['D1_40'],
    description: 'Isokatu-Heikinkatu'
  },
  {
    deviceId: 'OULU024',
    detectors: ['D2_60_1M', 'D2_60_2M', 'D3_60M', 'D4_60', 'D11-60M', 'LL1', 'LL2', 'LL6'],
    description: 'Heikinkatu-Rautatienkatu'
  },
  {
    deviceId: 'OULU35',
    detectors: ['D3_55_1M', 'D3_55_2M', 'D6_40_1M', 'D15_60M', 'D11-60M', 'D1_55_1M', 'D1_55_2M', 'D1_55_3M', 'D2_40M'],
    description: 'Limingantie-Joutsentie'
  },
  // Lisää uusia risteyksii tähän:
  // {
  //   deviceId: 'OULU003',
  //   detectors: ['D01', 'D02', 'D03'],
  //   description: 'Kuvaus risteyksestä'
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
