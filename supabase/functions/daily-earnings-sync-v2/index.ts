import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NewApiResponseItem {
  company_name: string | null;
  eps_estimate: number | string | null;
  quarter: string | null;
  report_date: string;
  report_time: string | null;
  revenue_estimate: number | string | null;
  ticker: string;
  raw?: {
    assetName?: string;
    earningsDate?: string;
    earningsTime?: string;
    eps?: number;
    epsEstimate?: number;
    epsPrior?: number;
    epsSurprise?: number;
    epsSurprisePercent?: number;
    importance?: number;
    marketCap?: number;
    period?: string;
    periodYear?: number;
    revenue?: number;
    revenueEstimate?: number;
    revenuePrior?: number;
    revenueSurprise?: number;
    revenueSurprisePercent?: number;
    symbol?: string;
  };
}

function parseNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  
  let str = val.toString().trim().toUpperCase();
  let multiplier = 1;
  
  if (str.endsWith('B')) {
    multiplier = 1_000_000_000;
    str = str.slice(0, -1);
  } else if (str.endsWith('M')) {
    multiplier = 1_000_000;
    str = str.slice(0, -1);
  } else if (str.endsWith('K')) {
    multiplier = 1_000;
    str = str.slice(0, -1);
  }
  
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return num * multiplier;
}

