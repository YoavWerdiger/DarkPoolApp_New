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
    const transactionId = url.searchParams.get('TranzactionId')
    const responseCode = url.searchParams.get('ResponseCode')
    const returnValue = url.searchParams.get('ReturnValue')

    console.log('🔄 Payment Success: Received parameters:', {
      transactionId,
      responseCode,
      returnValue
    })

    // Use returnValue as internal transaction ID
    const internalTransactionId = returnValue || ''

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
          status: (responseCode === '0' || responseCode === 0) ? 'success' : 'failed',
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
            * {
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #121212;
                margin: 0;
                padding: 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
            }
            .container {
                background: #1A1A1A;
                border-radius: 16px;
                padding: 40px;
                text-align: center;
                border: 1px solid #2a2a2a;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            .success-icon {
                width: 80px;
                height: 80px;
                background: #05d157;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                font-size: 40px;
                color: #FFFFFF;
            }
            h1 {
                color: #FFFFFF;
                font-size: 24px;
                margin-bottom: 12px;
                font-weight: 700;
            }
            p {
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .button {
                background: #05d157;
                color: #FFFFFF;
                padding: 16px 32px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                display: inline-block;
                transition: all 0.2s ease;
                border: none;
                cursor: pointer;
            }
            .button:hover {
                background: #04b449;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(5, 209, 87, 0.3);
            }
            .transaction-id {
                background: rgba(5, 209, 87, 0.1);
                padding: 12px;
                border-radius: 8px;
                margin-top: 20px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: #05d157;
                border: 1px solid rgba(5, 209, 87, 0.2);
            }
            .logo {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.4);
                margin-top: 24px;
                font-weight: 500;
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
            <div class="logo">DarkPool</div>
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
            * {
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #121212;
                margin: 0;
                padding: 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
            }
            .container {
                background: #1A1A1A;
                border-radius: 16px;
                padding: 40px;
                text-align: center;
                border: 1px solid #2a2a2a;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            .error-icon {
                width: 80px;
                height: 80px;
                background: #DC2626;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                font-size: 40px;
                color: #FFFFFF;
            }
            h1 {
                color: #FFFFFF;
                font-size: 24px;
                margin-bottom: 12px;
                font-weight: 700;
            }
            p {
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .button {
                background: #DC2626;
                color: #FFFFFF;
                padding: 16px 32px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                display: inline-block;
                transition: all 0.2s ease;
                border: none;
                cursor: pointer;
            }
            .button:hover {
                background: #B91C1C;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
            }
            .logo {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.4);
                margin-top: 24px;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-icon">✗</div>
            <h1>שגיאה בתשלום</h1>
            <p>אירעה שגיאה בעיבוד התשלום. אנא נסה שוב או פנה לתמיכה.</p>
            <a href="darkpoolapp://payment/error" class="button">חזור לאפליקציה</a>
            <div class="logo">DarkPool</div>
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
