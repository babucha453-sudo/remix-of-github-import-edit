// Supabase type definitions placeholder
// This file contains auto-generated types from Supabase

export type Database = any;

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Tables {
  clinics: {
    Row: any;
    Insert: any;
    Update: any;
  };
  dentists: {
    Row: any;
    Insert: any;
    Update: any;
  };
  cities: {
    Row: any;
    Insert: any;
    Update: any;
  };
  states: {
    Row: any;
    Insert: any;
    Update: any;
  };
  appointments: {
    Row: any;
    Insert: any;
    Update: any;
  };
  leads: {
    Row: any;
    Insert: any;
    Update: any;
  };
  reviews: {
    Row: any;
    Insert: any;
    Update: any;
  };
  listing_drafts: {
    Row: any;
    Insert: any;
    Update: any;
  };
  listing_claims: {
    Row: any;
    Insert: any;
    Update: any;
  };
  clinic_members: {
    Row: any;
    Insert: any;
    Update: any;
  };
}

export type Enums = {
  claim_status: 'unclaimed' | 'claimed';
  verification_status: 'unverified' | 'pending' | 'verified';
  listing_status: 'draft' | 'pending' | 'approved' | 'live';
};