import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  attemptId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { attemptId }: RequestBody = await req.json()

    if (!attemptId) {
      return new Response(
        JSON.stringify({ error: 'Attempt ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the quiz attempt with questions
    const { data: attempt, error: attemptError } = await supabaseClient
      .from('learning.quiz_attempts')
      .select(`
        id,
        user_id,
        block_id,
        answers,
        block:lesson_blocks!inner(
          id,
          lesson_id,
          quiz_questions(
            id,
            type,
            correct_indices
          )
        )
      `)
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single()

    if (attemptError || !attempt) {
      return new Response(
        JSON.stringify({ error: 'Quiz attempt not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate score
    const questions = attempt.block.quiz_questions
    const userAnswers = attempt.answers || []
    
    let correctAnswers = 0
    const questionResults = []

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const userAnswer = userAnswers[i]
      const correctIndices = question.correct_indices || []
      
      let isCorrect = false
      
      if (question.type === 'single' || question.type === 'truefalse') {
        // Single choice or true/false
        isCorrect = userAnswer !== undefined && 
                   correctIndices.length > 0 && 
                   userAnswer === correctIndices[0]
      } else if (question.type === 'multiple') {
        // Multiple choice - check if arrays are equal
        if (Array.isArray(userAnswer) && Array.isArray(correctIndices)) {
          isCorrect = userAnswer.length === correctIndices.length &&
                     userAnswer.every((answer, index) => answer === correctIndices[index])
        }
      }
      
      if (isCorrect) {
        correctAnswers++
      }
      
      questionResults.push({
        questionId: question.id,
        isCorrect,
        userAnswer,
        correctAnswer: correctIndices
      })
    }

    const score = questions.length > 0 ? (correctAnswers / questions.length) * 100 : 0
    const isPassing = score >= 70 // 70% passing threshold

    // Update the quiz attempt with results
    const { error: updateError } = await supabaseClient
      .from('learning.quiz_attempts')
      .update({
        is_correct: isPassing,
        score: score
      })
      .eq('id', attemptId)

    if (updateError) {
      console.error('Error updating quiz attempt:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update quiz attempt' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If passing, mark lesson as completed
    if (isPassing) {
      const { error: progressError } = await supabaseClient
        .from('learning.lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: attempt.block.lesson_id,
          status: 'completed',
          completed_at: new Date().toISOString()
        })

      if (progressError) {
        console.error('Error updating lesson progress:', progressError)
        // Don't fail the request, just log the error
      }
    }

    return new Response(
      JSON.stringify({ 
        score,
        isPassing,
        correctAnswers,
        totalQuestions: questions.length,
        questionResults
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})