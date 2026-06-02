import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { CustomerProfile, UserProfile } from '$lib/types/db';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
      session: Session | null;
      user: User | null;
      profile: UserProfile | null;
      customerProfile: CustomerProfile | null;
    }
    interface PageData {
      session: Session | null;
      user: User | null;
      profile?: UserProfile | null;
      customerProfile?: CustomerProfile | null;
    }
    interface Error {
      message: string;
      code?: string;
    }
  }
}

export {};
