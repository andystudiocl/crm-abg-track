// Tipos de la base escritos a mano según supabase/schema.sql.
// Si cambias el esquema, actualiza este archivo (o genéralo con `supabase gen types`).

export type AdvisorRole = 'admin' | 'asesor';
export type VehicleStatus = 'en_camino' | 'disponible' | 'reservado' | 'vendido';
export type LeadSource = 'meta_ads' | 'whatsapp' | 'web' | 'manual';
export type LeadStatus = 'nuevo' | 'contactado' | 'agendado' | 'negociacion' | 'ganado' | 'perdido';
export type MessageDirection = 'in' | 'out';

export type AdvisorRow = {
  id: string;
  name: string;
  email: string;
  role: AdvisorRole;
  google_refresh_token: string | null;
  google_connected: boolean;
  created_at: string;
};

export type VehicleRow = {
  id: string;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  km: number;
  precio_clp: number;
  combustible: string | null;
  transmision: string | null;
  color: string | null;
  patente: string | null;
  descripcion: string | null;
  status: VehicleStatus;
  published: boolean;
  arrived_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VehiclePhotoRow = {
  id: string;
  vehicle_id: string;
  path: string;
  position: number;
  is_cover: boolean;
  created_at: string;
};

export type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  vehicle_id: string | null;
  advisor_id: string | null;
  campaign: string | null;
  notes: string | null;
  external_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadMessageRow = {
  id: string;
  lead_id: string;
  direction: MessageDirection;
  body: string;
  wa_message_id: string | null;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  lead_id: string;
  advisor_id: string | null;
  vehicle_id: string | null;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  google_event_id: string | null;
  created_at: string;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      advisors: {
        Row: AdvisorRow;
        Insert: Optional<AdvisorRow, 'name' | 'email' | 'role' | 'google_refresh_token' | 'google_connected' | 'created_at'>;
        Update: Partial<Omit<AdvisorRow, 'google_connected'>>;
        Relationships: [];
      };
      vehicles: {
        Row: VehicleRow;
        Insert: Optional<
          VehicleRow,
          | 'id' | 'version' | 'km' | 'precio_clp' | 'combustible' | 'transmision' | 'color' | 'patente'
          | 'descripcion' | 'status' | 'published' | 'arrived_at' | 'sold_at' | 'created_at' | 'updated_at'
        >;
        Update: Partial<VehicleRow>;
        Relationships: [];
      };
      vehicle_photos: {
        Row: VehiclePhotoRow;
        Insert: Optional<VehiclePhotoRow, 'id' | 'position' | 'is_cover' | 'created_at'>;
        Update: Partial<VehiclePhotoRow>;
        Relationships: [
          {
            foreignKeyName: 'vehicle_photos_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      leads: {
        Row: LeadRow;
        Insert: Optional<
          LeadRow,
          | 'id' | 'name' | 'phone' | 'email' | 'source' | 'status' | 'vehicle_id' | 'advisor_id' | 'campaign'
          | 'notes' | 'external_id' | 'last_message_at' | 'created_at' | 'updated_at'
        >;
        Update: Partial<LeadRow>;
        Relationships: [
          {
            foreignKeyName: 'leads_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_advisor_id_fkey';
            columns: ['advisor_id'];
            isOneToOne: false;
            referencedRelation: 'advisors';
            referencedColumns: ['id'];
          },
        ];
      };
      lead_messages: {
        Row: LeadMessageRow;
        Insert: Optional<LeadMessageRow, 'id' | 'body' | 'wa_message_id' | 'created_at'>;
        Update: Partial<LeadMessageRow>;
        Relationships: [
          {
            foreignKeyName: 'lead_messages_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: AppointmentRow;
        Insert: Optional<AppointmentRow, 'id' | 'advisor_id' | 'vehicle_id' | 'notes' | 'google_event_id' | 'created_at'>;
        Update: Partial<AppointmentRow>;
        Relationships: [
          {
            foreignKeyName: 'appointments_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_advisor_id_fkey';
            columns: ['advisor_id'];
            isOneToOne: false;
            referencedRelation: 'advisors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      advisor_role: AdvisorRole;
      vehicle_status: VehicleStatus;
      lead_source: LeadSource;
      lead_status: LeadStatus;
      message_direction: MessageDirection;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
