-- Liikennetietojen tallennus Supabasessa
-- 
-- Tämä tietokantataulu tallentaa TPM-risteysten liikennetiedot.
-- Jokainen rivi sisältää yhden mittauksen yhdeltä ilmaisimelta.
-- 
-- Käyttö:
-- 1. Luo tämä taulu Supabase SQL Editorissa
-- 2. RLS (Row Level Security) voidaan konfiguroida tarpeen mukaan
-- 3. Cron-endpoint tallentaa tähän tauluun automaattisesti

-- Luo traffic_data -taulu
CREATE TABLE IF NOT EXISTS traffic_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Risteyksen ja ilmaisimen tunnisteet
  device_id VARCHAR(50) NOT NULL,
  detector_id VARCHAR(50) NOT NULL,
  
  -- Mittausaika
  measured_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Signal group ja ilmaisimen tiedot
  sg_name VARCHAR(100),
  detector_name VARCHAR(100),
  measurement_name VARCHAR(100) NOT NULL,
  
  -- Mitattu arvo ja metatiedot
  value NUMERIC NOT NULL,
  unit VARCHAR(20),
  interval INTEGER,
  reliability_value NUMERIC,
  
  -- Tietueen luontiaika
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indeksi nopeampaan hakuun
  CONSTRAINT unique_measurement UNIQUE (device_id, detector_id, measured_time, measurement_name)
);

-- Indeksit kyselyjen optimointiin
CREATE INDEX IF NOT EXISTS idx_traffic_device_time ON traffic_data(device_id, measured_time DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_detector_time ON traffic_data(detector_id, measured_time DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_measured_time ON traffic_data(measured_time DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_device_detector ON traffic_data(device_id, detector_id);

-- Kommentteja tauluun ja sarakkeisiin
COMMENT ON TABLE traffic_data IS 'TPM-risteysten liikennetiedot';
COMMENT ON COLUMN traffic_data.device_id IS 'Risteyksen tunniste (esim. OULU002)';
COMMENT ON COLUMN traffic_data.detector_id IS 'Ilmaisimen tunniste (esim. D01)';
COMMENT ON COLUMN traffic_data.measured_time IS 'Mittauksen aikaleima';
COMMENT ON COLUMN traffic_data.value IS 'Mitattu liikennemäärä';
COMMENT ON COLUMN traffic_data.reliability_value IS 'Mittauksen luotettavuusarvo';

-- Row Level Security (RLS) - Voit muokata näitä tarpeen mukaan
ALTER TABLE traffic_data ENABLE ROW LEVEL SECURITY;

-- Luku-oikeus kaikille (jos haluat julkisen datan)
CREATE POLICY "Allow public read access" ON traffic_data
  FOR SELECT
  USING (true);

-- Kirjoitusoikeus vain autentikoiduille (service role)
CREATE POLICY "Allow authenticated insert" ON traffic_data
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Näkymä viimeisimmistä mittauksista per risteys
CREATE OR REPLACE VIEW latest_traffic_data AS
SELECT DISTINCT ON (device_id, detector_id)
  id,
  device_id,
  detector_id,
  measured_time,
  sg_name,
  detector_name,
  measurement_name,
  value,
  unit,
  interval,
  reliability_value,
  created_at
FROM traffic_data
ORDER BY device_id, detector_id, measured_time DESC;

COMMENT ON VIEW latest_traffic_data IS 'Viimeisimmät mittaukset per risteys ja ilmaisin';
