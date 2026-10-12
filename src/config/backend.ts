/**
 * The one Keybox backend every build talks to: Supabase project "keybox"
 * (ref ogqagauogrzezfmveewk, ap-southeast-1) — see ../DramaRush-Backend.
 *
 * Deliberately in code, not .env: there is only one database, and a stale
 * .env must never point a build at the old prototype project. Both values are
 * public (the anon key ships in every app bundle); Row Level Security and the
 * server-side RPCs / Edge Functions decide what a client may do.
 */
export const SUPABASE_URL = 'https://ogqagauogrzezfmveewk.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncWFnYXVvZ3J6ZXpmbXZlZXdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTQ3NDAsImV4cCI6MjEwNzEzMDc0MH0.xR9IePiD3ipknNKg3zurQgCfpk9_cNwo8jls_F_YPbY';
