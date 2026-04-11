type PublicEnvKey =
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

function readProcessEnv(key: PublicEnvKey): string | undefined {
  // In some production/Hermes contexts `process` might not exist.
  if (typeof process === 'undefined') return undefined;
  const v = (process.env as any)?.[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

// Fallbacks are intentionally "public" values (URL + anon key).
export const SUPABASE_URL =
  readProcessEnv('EXPO_PUBLIC_SUPABASE_URL') ??
  'https://wpmrtczbfcijoocguime.supabase.co';

export const SUPABASE_ANON_KEY =
  readProcessEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ';

