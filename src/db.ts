import { createClient } from '@supabase/supabase-js';

// Server-only client. SUPABASE_SERVICE_ROLE_KEY must never be shipped to the browser;
// the React frontend talks to /api/* routes, not Supabase directly.
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
