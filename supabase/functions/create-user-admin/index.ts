// Edge Function ליצירת משתמש ב-auth.users דרך Admin API
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // קבלת פרטי המשתמש מה-request
    const body = await req.json()
    const { email, password, display_name, full_name, phone, track_id, account_type, intro_data } = body
    
    console.log('📥 create-user-admin: Received request:', { 
      email, 
      hasPassword: !!password, 
      display_name, 
      full_name,
      phone,
      track_id,
      account_type
    })

    if (!email || !password) {
      console.error('❌ create-user-admin: Missing email or password')
      return new Response(
        JSON.stringify({ error: 'Email and password are required', code: 'MISSING_CREDENTIALS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // בדיקת הגדרות סביבה
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔧 create-user-admin: Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasServiceKey: !!serviceRoleKey,
      urlPrefix: supabaseUrl?.substring(0, 30)
    })
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ create-user-admin: Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing env vars', code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // יצירת Supabase client עם Admin API (service_role key)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // בדיקה אם המשתמש כבר קיים
    console.log('🔍 create-user-admin: Checking if user exists...')
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ create-user-admin: Error listing users:', listError)
    } else {
      const existingUser = existingUsers?.users?.find((u: any) => u.email === email)
      if (existingUser) {
        console.error('❌ create-user-admin: User already exists:', existingUser.id)
        return new Response(
          JSON.stringify({ error: 'User with this email already exists', code: 'USER_EXISTS' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // יצירת משתמש ב-auth.users דרך Admin API
    console.log('🔄 create-user-admin: Creating user in auth.users...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // אימות מייל אוטומטי
      user_metadata: {
        display_name,
        full_name: full_name || display_name,
        account_type: account_type || 'free'
      }
    })

    if (authError || !authData.user) {
      console.error('❌ create-user-admin: Error creating user in auth.users:', authError)
      return new Response(
        JSON.stringify({ 
          error: authError?.message || 'Failed to create user in auth.users',
          code: 'AUTH_CREATE_FAILED',
          details: authError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id
    console.log('✅ create-user-admin: User created in auth.users:', userId)

    // יצירת פרופיל ב-public.users
    console.log('🔄 create-user-admin: Creating profile in public.users...')
    const profilePayload = {
      id: userId,
      email,
      display_name: display_name || email,
      full_name: full_name || display_name || email,
      phone: phone || null,
      track_id: track_id || '1',
      account_type: account_type || 'free',
      intro_data: intro_data || {},
      registration_completed: true
    }
    console.log('📝 create-user-admin: Profile payload:', profilePayload)
    
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert(profilePayload)
      .select()
      .single()

    if (profileError) {
      console.error('❌ create-user-admin: Error creating user profile:', profileError)
      // אם יש שגיאה ביצירת הפרופיל, נמחק את המשתמש מ-auth.users
      console.log('🧹 create-user-admin: Rolling back - deleting user from auth.users...')
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ 
          error: `Failed to create user profile: ${profileError.message}`,
          code: 'PROFILE_CREATE_FAILED',
          details: profileError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ create-user-admin: Profile created successfully:', profileData)

    // החזרת המשתמש שנוצר
    return new Response(
      JSON.stringify({
        user: {
          id: userId,
          email: authData.user.email || email,
          display_name: profileData.display_name,
          full_name: profileData.full_name,
          phone: profileData.phone,
          profile_picture: profileData.profile_picture,
          account_type: profileData.account_type,
          track_id: profileData.track_id,
          intro_data: profileData.intro_data,
          registration_completed: profileData.registration_completed
        },
        error: null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ create-user-admin: Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        code: 'UNEXPECTED_ERROR',
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})



