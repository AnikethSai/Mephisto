export type TeamStatus = 'active' | 'eliminated' | 'disqualified';

export interface Team {
  id: number;
  team_number: number;
  team_name: string;
  access_key: string;
  pin_hash: string;
  balance: number;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'ORGANIZER_GRANT' | 'ORGANIZER_DEDUCT' | 'TRANSFER';
export type TransactionCreatedBy = 'ORGANIZER' | 'PARTICIPANT';

export const ROUND_BADGES = [
  'Round 1',
  'Round 2',
  'Round 3',
  'Round 4',
  'The Pact',
  'Round 5',
  'Round 6',
  'General / Adjustment',
] as const;

export type RoundBadge = (typeof ROUND_BADGES)[number] | string;

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  source_team_id: number | null;
  destination_team_id: number | null;
  badge: RoundBadge;
  note: string | null;
  created_by: TransactionCreatedBy;
  created_at: string;

  // Joined fields for display
  source_team_number?: number | null;
  source_team_name?: string | null;
  destination_team_number?: number | null;
  destination_team_name?: string | null;
}

export interface TransactionWithBalance extends Transaction {
  balanceAfter: number;
  direction: 'INCOMING' | 'OUTGOING';
}

export interface TeamWithLastTx extends Team {
  lastTransaction?: {
    id: number;
    type: TransactionType;
    amount: number;
    badge: string;
    note: string | null;
    createdAt: string;
    direction: 'INCOMING' | 'OUTGOING';
    counterpartyNumber?: number | null;
  } | null;
}

export interface OrganizerTeamSummary {
  id: number;
  teamNumber: number;
  teamName: string;
  balance: number;
  status: TeamStatus | string;
  accessKey?: string;
  accessUrl?: string;
  updatedAt?: string;
  lastTransaction?: {
    id: number;
    type: TransactionType;
    amount: number;
    badge: string;
    note: string | null;
    createdAt: string;
    direction: 'INCOMING' | 'OUTGOING';
    counterpartyNumber?: number | null;
  } | null;
}

export interface ParticipantSessionPayload {
  teamId: number;
  teamNumber: number;
  teamName: string;
  accessKey: string;
}

export interface OrganizerSessionPayload {
  organizerId: number | string;
  username: string;
  role: 'ORGANIZER';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
