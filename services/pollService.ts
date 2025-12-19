import { supabase } from '../lib/supabase';
import { ChatMessageType } from '../types/chat.types';

export interface PollOption {
  id: string;
  text: string;
  votes_count: number;
}

export interface Poll {
  id: string;
  chat_id: string;
  creator_id: string;
  question: string;
  options: PollOption[];
  multiple_choice: boolean;
  is_locked: boolean;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_id: string;
  created_at: string;
}

export interface PollWithVotes extends Poll {
  user_votes?: string[]; // Array of option IDs that the current user voted for
  total_votes: number;
}

export class PollService {
  /**
   * Workaround זמני: אם ה-FK של polls עדיין מצביע ל-channels,
   * ניצור רשומת channels עם אותו id של chat_group כדי שההכנסה תצליח.
   * (מומלץ עדיין להריץ: database/migrate_polls_to_chat_groups.sql)
   */
  private static async ensureLegacyChannelForGroup(groupId: string, fallbackUserId: string): Promise<void> {
    try {
      // אם כבר קיים channel עם אותו id – אין מה לעשות
      const { data: existing } = await supabase
        .from('channels')
        .select('id')
        .eq('id', groupId)
        .maybeSingle();

      if (existing?.id) return;

      // שליפת פרטי הקבוצה כדי לבנות channel מינימלי תואם
      const { data: group } = await supabase
        .from('chat_groups')
        .select('id,name,description,avatar_url,created_by')
        .eq('id', groupId)
        .maybeSingle();

      const payload: any = {
        id: groupId,
        name: group?.name || 'קבוצה',
        description: group?.description || null,
        created_by: group?.created_by || fallbackUserId,
        is_private: false,
        type: 'group',
      };

      if (group?.avatar_url) {
        payload.image_url = group.avatar_url;
      }

      const { error } = await supabase.from('channels').insert(payload);
      if (error) {
        console.warn('⚠️ Could not create legacy channel for group (non-fatal):', error);
      }
    } catch (e) {
      console.warn('⚠️ ensureLegacyChannelForGroup failed (non-fatal):', e);
    }
  }

  /**
   * יצירת סקר חדש
   */
  static async createPoll(
    groupId: string,
    question: string,
    options: string[],
    userId: string,
    multipleChoice: boolean = false
  ): Promise<Poll | null> {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pollService.ts:38',message:'createPoll called',data:{groupId,userId,questionLength:question.length,optionsCount:options.length,multipleChoice},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // בדיקה שה-groupId קיים ב-chat_groups
      const { data: groupExists, error: groupCheckError } = await supabase
        .from('chat_groups')
        .select('id')
        .eq('id', groupId)
        .single();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pollService.ts:47',message:'Group existence check',data:{groupId,groupExists:!!groupExists,groupCheckError:groupCheckError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (groupCheckError || !groupExists) {
        console.error('❌ Group does not exist:', groupId, groupCheckError);
        throw new Error(`הקבוצה ${groupId} לא קיימת במערכת`);
      }

      // יצירת אובייקט options עם ID ייחודי לכל אפשרות
      const pollOptions: PollOption[] = options.map((text, index) => ({
        id: `option_${Date.now()}_${index}`,
        text,
        votes_count: 0
      }));

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pollService.ts:65',message:'Inserting poll to DB',data:{groupId,userId,questionLength:question.length,optionsCount:pollOptions.length,multipleChoice},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      const { data, error } = await supabase
        .from('polls')
        .insert({
          chat_id: groupId,
          creator_id: userId,
          question,
          options: pollOptions,
          multiple_choice: multipleChoice
        })
        .select()
        .single();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pollService.ts:80',message:'Poll insert result',data:{success:!error,error:error?.message,errorCode:error?.code,pollId:data?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (error) {
        // אם ה-FK עדיין מצביע ל-channels, ננסה ליצור legacy channel ואז ננסה שוב פעם אחת
        const isLegacyChannelsFk =
          error?.code === '23503' &&
          typeof error?.message === 'string' &&
          (error.message.includes('polls_chat_id_fkey') || error.message.includes('channels'));

        if (isLegacyChannelsFk) {
          console.warn('⚠️ Poll FK points to channels; attempting workaround by creating legacy channel...');
          await this.ensureLegacyChannelForGroup(groupId, userId);

          const { data: retryData, error: retryError } = await supabase
            .from('polls')
            .insert({
              chat_id: groupId,
              creator_id: userId,
              question,
              options: pollOptions,
              multiple_choice: multipleChoice,
            })
            .select()
            .single();

          if (retryError) {
            console.error('❌ Error creating poll (after retry):', retryError);
            // הודעה ברורה למפתח כדי שיריץ את המיגרציה
            throw new Error(
              'לא ניתן ליצור סקר כי ה-DB עדיין מצביע ל-channels. יש להריץ את `database/migrate_polls_to_chat_groups.sql` ב-Supabase ואז לנסות שוב.'
            );
          }

          console.log('✅ Poll created successfully (after legacy channel workaround):', retryData);
          await this.createPollMessage(retryData.id, groupId, userId, retryData.question, pollOptions, multipleChoice);
          return retryData;
        }

