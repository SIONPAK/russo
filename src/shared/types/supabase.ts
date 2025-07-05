export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          company_name: string
          business_number: string
          representative_name: string
          phone: string
          address: string
          postal_code: string
          recipient_name: string
          recipient_phone: string
          business_license: string | null
          approval_status: 'pending' | 'approved' | 'rejected'
          is_active: boolean
          mileage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          company_name: string
          business_number: string
          representative_name: string
          phone: string
          address: string
          postal_code: string
          recipient_name: string
          recipient_phone: string
          business_license?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected'
          is_active?: boolean
          mileage?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          company_name?: string
          business_number?: string
          representative_name?: string
          phone?: string
          address?: string
          postal_code?: string
          recipient_name?: string
          recipient_phone?: string
          business_license?: string | null
          approval_status?: 'pending' | 'approved' | 'rejected'
          is_active?: boolean
          mileage?: number
          created_at?: string
          updated_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          username: string
          email: string
          password_hash: string
          role: 'admin' | 'super_admin'
          created_at: string
        }
        Insert: {
          id?: string
          username: string
          email: string
          password_hash: string
          role?: 'admin' | 'super_admin'
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          email?: string
          password_hash?: string
          role?: 'admin' | 'super_admin'
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          thumbnail_image: string
          images: string[]
          price: number
          colors: string[]
          sizes: string[]
          description: string | null
          status: 'active' | 'inactive' | 'out_of_stock'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          thumbnail_image: string
          images?: string[]
          price: number
          colors?: string[]
          sizes?: string[]
          description?: string | null
          status?: 'active' | 'inactive' | 'out_of_stock'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          thumbnail_image?: string
          images?: string[]
          price?: number
          colors?: string[]
          sizes?: string[]
          description?: string | null
          status?: 'active' | 'inactive' | 'out_of_stock'
          created_at?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          product_id: string
          color: string
          size: string
          quantity: number
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          color: string
          size: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          color?: string
          size?: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          order_number: string
          total_amount: number
          status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address: string
          tracking_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_number: string
          total_amount: number
          status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address: string
          tracking_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          order_number?: string
          total_amount?: number
          status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address?: string
          tracking_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          color: string
          size: string
          quantity: number
          unit_price: number
          total_price: number
          shipped_quantity: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          color: string
          size: string
          quantity: number
          unit_price: number
          total_price: number
          shipped_quantity?: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          color?: string
          size?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          shipped_quantity?: number
        }
      }

      shipping_addresses: {
        Row: {
          id: string
          user_id: string
          recipient_name: string
          phone: string
          address: string
          postal_code: string
          is_default: boolean
        }
        Insert: {
          id?: string
          user_id: string
          recipient_name: string
          phone: string
          address: string
          postal_code: string
          is_default?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          recipient_name?: string
          phone?: string
          address?: string
          postal_code?: string
          is_default?: boolean
        }
      }
      samples: {
        Row: {
          id: string
          sample_number: string
          customer_id: string
          customer_name: string
          product_id: string
          product_name: string
          product_options: string
          quantity: number
          outgoing_date: string
          status: 'pending' | 'recovered' | 'overdue' | 'charged'
          charge_amount: number
          charge_method: 'manual' | 'auto_mileage' | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sample_number: string
          customer_id: string
          customer_name: string
          product_id: string
          product_name: string
          product_options: string
          quantity: number
          outgoing_date: string
          status?: 'pending' | 'recovered' | 'overdue' | 'charged'
          charge_amount?: number
          charge_method?: 'manual' | 'auto_mileage' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sample_number?: string
          customer_id?: string
          customer_name?: string
          product_id?: string
          product_name?: string
          product_options?: string
          quantity?: number
          outgoing_date?: string
          status?: 'pending' | 'recovered' | 'overdue' | 'charged'
          charge_amount?: number
          charge_method?: 'manual' | 'auto_mileage' | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      featured_products: {
        Row: {
          id: string
          product_id: string
          type: 'featured' | 'popular'
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          type: 'featured' | 'popular'
          order_index: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          type?: 'featured' | 'popular'
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      email_logs: {
        Row: {
          id: string
          order_id: string
          recipient_email: string
          email_type: string
          subject: string
          status: 'pending' | 'sent' | 'failed'
          message_id: string | null
          error_message: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          recipient_email: string
          email_type: string
          subject: string
          status?: 'pending' | 'sent' | 'failed'
          message_id?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          recipient_email?: string
          email_type?: string
          subject?: string
          status?: 'pending' | 'sent' | 'failed'
          message_id?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      category_menus: {
        Row: {
          id: string
          name: string
          key: string
          path: string
          order_index: number
          is_active: boolean
          is_special: boolean
          badge: string | null
          text_color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          key: string
          path: string
          order_index: number
          is_active?: boolean
          is_special?: boolean
          badge?: string | null
          text_color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          key?: string
          path?: string
          order_index?: number
          is_active?: boolean
          is_special?: boolean
          badge?: string | null
          text_color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      statements: {
        Row: {
          id: string
          statement_number: string
          statement_type: 'transaction' | 'return' | 'deduction'
          user_id: string
          order_id: string | null
          total_amount: number
          reason: string | null
          notes: string | null
          status: 'draft' | 'issued' | 'sent'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          statement_number: string
          statement_type: 'transaction' | 'return' | 'deduction'
          user_id: string
          order_id?: string | null
          total_amount?: number
          reason?: string | null
          notes?: string | null
          status?: 'draft' | 'issued' | 'sent'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          statement_number?: string
          statement_type?: 'transaction' | 'return' | 'deduction'
          user_id?: string
          order_id?: string | null
          total_amount?: number
          reason?: string | null
          notes?: string | null
          status?: 'draft' | 'issued' | 'sent'
          created_at?: string
          updated_at?: string
        }
      }
      statement_items: {
        Row: {
          id: string
          statement_id: string
          product_code: string | null
          product_name: string
          color: string | null
          size: string | null
          quantity: number
          unit_price: number
          supply_amount: number
          vat_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          statement_id: string
          product_code?: string | null
          product_name: string
          color?: string | null
          size?: string | null
          quantity: number
          unit_price: number
          supply_amount: number
          vat_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          statement_id?: string
          product_code?: string | null
          product_name?: string
          color?: string | null
          size?: string | null
          quantity?: number
          unit_price?: number
          supply_amount?: number
          vat_amount?: number
          created_at?: string
        }
      }
      mileage_logs: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: 'earn' | 'spend' | 'deduction' | 'refund'
          description: string
          balance_after: number
          order_id: string | null
          statement_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: 'earn' | 'spend' | 'deduction' | 'refund'
          description: string
          balance_after: number
          order_id?: string | null
          statement_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: 'earn' | 'spend' | 'deduction' | 'refund'
          description?: string
          balance_after?: number
          order_id?: string | null
          statement_id?: string | null
          created_at?: string
        }
      }

    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 