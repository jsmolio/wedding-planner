import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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

  const fetchWedding = useCallback(async () => {
    if (!user) {
      setWedding(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: membership } = await supabase
      .from('wedding_members')
      .select('wedding_id')
      .eq('user_id', user.id)
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
  }, [user]);

  useEffect(() => {
    // Don't fetch until auth has resolved
    if (authLoading) return;
    fetchWedding();
  }, [authLoading, fetchWedding]);

  return (
    <WeddingContext.Provider
      value={{
        wedding,
        weddingId: wedding?.id ?? null,
        loading: authLoading || loading,
        refreshWedding: fetchWedding,
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