        console.error('❌ Error creating poll:', error);
        throw error;
      }

      console.log('✅ Poll created successfully:', data);
      
      // צור הודעה בצ'אט עבור הסקר (במערכת החדשה)
      await this.createPollMessage(data.id, groupId, userId, data.question, pollOptions, multipleChoice);
      
      return data;
    } catch (error) {
      console.error('❌ Exception in createPoll:', error);
      throw error;
    }
  }

  /**
   * הצבעה בסקר
   */
  static async votePoll(
    pollId: string,
    optionIds: string[], // Array for multiple choice, single item for single choice
    userId: string
  ): Promise<boolean> {
    try {
      // בדוק אם הסקר נעול
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('is_locked, multiple_choice')
        .eq('id', pollId)
        .single();

      if (pollError) {
        console.error('❌ Error fetching poll:', pollError);
        throw pollError;
      }

      if (poll.is_locked) {
        throw new Error('הסקר נעול ולא ניתן להצביע');
      }

      // בדוק אם זה single choice ויש יותר מתשובה אחת
      if (!poll.multiple_choice && optionIds.length > 1) {
        throw new Error('סקר זה מאפשר רק תשובה אחת');
      }

      // מחק הצבעות קודמות של המשתמש בסקר זה
      const { error: deleteError } = await supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Error deleting previous votes:', deleteError);
        throw deleteError;
      }

      // הוסף הצבעות חדשות
      const votes = optionIds.map(optionId => ({
        poll_id: pollId,
        user_id: userId,
        option_id: optionId
      }));

      const { error: insertError } = await supabase
        .from('poll_votes')
        .insert(votes);

      if (insertError) {
        console.error('❌ Error inserting votes:', insertError);
        throw insertError;
      }

      // עדכן את מספר ההצבעות ב-options
      await this.updatePollVoteCounts(pollId);

      console.log('✅ Vote recorded successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception in votePoll:', error);
      throw error;
    }
  }

  /**
   * קבלת תוצאות סקר
   */
  static async getPollResults(pollId: string, userId?: string): Promise<PollWithVotes | null> {
    try {
      // קבלת פרטי הסקר
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single();

      if (pollError) {
        console.error('❌ Error fetching poll:', pollError);
        throw pollError;
      }

      // קבלת הצבעות המשתמש הנוכחי (אם יש)
      let userVotes: string[] = [];
      if (userId) {
        const { data: votes, error: votesError } = await supabase
          .from('poll_votes')
          .select('option_id')
          .eq('poll_id', pollId)
          .eq('user_id', userId);

        if (votesError) {
          console.error('❌ Error fetching user votes:', votesError);
        } else {
          userVotes = votes.map(v => v.option_id);
        }
      }

      // חישוב סך ההצבעות
      const totalVotes = poll.options.reduce((sum, option) => sum + option.votes_count, 0);

      const pollWithVotes: PollWithVotes = {
        ...poll,
        user_votes: userVotes,
        total_votes: totalVotes
      };

      console.log('✅ Poll results fetched successfully');
      return pollWithVotes;
    } catch (error) {
      console.error('❌ Exception in getPollResults:', error);
      throw error;
    }
  }

  /**
   * נעילת סקר (רק יוצר הסקר יכול)
   */
  static async lockPoll(pollId: string, userId: string): Promise<boolean> {
    try {
      // בדוק אם המשתמש הוא יוצר הסקר
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('creator_id')
        .eq('id', pollId)
        .single();

      if (pollError) {
        console.error('❌ Error fetching poll:', pollError);
        throw pollError;
      }

      if (poll.creator_id !== userId) {
        throw new Error('רק יוצר הסקר יכול לנעול אותו');
      }

      const { error: updateError } = await supabase
        .from('polls')
        .update({ is_locked: true })
        .eq('id', pollId);

      if (updateError) {
        console.error('❌ Error locking poll:', updateError);
        throw updateError;
      }

      console.log('✅ Poll locked successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception in lockPoll:', error);
      throw error;
    }
  }

  /**
   * קבלת כל הסקרים בצ'אט
   */
  static async getChatPolls(chatId: string, userId?: string): Promise<PollWithVotes[]> {
    try {
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (pollsError) {
        console.error('❌ Error fetching chat polls:', pollsError);
        throw pollsError;
      }

      // הוסף מידע על הצבעות המשתמש לכל סקר
      const pollsWithVotes: PollWithVotes[] = [];
      for (const poll of polls) {
        const pollWithVotes = await this.getPollResults(poll.id, userId);
        if (pollWithVotes) {
          pollsWithVotes.push(pollWithVotes);
        }
      }

      console.log('✅ Chat polls fetched successfully');
      return pollsWithVotes;
    } catch (error) {
      console.error('❌ Exception in getChatPolls:', error);
      throw error;
    }
  }

  /**
   * עדכון מספר ההצבעות ב-options
   */
  private static async updatePollVoteCounts(pollId: string): Promise<void> {
    try {
      // קבלת סך ההצבעות לכל אפשרות
      const { data: voteCounts, error: countError } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollId);

      if (countError) {
        console.error('❌ Error counting votes:', countError);
        return;
      }

      // חישוב מספר ההצבעות לכל אפשרות
      const optionVoteCounts: Record<string, number> = {};
      voteCounts?.forEach(vote => {
        optionVoteCounts[vote.option_id] = (optionVoteCounts[vote.option_id] || 0) + 1;
      });

      // קבלת הסקר הנוכחי
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('options')
        .eq('id', pollId)
        .single();

      if (pollError) {
        console.error('❌ Error fetching poll for update:', pollError);
        return;
      }

      // עדכון מספר ההצבעות
      const updatedOptions = poll.options.map((option: PollOption) => ({
        ...option,
        votes_count: optionVoteCounts[option.id] || 0
      }));

      // שמירת העדכון
      const { error: updateError } = await supabase
        .from('polls')
        .update({ options: updatedOptions })
        .eq('id', pollId);

      if (updateError) {
        console.error('❌ Error updating poll vote counts:', updateError);
      }
    } catch (error) {
      console.error('❌ Exception in updatePollVoteCounts:', error);
    }
  }

  /**
   * מחיקת סקר (רק יוצר הסקר יכול)
   */
  static async deletePoll(pollId: string, userId: string): Promise<boolean> {
    try {
      // בדוק אם המשתמש הוא יוצר הסקר
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('creator_id')
        .eq('id', pollId)
        .single();

      if (pollError) {
        console.error('❌ Error fetching poll:', pollError);
        throw pollError;
      }

      if (poll.creator_id !== userId) {
        throw new Error('רק יוצר הסקר יכול למחוק אותו');
      }

      // מחיקת הסקר (הצבעות יימחקו אוטומטית בגלל CASCADE)
      const { error: deleteError } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId);

      if (deleteError) {
        console.error('❌ Error deleting poll:', deleteError);
        throw deleteError;
      }

      console.log('✅ Poll deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception in deletePoll:', error);
      throw error;
    }
  }

  /**
   * קבלת רשימת המשתמשים שהצביעו לכל אופציה בסקר
   */
  static async getPollVoters(pollId: string): Promise<Record<string, Array<{ id: string; display_name: string; profile_picture?: string }>>> {
    try {
      // קבלת כל ההצבעות
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select('option_id, user_id')
        .eq('poll_id', pollId);

      if (votesError) {
        console.error('❌ Error fetching poll votes:', votesError);
        throw votesError;
      }

      if (!votes || votes.length === 0) {
        return {};
      }

      // איסוף כל ה-user_ids הייחודיים
      const userIds = [...new Set(votes.map((v: any) => v.user_id))];

      // קבלת פרטי המשתמשים
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, display_name, profile_picture')
        .in('id', userIds);

      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        throw usersError;
      }

      // יצירת מפה של user_id -> user
      const usersMap = new Map(
        (users || []).map((u: any) => [u.id, {
          id: u.id,
          display_name: u.display_name || 'משתמש',
          profile_picture: u.profile_picture || undefined,
        }])
      );

      // ארגון ההצבעות לפי option_id
      const votersByOption: Record<string, Array<{ id: string; display_name: string; profile_picture?: string }>> = {};

      votes.forEach((vote: any) => {
        const optionId = vote.option_id;
        const user = usersMap.get(vote.user_id);

        if (!votersByOption[optionId]) {
          votersByOption[optionId] = [];
        }

        if (user) {
          votersByOption[optionId].push(user);
        }
      });

      console.log('✅ Poll voters fetched successfully', votersByOption);
      return votersByOption;
    } catch (error) {
      console.error('❌ Exception in getPollVoters:', error);
      throw error;
    }
  }

  /**
   * יצירת הודעה בצ'אט עבור סקר חדש (מערכת חדשה - chat_messages)
   */
  private static async createPollMessage(
    pollId: string,
    groupId: string,
    userId: string,
    question: string,
    options: PollOption[],
    multipleChoice: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          group_id: groupId,
          sender_id: userId,
          content: question,
          message_type: ChatMessageType.POLL,
          // שמירת מזהה הסקר במטא-דאטה (נשתמש בשדה system_message_data הקיים כ-metadata כללי)
          // כדי שה-UI יוכל לטעון את הסקר ולרנדר אותו.
          system_message_data: {
            poll_id: pollId,
            multiple_choice: multipleChoice,
            options: options.map(o => ({ id: o.id, text: o.text })),
          },
        });

      if (error) {
        console.error('❌ Error creating poll message:', error);
        // לא זורק שגיאה כי הסקר כבר נוצר בהצלחה
      } else {
        console.log('✅ Poll message created successfully');
      }
    } catch (error) {
      console.error('❌ Exception in createPollMessage:', error);
      // לא זורק שגיאה כי הסקר כבר נוצר בהצלחה
    }
  }
}
