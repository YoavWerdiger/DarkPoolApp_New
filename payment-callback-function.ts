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

    // Extract transaction details from LowProfile API
    const {
      LowProfileId,
      TranzactionId,
      ResponseCode,
      Description,
      Amount,
      ReturnValue,
      UIValues,
      TranzactionInfo,
      DocumentInfo
    } = callbackData

    // Extract our internal data from ReturnValue
    const transactionId = ReturnValue || ''
    
    // Parse transaction info to get user details
    let userId = ''
    let planId = ''
    let userEmail = ''
    let userName = ''
    
    // Extract from CustomFields if available
    if (callbackData.CustomFields) {
      try {
        const customFields = JSON.parse(callbackData.CustomFields)
        const userIdValue = customFields.find((field: any) => field.Name === 'userId')?.Value || ''
        userId = userIdValue === 'pending' ? '' : userIdValue
        planId = customFields.find((field: any) => field.Name === 'planId')?.Value || ''
      } catch (e) {
        console.error('❌ Payment Callback: Error parsing custom fields:', e)
      }
    }
    
    if (UIValues) {
      try {
        const uiValues = JSON.parse(UIValues)
        userEmail = uiValues.CardOwnerEmail || ''
        userName = uiValues.CardOwnerName || ''
      } catch (e) {
        console.error('❌ Payment Callback: Error parsing UI values:', e)
      }
    }

    console.log('🔄 Payment Callback: Extracted data:', {
      userId,
      planId,
      transactionId,
      cardcomTransactionId: TranzactionId,
      responseCode: ResponseCode,
      amount: Amount
    })

    // Determine payment status based on CardCom response
    let status = 'failed'
    if (ResponseCode === 0 || ResponseCode === '0') {
      status = 'success'
    } else if (ResponseCode === 1 || ResponseCode === '1') {
      status = 'pending'
    }

    // Update the payment transaction record
    if (transactionId) {
      const { error: updateError } = await supabaseClient
        .from('payment_transactions')
        .update({
          status: status,
          cardcom_low_profile_id: LowProfileId,
          cardcom_transaction_id: TranzactionId,
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
        // Calculate expiration date based on plan period
        const expiresAt = new Date()
        if (planData.period === 'monthly') {
          expiresAt.setMonth(expiresAt.getMonth() + 1)
        } else if (planData.period === 'quarterly') {
          expiresAt.setMonth(expiresAt.getMonth() + 3)
        } else if (planData.period === 'yearly') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1) // Default to monthly
        }

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
