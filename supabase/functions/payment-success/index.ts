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
    console.log('🔄 Payment Success: Processing success callback')

    // Parse query parameters
    const url = new URL(req.url)
    const transactionId = url.searchParams.get('TransactionId')
    const responseCode = url.searchParams.get('ResponseCode')
    const customFields = url.searchParams.get('CustomFields')

    console.log('🔄 Payment Success: Received parameters:', {
      transactionId,
      responseCode,
      customFields
    })

    // Parse custom fields
    let userId = ''
    let planId = ''
    let internalTransactionId = ''

    try {
      const fields = JSON.parse(customFields || '{}')
      userId = fields.userId || ''
      planId = fields.planId || ''
      internalTransactionId = fields.transactionId || ''
    } catch (error) {
      console.error('❌ Payment Success: Error parsing custom fields:', error)
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update transaction status
    if (internalTransactionId) {
      const { error: updateError } = await supabaseClient
        .from('payment_transactions')
        .update({
          status: responseCode === '0' ? 'success' : 'failed',
          cardcom_transaction_id: transactionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', internalTransactionId)

      if (updateError) {
        console.error('❌ Payment Success: Error updating transaction:', updateError)
      }
    }

    // Return success page HTML
    const successHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>תשלום הושלם בהצלחה</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #000000 0%, #0d1b0d 50%, #1a2d1a 100%);
                margin: 0;
                padding: 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }
            .container {
                background: rgba(26, 26, 26, 0.9);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                border: 2px solid #00E654;
                box-shadow: 0 0 30px rgba(0, 230, 84, 0.3);
                max-width: 400px;
                width: 100%;
            }
            .success-icon {
                width: 80px;
                height: 80px;
                background: #00E654;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                font-size: 40px;
            }
            h1 {
                color: #00E654;
                font-size: 24px;
                margin-bottom: 16px;
                font-weight: 700;
            }
            p {
                color: #B0B0B0;
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 30px;
            }
            .button {
                background: linear-gradient(135deg, #00E654, #00B84A);
                color: #000000;
                padding: 16px 32px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 700;
                font-size: 16px;
                display: inline-block;
                transition: transform 0.2s;
            }
            .button:hover {
                transform: translateY(-2px);
            }
            .transaction-id {
                background: rgba(0, 230, 84, 0.1);
                padding: 12px;
                border-radius: 8px;
                margin-top: 20px;
                font-family: monospace;
                font-size: 12px;
                color: #00E654;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-icon">✓</div>
            <h1>תשלום הושלם בהצלחה!</h1>
            <p>המנוי שלך הופעל בהצלחה. תוכל לחזור לאפליקציה ולהתחיל להשתמש בכל התכונות.</p>
            <a href="darkpoolapp://payment/success" class="button">חזור לאפליקציה</a>
            ${transactionId ? `<div class="transaction-id">מספר עסקה: ${transactionId}</div>` : ''}
        </div>
        
        <script>
            // Auto redirect to app after 5 seconds
            setTimeout(() => {
                window.location.href = 'darkpoolapp://payment/success';
            }, 5000);
        </script>
    </body>
    </html>
    `

    return new Response(successHtml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8' 
      },
      status: 200,
    })

  } catch (error) {
    console.error('❌ Payment Success: Error processing success:', error)
    
    const errorHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>שגיאה בתשלום</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #000000 0%, #1a0a0a 50%, #2d0a0a 100%);
                margin: 0;
                padding: 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }
            .container {
                background: rgba(26, 26, 26, 0.9);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                border: 2px solid #DC2626;
                box-shadow: 0 0 30px rgba(220, 38, 38, 0.3);
                max-width: 400px;
                width: 100%;
            }
            .error-icon {
                width: 80px;
                height: 80px;
                background: #DC2626;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                font-size: 40px;
            }
            h1 {
                color: #DC2626;
                font-size: 24px;
                margin-bottom: 16px;
                font-weight: 700;
            }
            p {
                color: #B0B0B0;
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 30px;
            }
            .button {
                background: linear-gradient(135deg, #DC2626, #B91C1C);
                color: #FFFFFF;
                padding: 16px 32px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 700;
                font-size: 16px;
                display: inline-block;
                transition: transform 0.2s;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-icon">✗</div>
            <h1>שגיאה בתשלום</h1>
            <p>אירעה שגיאה בעיבוד התשלום. אנא נסה שוב או פנה לתמיכה.</p>
            <a href="darkpoolapp://payment/error" class="button">חזור לאפליקציה</a>
        </div>
    </body>
    </html>
    `
    
    return new Response(errorHtml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8' 
      },
      status: 500,
    })
  }
})
