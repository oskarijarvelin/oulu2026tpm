/**
 * Supabase Database Types
 * 
 * TypeScript-tyyppimäärittelyt Supabase-tietokannalle.
 * Päivitä nämä kun tietokannan rakenne muuttuu.
 */

/**
 * Liikennetietojen tietue tietokannassa
 */
export interface TrafficDataRecord {
  id: string;
  device_id: string;
  detector_id: string;
  measured_time: string; // ISO timestamp
  sg_name: string | null;
  detector_name: string | null;
  measurement_name: string;
  value: number;
  unit: string | null;
  interval: number | null;
  reliability_value: number | null;
  created_at: string; // ISO timestamp
}

/**
 * Uuden tietueen lisääminen (ilman id:tä ja created_at:ia)
 */
export type TrafficDataInsert = Omit<TrafficDataRecord, 'id' | 'created_at'> & {
  created_at?: string;
};

/**
 * Tietueen päivitys (kaikki kentät valinnaiset)
 */
export type TrafficDataUpdate = Partial<TrafficDataInsert>;

/**
 * Supabase Database tyyppi
 */
export interface Database {
  public: {
    Tables: {
      traffic_data: {
        Row: TrafficDataRecord;
        Insert: TrafficDataInsert;
        Update: TrafficDataUpdate;
      };
    };
    Views: {
      latest_traffic_data: {
        Row: TrafficDataRecord;
      };
    };
  };
}

/**
 * Helper-tyyppi taulujen hakemiseen
 */
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

/**
 * Helper-tyyppi näkymien hakemiseen
 */
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
