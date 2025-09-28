import { supabase } from '../lib/supabase';

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
   * יצירת סקר חדש
   */
  static async createPoll(
    chatId: string,
    question: string,
    options: string[],
    multipleChoice: boolean = false
  ): Promise<Poll | null> {
    try {
      // יצירת אובייקט options עם ID ייחודי לכל אפשרות
      const pollOptions: PollOption[] = options.map((text, index) => ({
        id: `option_${Date.now()}_${index}`,
        text,
        votes_count: 0
      }));

      const { data, error } = await supabase
        .from('polls')
        .insert({
          chat_id: chatId,
          question,
          options: pollOptions,
          multiple_choice: multipleChoice
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating poll:', error);
        throw error;
      }

      console.log('✅ Poll created successfully:', data);
      
      // צור הודעה בצ'אט עבור הסקר
      await this.createPollMessage(data.id, chatId, data.question);
      
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
   * יצירת הודעה בצ'אט עבור סקר חדש
   */
  private static async createPollMessage(pollId: string, chatId: string, question: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          channel_id: chatId,
          content: question,
          type: 'poll',
          poll_id: pollId
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
