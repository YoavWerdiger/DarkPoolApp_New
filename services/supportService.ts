import { supabase } from './supabase';

export type SupportTicketStatus = 'new' | 'in_progress' | 'closed';

export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  created_at: string;
};

export async function createSupportTicket(input: {
  userId: string;
  subject: string;
  body: string;
}): Promise<SupportTicket> {
  const subject = input.subject.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 4000);
  if (!subject || !body) {
    throw new Error('נא למלא נושא ותוכן');
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: input.userId,
      subject,
      body,
      status: 'new',
    })
    .select('id, user_id, subject, body, status, created_at')
    .single();

  if (error) throw new Error(error.message);
  return data as SupportTicket;
}

export async function deleteOwnAccount(input: {
  confirm: string;
  password?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: {
      confirm: input.confirm,
      password: input.password || undefined,
    },
  });

  if (error) throw new Error(error.message || 'מחיקת חשבון נכשלה');
  if (data?.error) throw new Error(String(data.error));
}
