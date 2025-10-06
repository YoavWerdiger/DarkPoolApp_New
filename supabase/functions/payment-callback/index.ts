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
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Payment Callback: Processing callback from CardCom')

    // Parse the callback data from CardCom
    const formData = await req.formData()
    const callbackData = Object.fromEntries(formData.entries())

    console.log('🔄 Payment Callback: Received data:', callbackData)

    // Extract transaction details
    const {
      TransactionId,
      ResponseCode,
      ResponseText,
      Sum,
      Currency,
      CustomFields,
      CardToken,
      CardMask,
      CardType,
      ApprovalNumber,
      VoucherNumber,
      LowProfileCode
    } = callbackData

    // Parse custom fields to get our internal data
    let userId = ''
    let planId = ''
    let transactionId = ''

    try {
      const customFields = JSON.parse(CustomFields || '{}')
      userId = customFields.userId || ''
      planId = customFields.planId || ''
      transactionId = customFields.transactionId || ''
    } catch (error) {
      console.error('❌ Payment Callback: Error parsing custom fields:', error)
    }

    console.log('🔄 Payment Callback: Extracted data:', {
      userId,
      planId,
      transactionId,
      cardcomTransactionId: TransactionId,
      responseCode: ResponseCode,
      amount: Sum
    })

    // Determine payment status based on CardCom response
    let status = 'failed'
    if (ResponseCode === '0') {
      status = 'success'
    } else if (ResponseCode === '1') {
      status = 'pending'
    }

    // Update the payment transaction record
    if (transactionId) {
      const { error: updateError } = await supabaseClient
        .from('payment_transactions')
        .update({
          status: status,
          cardcom_transaction_id: TransactionId,
          callback_data: callbackData,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)

      if (updateError) {
        console.error('❌ Payment Callback: Error updating transaction:', updateError)
      } else {
        console.log('✅ Payment Callback: Transaction updated successfully')
      }
    }

    // If payment was successful, update user subscription
    if (status === 'success' && userId && planId) {
      console.log('🔄 Payment Callback: Updating user subscription')

      // Get plan details
      const { data: planData, error: planError } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (planError) {
        console.error('❌ Payment Callback: Error getting plan:', planError)
      } else if (planData) {
        // Calculate expiration date
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 1) // One month from now

        // Update user subscription details
        const { error: userError } = await supabaseClient
          .from('users')
          .update({
            subscription_plan: planId,
            subscription_role: planData.role,
            subscription_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (userError) {
          console.error('❌ Payment Callback: Error updating user:', userError)
        } else {
          console.log('✅ Payment Callback: User subscription updated')
        }

        // Create or update user subscription record
        const { error: subscriptionError } = await supabaseClient
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            starts_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            auto_renew: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,plan_id'
          })

        if (subscriptionError) {
          console.error('❌ Payment Callback: Error creating subscription:', subscriptionError)
        } else {
          console.log('✅ Payment Callback: User subscription record created/updated')
        }
      }
    }

    // Return response to CardCom
    const response = {
      success: true,
      message: 'Callback processed successfully',
      transactionId: transactionId,
      status: status
    }

    console.log('✅ Payment Callback: Processing completed successfully')

    return new Response(
      JSON.stringify(response),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Payment Callback: Error processing callback:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500,
      },
    )
  }
})
