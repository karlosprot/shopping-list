import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // tvůj import supabase klienta

export const useUser = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Zjistíme, kdo je přihlášený právě teď
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email || null);
      setLoading(false);
    };

    getSession();

    // 2. Sledujeme změny (přihlášení/odhlášení)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { userEmail, loading };
};