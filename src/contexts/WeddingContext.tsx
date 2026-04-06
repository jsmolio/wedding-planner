import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/config/supabase';
import { useAuth } from './AuthContext';
import type { Wedding } from '@/types/database';

interface WeddingContextType {
  wedding: Wedding | null;
  weddingId: string | null;
  loading: boolean;
  refreshWedding: () => Promise<void>;
}

const WeddingContext = createContext<WeddingContextType | undefined>(undefined);

export function WeddingProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  const fetchWedding = useCallback(async (userId: string | null, isInitial: boolean) => {
    if (!userId) {
      setWedding(null);
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial load, not on tab-switch refetches
    if (isInitial) setLoading(true);

    const { data: membership } = await supabase
      .from('wedding_members')
      .select('wedding_id')
      .eq('user_id', userId)
      .single();

    if (membership) {
      const { data: weddingData } = await supabase
        .from('weddings')
        .select('*')
        .eq('id', membership.wedding_id)
        .single();
      setWedding(weddingData);
    } else {
      setWedding(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const userId = user?.id ?? null;
    const isNewUser = userId !== lastUserId.current;
    lastUserId.current = userId;

    // Only refetch if the user actually changed (not just a session refresh)
    if (isNewUser) {
      fetchWedding(userId, true);
    }
  }, [authLoading, user?.id, fetchWedding]);

  const refreshWedding = useCallback(async () => {
    if (user?.id) await fetchWedding(user.id, false);
  }, [user?.id, fetchWedding]);

  return (
    <WeddingContext.Provider
      value={{
        wedding,
        weddingId: wedding?.id ?? null,
        loading: authLoading || loading,
        refreshWedding,
      }}
    >
      {children}
    </WeddingContext.Provider>
  );
}

export function useWedding() {
  const context = useContext(WeddingContext);
  if (!context) throw new Error('useWedding must be used within WeddingProvider');
  return context;
}
