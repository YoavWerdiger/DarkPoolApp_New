import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpmrtczbfcijoocguime.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteAllMessages() {
  console.log('🚀 מתחיל מחיקת כל ההודעות מטבלת messages...');
  
  try {
    // ספירת ההודעות לפני המחיקה
    const { count: beforeCount, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ שגיאה בספירת הודעות:', countError);
      return;
    }
    
    console.log(`📊 נמצאו ${beforeCount} הודעות לפני המחיקה`);
    
    // שלב 1: איפוס last_read_message_id בטבלת channel_members
    console.log('🔄 מאפס התייחסויות ב-channel_members...');
    const { error: updateError } = await supabase
      .from('channel_members')
      .update({ last_read_message_id: null })
      .not('last_read_message_id', 'is', null);
    
    if (updateError) {
      console.error('❌ שגיאה באיפוס channel_members:', updateError);
      return;
    }
    
    console.log('✅ איפוס channel_members הושלם');
    
    // שלב 2: איפוס התייחסויות בטבלת pinned_messages (אם קיימת)
    console.log('🔄 מאפס התייחסויות ב-pinned_messages...');
    const { error: pinnedDeleteError } = await supabase
      .from('pinned_messages')
      .delete()
      .not('id', 'is', null);
    
    if (pinnedDeleteError && pinnedDeleteError.code !== '42P01') { // 42P01 = טבלה לא קיימת
      console.error('❌ שגיאה במחיקת pinned_messages:', pinnedDeleteError);
    } else {
      console.log('✅ מחיקת pinned_messages הושלמה');
    }
    
    // שלב 3: איפוס התייחסויות בטבלת starred_messages (אם קיימת)
    console.log('🔄 מאפס התייחסויות ב-starred_messages...');
    const { error: starredDeleteError } = await supabase
      .from('starred_messages')
      .delete()
      .not('id', 'is', null);
    
    if (starredDeleteError && starredDeleteError.code !== '42P01') { // 42P01 = טבלה לא קיימת
      console.error('❌ שגיאה במחיקת starred_messages:', starredDeleteError);
    } else {
      console.log('✅ מחיקת starred_messages הושלמה');
    }
    
    // שלב 4: מחיקת כל ההודעות
    console.log('🗑️  מוחק את כל ההודעות...');
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .not('id', 'is', null);
    
    if (deleteError) {
      console.error('❌ שגיאה במחיקת הודעות:', deleteError);
      return;
    }
    
    // ספירת ההודעות אחרי המחיקה
    const { count: afterCount, error: afterCountError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    if (afterCountError) {
      console.error('❌ שגיאה בספירת הודעות אחרי המחיקה:', afterCountError);
      return;
    }
    
    console.log('');
    console.log('✅✅✅ המחיקה הושלמה בהצלחה! ✅✅✅');
    console.log(`📊 ${beforeCount} הודעות נמחקו`);
    console.log(`📊 ${afterCount} הודעות נותרו בטבלה`);
    console.log('');
    
  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  }
}

// הרצת הסקריפט
deleteAllMessages();

