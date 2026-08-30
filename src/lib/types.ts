export interface Lead {
  lead_id: string;
  sub_account_id: string;
  ghl_opportunity_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  plumbing_issue: string;
  emergency_level: string;
  pipeline_stage: 'incoming' | 'active' | 'booked';
  transcript: string | null;
  call_id: string;
  created_at: string;
}
