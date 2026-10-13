export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      categories: {
        Row: {
          blurb: NonNullable<Json>;
          created_at: string;
          id: string;
          is_visible: boolean;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          blurb?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          name: NonNullable<Json>;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          blurb?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      closures: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          note: NonNullable<Json>;
          source: string;
          starts_on: string;
        };
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          note?: NonNullable<Json>;
          source?: string;
          starts_on: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          note?: NonNullable<Json>;
          source?: string;
          starts_on?: string;
        };
        Relationships: [];
      };
      delivery_zones: {
        Row: {
          created_at: string;
          fee_tetri: number | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["zone_kind"];
          min_order_tetri: number | null;
          name: string;
          polygon: Json | null;
          radius_km: number | null;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          fee_tetri?: number | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["zone_kind"];
          min_order_tetri?: number | null;
          name: string;
          polygon?: Json | null;
          radius_km?: number | null;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          fee_tetri?: number | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["zone_kind"];
          min_order_tetri?: number | null;
          name?: string;
          polygon?: Json | null;
          radius_km?: number | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      dining_tables: {
        Row: {
          area: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          seats: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          area?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          seats?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          area?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          seats?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      integration_settings: {
        Row: {
          id: number;
          sheet_categories_csv_url: string | null;
          sheet_hours_csv_url: string | null;
          sheet_menu_csv_url: string | null;
          sheet_options_csv_url: string | null;
          sheet_refresh_minutes: number;
          sheet_settings_csv_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          sheet_categories_csv_url?: string | null;
          sheet_hours_csv_url?: string | null;
          sheet_menu_csv_url?: string | null;
          sheet_options_csv_url?: string | null;
          sheet_refresh_minutes?: number;
          sheet_settings_csv_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          sheet_categories_csv_url?: string | null;
          sheet_hours_csv_url?: string | null;
          sheet_menu_csv_url?: string | null;
          sheet_options_csv_url?: string | null;
          sheet_refresh_minutes?: number;
          sheet_settings_csv_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      item_modifier_groups: {
        Row: {
          group_id: string;
          item_id: string;
          sort_order: number;
        };
        Insert: {
          group_id: string;
          item_id: string;
          sort_order?: number;
        };
        Update: {
          group_id?: string;
          item_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "item_modifier_groups_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_modifier_groups_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          allergens: string[];
          category_id: string;
          created_at: string;
          description: NonNullable<Json>;
          id: string;
          is_available: boolean;
          is_popular: boolean;
          is_veg: boolean;
          is_visible: boolean;
          name: NonNullable<Json>;
          photo_path: string | null;
          price_tetri: number;
          slug: string;
          sold_out_until: string | null;
          sort_order: number;
          spice_level: number | null;
          updated_at: string;
        };
        Insert: {
          allergens?: string[];
          category_id: string;
          created_at?: string;
          description?: NonNullable<Json>;
          id?: string;
          is_available?: boolean;
          is_popular?: boolean;
          is_veg?: boolean;
          is_visible?: boolean;
          name: NonNullable<Json>;
          photo_path?: string | null;
          price_tetri: number;
          slug: string;
          sold_out_until?: string | null;
          sort_order?: number;
          spice_level?: number | null;
          updated_at?: string;
        };
        Update: {
          allergens?: string[];
          category_id?: string;
          created_at?: string;
          description?: NonNullable<Json>;
          id?: string;
          is_available?: boolean;
          is_popular?: boolean;
          is_veg?: boolean;
          is_visible?: boolean;
          name?: NonNullable<Json>;
          photo_path?: string | null;
          price_tetri?: number;
          slug?: string;
          sold_out_until?: string | null;
          sort_order?: number;
          spice_level?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      modifier_groups: {
        Row: {
          created_at: string;
          id: string;
          max_select: number;
          min_select: number;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          max_select?: number;
          min_select?: number;
          name: NonNullable<Json>;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          max_select?: number;
          min_select?: number;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      modifier_options: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          is_available: boolean;
          is_default: boolean;
          name: NonNullable<Json>;
          price_delta_tetri: number;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          is_available?: boolean;
          is_default?: boolean;
          name: NonNullable<Json>;
          price_delta_tetri?: number;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          is_available?: boolean;
          is_default?: boolean;
          name?: NonNullable<Json>;
          price_delta_tetri?: number;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modifier_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      opening_hours: {
        Row: {
          closes_at: string;
          id: string;
          opens_at: string;
          source: string;
          weekday: number;
        };
        Insert: {
          closes_at: string;
          id?: string;
          opens_at: string;
          source?: string;
          weekday: number;
        };
        Update: {
          closes_at?: string;
          id?: string;
          opens_at?: string;
          source?: string;
          weekday?: number;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: number;
          note: string | null;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          note?: string | null;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          note?: string | null;
          order_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
        };
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          base_price_tetri: number;
          id: string;
          item_name: NonNullable<Json>;
          item_slug: string;
          kot_round: number;
          line_total_tetri: number;
          menu_item_id: string | null;
          modifiers: NonNullable<Json>;
          notes: string | null;
          order_id: string;
          quantity: number;
          sort_order: number;
          unit_price_tetri: number;
        };
        Insert: {
          base_price_tetri: number;
          id?: string;
          item_name: NonNullable<Json>;
          item_slug: string;
          kot_round?: number;
          line_total_tetri: number;
          menu_item_id?: string | null;
          modifiers?: NonNullable<Json>;
          notes?: string | null;
          order_id: string;
          quantity: number;
          sort_order?: number;
          unit_price_tetri: number;
        };
        Update: {
          base_price_tetri?: number;
          id?: string;
          item_name?: NonNullable<Json>;
          item_slug?: string;
          kot_round?: number;
          line_total_tetri?: number;
          menu_item_id?: string | null;
          modifiers?: NonNullable<Json>;
          notes?: string | null;
          order_id?: string;
          quantity?: number;
          sort_order?: number;
          unit_price_tetri?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_prints: {
        Row: {
          copy_no: number;
          id: number;
          kind: string;
          order_id: string;
          printed_at: string;
          printed_by: string | null;
          round: number;
        };
        Insert: {
          copy_no: number;
          id?: never;
          kind: string;
          order_id: string;
          printed_at?: string;
          printed_by?: string | null;
          round?: number;
        };
        Update: {
          copy_no?: number;
          id?: never;
          kind?: string;
          order_id?: string;
          printed_at?: string;
          printed_by?: string | null;
          round?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_prints_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          accepted_at: string | null;
          address_lat: number | null;
          address_lng: number | null;
          address_text: string | null;
          client_ip_hash: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_locale: string;
          customer_name: string;
          customer_phone: string;
          delivery_fee_tetri: number;
          delivery_zone_id: string | null;
          discount_tetri: number;
          distance_km: number | null;
          estimated_ready_at: string | null;
          id: string;
          idempotency_key: string | null;
          kot_round: number;
          notes: string | null;
          order_number: number;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_provider: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          prep_minutes: number | null;
          public_id: string;
          ready_at: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          request_hash: string;
          scheduled_for: string | null;
          source: Database["public"]["Enums"]["order_source"];
          status: Database["public"]["Enums"]["order_status"];
          subtotal_tetri: number;
          table_id: string | null;
          table_label: string | null;
          total_tetri: number;
          type: Database["public"]["Enums"]["order_type"];
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          address_lat?: number | null;
          address_lng?: number | null;
          address_text?: string | null;
          client_ip_hash?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_locale?: string;
          customer_name: string;
          customer_phone: string;
          delivery_fee_tetri?: number;
          delivery_zone_id?: string | null;
          discount_tetri?: number;
          distance_km?: number | null;
          estimated_ready_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          kot_round?: number;
          notes?: string | null;
          order_number?: number;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_provider?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          prep_minutes?: number | null;
          public_id: string;
          ready_at?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          request_hash: string;
          scheduled_for?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_tetri: number;
          table_id?: string | null;
          table_label?: string | null;
          total_tetri: number;
          type: Database["public"]["Enums"]["order_type"];
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          address_lat?: number | null;
          address_lng?: number | null;
          address_text?: string | null;
          client_ip_hash?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_locale?: string;
          customer_name?: string;
          customer_phone?: string;
          delivery_fee_tetri?: number;
          delivery_zone_id?: string | null;
          discount_tetri?: number;
          distance_km?: number | null;
          estimated_ready_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          kot_round?: number;
          notes?: string | null;
          order_number?: number;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_provider?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          prep_minutes?: number | null;
          public_id?: string;
          ready_at?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          request_hash?: string;
          scheduled_for?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_tetri?: number;
          table_id?: string | null;
          table_label?: string | null;
          total_tetri?: number;
          type?: Database["public"]["Enums"]["order_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_delivery_zone_id_fkey";
            columns: ["delivery_zone_id"];
            isOneToOne: false;
            referencedRelation: "delivery_zones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "dining_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          event_id: string;
          id: number;
          payload: NonNullable<Json>;
          processed_at: string | null;
          provider: string;
          received_at: string;
        };
        Insert: {
          event_id: string;
          id?: never;
          payload: NonNullable<Json>;
          processed_at?: string | null;
          provider: string;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          id?: never;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          provider?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_tetri: number;
          created_at: string;
          id: string;
          order_id: string;
          provider: string;
          provider_payment_id: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_tetri: number;
          created_at?: string;
          id?: string;
          order_id: string;
          provider: string;
          provider_payment_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_tetri?: number;
          created_at?: string;
          id?: string;
          order_id?: string;
          provider?: string;
          provider_payment_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      print_settings: {
        Row: {
          auto_print_bill: boolean;
          auto_print_kot: boolean;
          bill_copies: number;
          bill_footer: NonNullable<Json>;
          bill_language: string;
          bill_show_phone: boolean;
          bill_show_qr: boolean;
          id: number;
          kot_copies: number;
          kot_language: string;
          legal_address: string | null;
          legal_name: string | null;
          paper_width_mm: number;
          tax_id: string | null;
          updated_at: string;
          vat_registered: boolean;
        };
        Insert: {
          auto_print_bill?: boolean;
          auto_print_kot?: boolean;
          bill_copies?: number;
          bill_footer?: NonNullable<Json>;
          bill_language?: string;
          bill_show_phone?: boolean;
          bill_show_qr?: boolean;
          id?: number;
          kot_copies?: number;
          kot_language?: string;
          legal_address?: string | null;
          legal_name?: string | null;
          paper_width_mm?: number;
          tax_id?: string | null;
          updated_at?: string;
          vat_registered?: boolean;
        };
        Update: {
          auto_print_bill?: boolean;
          auto_print_kot?: boolean;
          bill_copies?: number;
          bill_footer?: NonNullable<Json>;
          bill_language?: string;
          bill_show_phone?: boolean;
          bill_show_qr?: boolean;
          id?: number;
          kot_copies?: number;
          kot_language?: string;
          legal_address?: string | null;
          legal_name?: string | null;
          paper_width_mm?: number;
          tax_id?: string | null;
          updated_at?: string;
          vat_registered?: boolean;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        Insert: {
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      restaurant_settings: {
        Row: {
          about_text: NonNullable<Json>;
          about_title: NonNullable<Json>;
          brand_name: string;
          city: NonNullable<Json>;
          country_code: string;
          cuisines: string[];
          delivery_enabled: boolean;
          delivery_fee_tetri: number;
          email: string | null;
          facebook_url: string | null;
          features: NonNullable<Json>;
          free_delivery_over_tetri: number;
          google_review_url: string | null;
          headline: NonNullable<Json>;
          highlights: NonNullable<Json>;
          id: number;
          instagram_url: string | null;
          intro: NonNullable<Json>;
          last_order_minutes_before_close: number;
          latitude: number;
          longitude: number;
          menu_description: NonNullable<Json>;
          menu_source: Database["public"]["Enums"]["menu_source"];
          min_delivery_order_tetri: number;
          monogram: string;
          order_prefix: string;
          orders_paused: boolean;
          owner_name: string | null;
          owner_note: NonNullable<Json>;
          pause_message: NonNullable<Json>;
          phone: string;
          pickup_enabled: boolean;
          postal_code: string;
          prep_minutes_delivery: number;
          prep_minutes_pickup: number;
          schedule_days_ahead: number;
          seo_description: NonNullable<Json>;
          seo_title: NonNullable<Json>;
          sheet_managed_fields: string[];
          signature_item_slugs: string[];
          site_name: NonNullable<Json>;
          slot_interval_minutes: number;
          specialties: NonNullable<Json>;
          street: NonNullable<Json>;
          tagline: NonNullable<Json>;
          tiktok_url: string | null;
          timezone: string;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          about_text?: NonNullable<Json>;
          about_title?: NonNullable<Json>;
          brand_name?: string;
          city?: NonNullable<Json>;
          country_code?: string;
          cuisines?: string[];
          delivery_enabled?: boolean;
          delivery_fee_tetri?: number;
          email?: string | null;
          facebook_url?: string | null;
          features?: NonNullable<Json>;
          free_delivery_over_tetri?: number;
          google_review_url?: string | null;
          headline?: NonNullable<Json>;
          highlights?: NonNullable<Json>;
          id?: number;
          instagram_url?: string | null;
          intro?: NonNullable<Json>;
          last_order_minutes_before_close?: number;
          latitude?: number;
          longitude?: number;
          menu_description?: NonNullable<Json>;
          menu_source?: Database["public"]["Enums"]["menu_source"];
          min_delivery_order_tetri?: number;
          monogram?: string;
          order_prefix?: string;
          orders_paused?: boolean;
          owner_name?: string | null;
          owner_note?: NonNullable<Json>;
          pause_message?: NonNullable<Json>;
          phone?: string;
          pickup_enabled?: boolean;
          postal_code?: string;
          prep_minutes_delivery?: number;
          prep_minutes_pickup?: number;
          schedule_days_ahead?: number;
          seo_description?: NonNullable<Json>;
          seo_title?: NonNullable<Json>;
          sheet_managed_fields?: string[];
          signature_item_slugs?: string[];
          site_name?: NonNullable<Json>;
          slot_interval_minutes?: number;
          specialties?: NonNullable<Json>;
          street?: NonNullable<Json>;
          tagline?: NonNullable<Json>;
          tiktok_url?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string;
        };
        Update: {
          about_text?: NonNullable<Json>;
          about_title?: NonNullable<Json>;
          brand_name?: string;
          city?: NonNullable<Json>;
          country_code?: string;
          cuisines?: string[];
          delivery_enabled?: boolean;
          delivery_fee_tetri?: number;
          email?: string | null;
          facebook_url?: string | null;
          features?: NonNullable<Json>;
          free_delivery_over_tetri?: number;
          google_review_url?: string | null;
          headline?: NonNullable<Json>;
          highlights?: NonNullable<Json>;
          id?: number;
          instagram_url?: string | null;
          intro?: NonNullable<Json>;
          last_order_minutes_before_close?: number;
          latitude?: number;
          longitude?: number;
          menu_description?: NonNullable<Json>;
          menu_source?: Database["public"]["Enums"]["menu_source"];
          min_delivery_order_tetri?: number;
          monogram?: string;
          order_prefix?: string;
          orders_paused?: boolean;
          owner_name?: string | null;
          owner_note?: NonNullable<Json>;
          pause_message?: NonNullable<Json>;
          phone?: string;
          pickup_enabled?: boolean;
          postal_code?: string;
          prep_minutes_delivery?: number;
          prep_minutes_pickup?: number;
          schedule_days_ahead?: number;
          seo_description?: NonNullable<Json>;
          seo_title?: NonNullable<Json>;
          sheet_managed_fields?: string[];
          signature_item_slugs?: string[];
          site_name?: NonNullable<Json>;
          slot_interval_minutes?: number;
          specialties?: NonNullable<Json>;
          street?: NonNullable<Json>;
          tagline?: NonNullable<Json>;
          tiktok_url?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [];
      };
      sheet_sync_runs: {
        Row: {
          content_hash: string | null;
          finished_at: string | null;
          id: string;
          problems: NonNullable<Json>;
          started_at: string;
          status: string;
          summary: NonNullable<Json>;
          trigger: string;
        };
        Insert: {
          content_hash?: string | null;
          finished_at?: string | null;
          id?: string;
          problems?: NonNullable<Json>;
          started_at?: string;
          status?: string;
          summary?: NonNullable<Json>;
          trigger?: string;
        };
        Update: {
          content_hash?: string | null;
          finished_at?: string | null;
          id?: string;
          problems?: NonNullable<Json>;
          started_at?: string;
          status?: string;
          summary?: NonNullable<Json>;
          trigger?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          created_at: string;
          display_name: string;
          role: Database["public"]["Enums"]["staff_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          role?: Database["public"]["Enums"]["staff_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          role?: Database["public"]["Enums"]["staff_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_order_round: {
        Args: { p_items: Json; p_order_id: string; p_subtotal_tetri: number };
        Returns: number;
      };
      apply_menu_snapshot: { Args: { p_snapshot: Json }; Returns: Json };
      claim_print: {
        Args: {
          p_first_only?: boolean;
          p_kind: string;
          p_order_id: string;
          p_round?: number;
        };
        Returns: number;
      };
      create_counter_order: {
        Args: { p_items: Json; p_order: Json };
        Returns: Json;
      };
      create_order: { Args: { p_items: Json; p_order: Json }; Returns: Json };
      get_public_order: { Args: { p_public_id: string }; Returns: Json };
      insert_order_items: {
        Args: { p_items: Json; p_order_id: string; p_round: number };
        Returns: undefined;
      };
      is_i18n_text: { Args: { value: Json }; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      order_status_allowed: {
        Args: {
          new_status: Database["public"]["Enums"]["order_status"];
          old_status: Database["public"]["Enums"]["order_status"];
        };
        Returns: boolean;
      };
      purge_expired_data: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      report_orders: {
        Args: { p_from: string; p_to: string };
        Returns: {
          created_at: string;
          delivery_fee_tetri: number;
          local_day: string;
          order_number: number;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          source: Database["public"]["Enums"]["order_source"];
          status: Database["public"]["Enums"]["order_status"];
          subtotal_tetri: number;
          total_tetri: number;
          type: Database["public"]["Enums"]["order_type"];
        }[];
      };
      set_item_sold_out: {
        Args: { p_item_id: string; p_until: string };
        Returns: undefined;
      };
    };
    Enums: {
      menu_source: "sheet" | "admin";
      order_source: "website" | "counter";
      order_status:
        | "received"
        | "accepted"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "completed"
        | "rejected"
        | "cancelled";
      order_type: "delivery" | "pickup" | "dine_in";
      payment_method: "cash" | "pay_at_pickup" | "online" | "card";
      payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
      staff_role: "owner" | "staff";
      zone_kind: "radius" | "polygon";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      menu_source: ["sheet", "admin"],
      order_source: ["website", "counter"],
      order_status: [
        "received",
        "accepted",
        "preparing",
        "ready",
        "out_for_delivery",
        "completed",
        "rejected",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "dine_in"],
      payment_method: ["cash", "pay_at_pickup", "online", "card"],
      payment_status: ["unpaid", "pending", "paid", "failed", "refunded"],
      staff_role: ["owner", "staff"],
      zone_kind: ["radius", "polygon"],
    },
  },
} as const;
