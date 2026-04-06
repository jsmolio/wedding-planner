import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://sikrjfbwcewyfplexizx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa3JqZmJ3Y2V3eWZwbGV4aXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1Mzc2MjAsImV4cCI6MjA4OTExMzYyMH0.Q5VBD5lGdSeOJUEOgNVCz7LZJnq3ufstAYox2ZVHljM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
