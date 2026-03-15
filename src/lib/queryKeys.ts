export const queryKeys = {
  wedding: (id: string) => ['wedding', id] as const,
  guests: (weddingId: string) => ['guests', weddingId] as const,
  guest: (id: string) => ['guest', id] as const,
  venues: (weddingId: string) => ['venues', weddingId] as const,
  seatingTables: (weddingId: string) => ['seatingTables', weddingId] as const,
  budgetCategories: (weddingId: string) => ['budgetCategories', weddingId] as const,
  budgetExpenses: (weddingId: string) => ['budgetExpenses', weddingId] as const,
  checklist: (weddingId: string) => ['checklist', weddingId] as const,
  activityLog: (weddingId: string) => ['activityLog', weddingId] as const,
  rsvpTokens: (weddingId: string) => ['rsvpTokens', weddingId] as const,
  rsvpPublic: (token: string) => ['rsvpPublic', token] as const,
  profile: (userId: string) => ['profile', userId] as const,
};
