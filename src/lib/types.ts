export interface Lead {
  lead_id: string;
  sub_account_id: string;
  ghl_opportunity_id: string | null;
  customer_name: string;
  customer_phone: string;
  email: string | null;
  customer_address: string;
  plumbing_issue: string;
  emergency_level: string;
  pipeline_stage: 'new_lead' | 'contacted' | 'qualified' | 'proposal_sent' | 'closed_won';
  transcript: string | null;
  call_id: string;
  created_at: string;
}

export interface Company {
  company_id: string;
  sub_account_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  contact_id: string;
  sub_account_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingSlot {
  slot_id: string;
  sub_account_id: string;
  slot_date: string;
  window: 'morning' | 'midday' | 'late_afternoon';
  capacity: number;
  booked_count: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  appointment_id: string;
  sub_account_id: string;
  slot_id: string;
  lead_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: 'booked' | 'cancelled' | 'completed' | 'no_show';
  notes: string;
  created_at: string;
  updated_at: string;
}
