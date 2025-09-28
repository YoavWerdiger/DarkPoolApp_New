import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  path: string;
  expiresIn?: number;
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
    const { path, expiresIn = 3600 }: RequestBody = await req.json()

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Path is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract course ID from path
    const pathParts = path.split('/')
    if (pathParts.length < 3 || pathParts[0] !== 'course-media') {
      return new Response(
        JSON.stringify({ error: 'Invalid path format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const courseId = pathParts[1]

    // Check if user has access to this course
    const { data: enrollment, error: enrollmentError } = await supabaseClient
      .from('learning.enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single()

    // If not enrolled, check if it's a preview lesson
    if (enrollmentError || !enrollment) {
      // Check if this is a preview lesson
      const { data: previewLesson, error: previewError } = await supabaseClient
        .from('learning.lesson_blocks')
        .select(`
          id,
          lesson:lessons!inner(
            id,
            is_preview,
            module:modules!inner(
              course_id
            )
          )
        `)
        .eq('video_key', path)
        .eq('lesson.is_preview', true)
        .eq('lesson.module.course_id', courseId)
        .single()

      if (previewError || !previewLesson) {
        return new Response(
          JSON.stringify({ error: 'Access denied - not enrolled and not preview' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Create signed URL
    const { data: signedUrl, error: signedUrlError } = await supabaseClient.storage
      .from('course-media')
      .createSignedUrl(path, expiresIn)

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError)
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        signedUrl: signedUrl.signedUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
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