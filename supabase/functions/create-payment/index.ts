import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    console.log('🔄 Create Payment: Processing payment creation request')

    // Parse request body
    const { transaction } = await req.json()
    
    console.log('🔄 Create Payment: Transaction data:', JSON.stringify(transaction, null, 2))

    // Validate required fields
    if (!transaction) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing transaction object',
          received: transaction
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const missingFields = []
    if (!transaction.id) missingFields.push('id')
    if (!transaction.userId) missingFields.push('userId')
    if (!transaction.planId) missingFields.push('planId')
    if (transaction.amount === undefined || transaction.amount === null) missingFields.push('amount')
    if (!transaction.status) missingFields.push('status')
    // paymentUrl is optional (nullable in DB)

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          missingFields: missingFields,
          received: transaction
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Insert transaction
    const { data, error } = await supabaseClient
      .from('payment_transactions')
      .insert({
        id: transaction.id,
        user_id: transaction.userId,
        plan_id: transaction.planId,
        amount: transaction.amount,
        currency: transaction.currency || 'ILS',
        status: transaction.status,
        cardcom_low_profile_id: transaction.cardcomLowProfileId || null,
        cardcom_transaction_id: transaction.cardcomTransactionId || null,
        payment_url: transaction.paymentUrl || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Create Payment: Error inserting transaction:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment transaction',
          details: error
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Create Payment: Transaction created successfully:', data)

    return new Response(
      JSON.stringify({ 
        success: true,
        transaction: data
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Create Payment: Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

