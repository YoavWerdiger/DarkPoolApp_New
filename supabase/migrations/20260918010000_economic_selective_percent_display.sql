-- Selective % helper + trigger (mirror of applied MCP migration)
CREATE OR REPLACE FUNCTION public.economic_display_value_for_push(p_title TEXT, p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_title TEXT := lower(COALESCE(p_title, ''));
  v_clean TEXT;
  v_show_pct BOOLEAN := false;
BEGIN
  v_clean := NULLIF(TRIM(regexp_replace(COALESCE(p_raw, ''), '[%٪]', '', 'g')), '');
  IF v_clean IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_title ~* '(cpi|consumer price|pce|personal consumption|ppi|producer price|\mpmi\M|\mism\M|s&p global|consumer confidence|consumer sentiment|michigan sentiment|nahb|nonfarm|non-farm|\mnfp\M|payroll|jobless claims|initial claims|continuing claims|\mjolts\M|job openings|retail sales|durable goods|housing starts|building permits|home sales|existing home|new home|trade balance|trade deficit|factory orders|industrial production|crude oil|api crude|\madp\M|מדד המחירים|מדד מחירי|תעסוקה לא.?חקלא|תביעות אבטלה|מכירות קמעונ)'
     AND v_title !~* '(inflation expectation|ציפיות אינפלציה)' THEN
    RETURN v_clean;
  END IF;

  IF v_title ~* '(unemployment|interest rate|fed funds|federal funds|fomc.*rate|rate decision|cash rate|bank rate|inflation expectation|michigan.*inflation|uom.*inflation|average hourly earnings|avg hourly earnings|hourly earnings|gdp growth|growth rate|\mgdp\M.*(qoq|yoy|q/q|y/y|mom|m/m)|labor force participation|participation rate|capacity utilization|שיעור אבטלה|אבטלה|החלטת ריבית|ריבית הפד|ריבית הבסיס|ציפיות אינפלציה|שכר.*שעה|צמיחת תוצר|צמיחת gdp)' THEN
    v_show_pct := true;
  END IF;

  IF v_show_pct THEN
    RETURN v_clean || '%';
  END IF;
  RETURN v_clean;
END;
$$;
