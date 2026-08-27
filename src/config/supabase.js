import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let client = null;

export const getSupabaseAdmin = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use Supabase Storage');
  if (!client) client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
};
