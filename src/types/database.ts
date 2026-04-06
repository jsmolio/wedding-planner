export type RsvpStatus = 'pending' | 'accepted' | 'declined';
export type GuestSide = 'partner1' | 'partner2' | 'mutual';
export type TableShape = 'round' | 'rectangular';
export type WeddingRole = 'owner' | 'partner';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wedding {
  id: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string | null;
  overall_budget: number;
  rsvp_deadline: string | null;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface WeddingMember {
  id: string;
  wedding_id: string;
  user_id: string;
  role: WeddingRole;
  created_at: string;
}

export interface VenuePackage {
  name: string;
  price: number | null;
  description: string;
}

export interface Venue {
  id: string;
  wedding_id: string;
  name: string;
  address: string;
  capacity: number | null;
  cost: number | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
  photo_urls: string[];
  website_url: string;
  packages: VenuePackage[];
  is_selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  wedding_id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  side: GuestSide;
  group_name: string;
  has_plus_one: boolean;
  plus_one_name: string;
  dietary_restrictions: string;
  meal_choice: string;
  rsvp_status: RsvpStatus;
  rsvp_message: string;
  table_id: string | null;
  seat_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface RsvpToken {
  id: string;
  wedding_id: string;
  guest_ids: string[];
  token: string;
  is_used: boolean;
  created_at: string;
}

export interface SeatingTable {
  id: string;
  wedding_id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  wedding_id: string;
  name: string;
  allocated_amount: number;
  sort_order: number;
  created_at: string;
}

export interface BudgetExpense {
  id: string;
  wedding_id: string;
  category_id: string;
  description: string;
  estimated_cost: number;
  actual_cost: number | null;
  is_paid: boolean;
  due_date: string | null;
  vendor_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  wedding_id: string;
  title: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  time_period: string;
  sort_order: number;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  wedding_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  wedding_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_steps: { label: string; timestamp: number }[] | null;
  created_at: string;
}
