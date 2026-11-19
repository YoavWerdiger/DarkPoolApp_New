/** מתג אוטומציית החדשות (n8n) — דרך n8n-news-toggle (אדמין בלבד; המפתח בשרת) */
import { supabase } from '../supabase';

export async function getNewsAutomationActive(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('n8n-news-toggle', { method: 'GET' });
  if (error) throw error;
  return (data as { active?: boolean } | null)?.active === true;
}

export async function setNewsAutomationActive(active: boolean): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('n8n-news-toggle', {
    method: 'POST',
    body: { active },
  });
  if (error) throw error;
  return (data as { active?: boolean } | null)?.active === true;
}