function parseTime(timeStr: string | null): string {
  if (!timeStr) return 'Time Not Supplied';
  const lower = timeStr.toLowerCase();
  if (lower.includes('after') || lower.includes('close')) return 'After Market';
  if (lower.includes('before') || lower.includes('open')) return 'Before Market';
  if (lower.match(/\d{2}:\d{2}/)) return timeStr; // Keep specific time if given
  return 'Time Not Supplied';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Daily Earnings Sync V2 (New API) started')
    
    // Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse.bot API Key
    // Note: User needs to set this secret
    // Try to get from header first (for testing), then env
    const authHeader = req.headers.get('Authorization'); // This is for the function itself usually
    // We look for a specific header for the API key if passed, or env
    const apiKey = Deno.env.get('EARNINGS_API_KEY') || Deno.env.get('PARSE_BOT_API_KEY');

    if (!apiKey) {
      console.warn('⚠️ Missing EARNINGS_API_KEY or PARSE_BOT_API_KEY in environment variables.');
      // For now, we continue but the API call might fail if it requires auth and we don't have it.
      // However, if the user provided the key in the code snippet, I should have it.
      // Since I don't have it, I will assume the user needs to set it.
    }

    // 1. Fetch Data
    // Try get_upcoming_earnings first, if it fails, try fetch_earnings_data and filter locally
    console.log('🔄 Fetching earnings data from API...');
    console.log('🔑 API Key present:', apiKey ? 'Yes' : 'No');
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    const startDateStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    let responseData: any = null;
    
    // Try get_upcoming_earnings first
    try {
      console.log('📡 Trying get_upcoming_earnings...');
      const upcomingUrl = 'https://api.parse.bot/scraper/5bcb6c63-dbcd-4383-9928-d7eb9e6d55ed/get_upcoming_earnings';
      const upcomingResponse = await fetch(upcomingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {})
        },
        body: JSON.stringify({})
      });

      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json();
        if (Array.isArray(upcomingData) && upcomingData.length > 0) {
          console.log(`✅ get_upcoming_earnings returned ${upcomingData.length} records`);
          responseData = upcomingData;
        }
      }
    } catch (err) {
      console.log('⚠️ get_upcoming_earnings failed, trying alternative approach...');
    }

    // If get_upcoming_earnings didn't work, try fetch_earnings_data and filter locally
    if (!responseData || !Array.isArray(responseData)) {
      console.log('📡 Trying fetch_earnings_data...');
      const fetchUrl = 'https://api.parse.bot/scraper/5bcb6c63-dbcd-4383-9928-d7eb9e6d55ed/fetch_earnings_data';
      const fetchResponse = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {})
        },
        body: JSON.stringify({})
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`Fetch API Error: ${fetchResponse.status} ${errorText}`);
      }

      const fetchResponseData = await fetchResponse.json();
      console.log('📦 Fetch Response Type:', Array.isArray(fetchResponseData) ? 'Array' : typeof fetchResponseData);

      // Handle response
      let allEarningsData: NewApiResponseItem[] = [];
      if (Array.isArray(fetchResponseData)) {
        allEarningsData = fetchResponseData;
      } else if (fetchResponseData && typeof fetchResponseData === 'object') {
        if (fetchResponseData.error) {
          throw new Error(`Fetch API Error: ${fetchResponseData.error}`);
        }
        if (Array.isArray(fetchResponseData.data)) {
          allEarningsData = fetchResponseData.data;
        } else {
          throw new Error(`Unexpected fetch response format`);
        }
      }

      console.log(`📊 Fetched ${allEarningsData.length} total records from fetch_earnings_data`);

      // Filter locally by date
      console.log(`📅 Filtering locally from ${startDateStr} to ${endDateStr}...`);
      responseData = allEarningsData.filter(item => {
        const reportDate = item.report_date || item.raw?.earningsDate;
        return reportDate && reportDate >= startDateStr && reportDate <= endDateStr;
      });
      
      console.log(`📊 Filtered to ${responseData.length} records`);
    }

    if (!responseData || !Array.isArray(responseData) || responseData.length === 0) {
      console.warn('⚠️ No earnings data available');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Earnings sync completed - No data available from API',
          inserted_count: 0,
          source: 'New API'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('📦 Final Response Type:', Array.isArray(responseData) ? 'Array' : typeof responseData);
    console.log('📦 Final Response count:', responseData.length);

    // Handle both array and object responses
    let data: NewApiResponseItem[] = [];
    if (Array.isArray(responseData)) {
      data = responseData;
    } else if (responseData && typeof responseData === 'object') {
      // Check if it's an error object
      if (responseData.error) {
        const errorMsg = responseData.error;
        console.error('❌ API returned error:', errorMsg);
        throw new Error(`API returned error: ${errorMsg}`);
      }
      // Check if data is nested
      if (Array.isArray(responseData.data)) {
        data = responseData.data;
      } else {
        console.warn('⚠️ Unexpected response format:', Object.keys(responseData));
        throw new Error('Unexpected API response format');
      }
    } else {
      throw new Error('Invalid API response format');
    }

    console.log(`📊 Fetched ${data.length} records from API`);

    if (data.length > 0) {
      console.log('✅ Sample item:', JSON.stringify(data[0], null, 2));
    } else {
      console.warn('⚠️ No records returned from API');
    }

    // 2. Process and Upsert to Database
    if (data.length === 0) {
      console.warn('⚠️ No data to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Earnings sync completed - No data available from API',
          inserted_count: 0,
          source: 'New API',
          warning: 'API returned empty array'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let insertedCount = 0;
    let errorCount = 0;

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const recordsToUpsert = batch.map(item => {
        const raw = item.raw || {};
        const ticker = item.ticker ? item.ticker.toUpperCase() : raw.symbol;
        if (!ticker) return null;

        // Ensure .US suffix for consistency if it's a US stock system
        // The current system seems to use .US. The new API returns plain tickers.
        // We'll append .US if it's not present.
        const code = ticker.includes('.') ? ticker : `${ticker}.US`;

        // Map fields according to API JSON structure exactly
        return {
          // Primary key - UUID will be generated automatically
          
          // Main fields from API (top level)
          ticker: ticker, // Original ticker without .US
          code: code, // ticker.US for backward compatibility
          company_name: item.company_name || null,
          report_date: item.report_date || raw.earningsDate,
          report_time: item.report_time || null,
          quarter: item.quarter || null,
          eps_estimate: parseNumber(item.eps_estimate) ?? null,
          revenue_estimate: parseNumber(item.revenue_estimate) ?? null,
          
          // Fields from raw object
          symbol: raw.symbol || ticker || null,
          sk: raw.sk || null,
          earnings_date: raw.earningsDate || item.report_date || null,
          earnings_time: raw.earningsTime || null,
          earnings_date_time: raw.earningsDateTime ? new Date(raw.earningsDateTime).toISOString() : null,
          
          // EPS fields from raw
          eps: raw.eps ?? null,
          eps_estimate_raw: raw.epsEstimate ?? null,
          eps_prior: raw.epsPrior ?? null,
          eps_surprise: raw.epsSurprise ?? null,
          eps_surprise_percent: raw.epsSurprisePercent ?? null,
          
          // Revenue fields from raw
          revenue: raw.revenue ?? null,
          revenue_estimate_raw: raw.revenueEstimate ?? null,
          revenue_prior: raw.revenuePrior ?? null,
          revenue_surprise: raw.revenueSurprise ?? null,
          revenue_surprise_percent: raw.revenueSurprisePercent ?? null,
          
          // Period fields
          period: raw.period || null,
          period_year: raw.periodYear || null,
          
          // Metadata
          importance: raw.importance ?? null,
          is_date_confirmed: raw.isDateConfirmed ?? false,
          market_cap: raw.marketCap ?? null,
          external_id: raw.externalId || null,
          asset_name: raw.assetName || item.company_name || null,
          
          // Backward compatibility fields
          date: item.report_date || raw.earningsDate,
          time: raw.earningsTime || null,
          before_after_market: parseTime(item.report_time || (raw.earningsTime ? raw.earningsTime : null)),
          estimate: parseNumber(item.eps_estimate) ?? raw.epsEstimate ?? null,
          actual: raw.eps ?? null,
          revenue_estimate_avg: parseNumber(item.revenue_estimate) ?? raw.revenueEstimate ?? null,
          revenue_actual: raw.revenue ?? null,
          
          // Source
          api_source: item.source || 'earningshub.com',
          source: 'earningshub.com',
          currency: 'USD',
          
          // Timestamps
          updated_at: new Date().toISOString()
        };
      }).filter(Boolean);

      if (recordsToUpsert.length === 0) {
        console.warn('⚠️ No valid records to upsert in this batch');
        continue;
      }

      console.log(`📝 Attempting to upsert ${recordsToUpsert.length} records...`);
      console.log('📋 Sample record:', JSON.stringify(recordsToUpsert[0], null, 2));

      // Upsert using unique constraint
      // Try ticker first, fallback to code if ticker constraint doesn't exist
      let error = null;
      
      // First try with ticker
      console.log('🔄 Trying upsert with ticker,report_date...');
      const { error: tickerError, data: tickerData } = await supabase
        .from('earnings_calendar')
        .upsert(recordsToUpsert, {
          onConflict: 'ticker,report_date',
          ignoreDuplicates: false
        });
      
      if (tickerError) {
        console.log('⚠️ Ticker upsert error:', tickerError.message);
        if (tickerError.message.includes('unique constraint') || tickerError.message.includes('no unique constraint')) {
          // Fallback to code if ticker constraint doesn't exist
          console.log('🔄 Falling back to code,report_date...');
          const { error: codeError, data: codeData } = await supabase
            .from('earnings_calendar')
            .upsert(recordsToUpsert, {
              onConflict: 'code,report_date',
              ignoreDuplicates: false
            });
          error = codeError;
          if (!error) {
            console.log(`✅ Upserted ${recordsToUpsert.length} records using code,report_date`);
          }
        } else {
          error = tickerError;
        }
      } else {
        console.log(`✅ Upserted ${recordsToUpsert.length} records using ticker,report_date`);
      }

      if (error) {
        console.error('❌ Error upserting batch:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // Fallback: Try one by one if batch fails
        for (const rec of recordsToUpsert) {
          try {
            // Query for existing record by ticker+date or code+date
            let existing = null;
            if (rec!.ticker) {
              const { data, error: queryError } = await supabase
                .from('earnings_calendar')
                .select('id')
                .eq('ticker', rec!.ticker)
                .eq('report_date', rec!.report_date)
                .maybeSingle();
              if (!queryError) existing = data;
            }
            
            // Fallback to code if ticker didn't find anything
            if (!existing && rec!.code) {
              const { data, error: queryError } = await supabase
                .from('earnings_calendar')
                .select('id')
                .eq('code', rec!.code)
                .eq('report_date', rec!.report_date)
                .maybeSingle();
              if (!queryError) existing = data;
            }
            
            if (queryError) {
              console.error(`❌ Error querying for ${rec!.code}:`, queryError);
              errorCount++;
              continue;
            }
            
            if (existing) {
              // Update existing record
              const { error: updateError } = await supabase
                .from('earnings_calendar')
                .update(rec!)
                .eq('id', existing.id);
              
              if (updateError) {
                console.error(`❌ Error updating ${rec!.code}:`, updateError);
                errorCount++;
              } else {
                insertedCount++;
              }
            } else {
              // Insert new record (UUID will be generated automatically)
              const { error: insertError } = await supabase
                .from('earnings_calendar')
                .insert(rec!);
              
              if (insertError) {
                console.error(`❌ Error inserting ${rec!.code}:`, insertError);
                errorCount++;
              } else {
                insertedCount++;
              }
            }
          } catch (err) {
            console.error(`❌ Exception processing ${rec!.code}:`, err);
            errorCount++;
          }
        }
      } else {
        insertedCount += recordsToUpsert.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings sync completed',
        inserted_count: insertedCount,
        error_count: errorCount,
        total_fetched: data.length,
        source: 'New API'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Sync error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'New API'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
