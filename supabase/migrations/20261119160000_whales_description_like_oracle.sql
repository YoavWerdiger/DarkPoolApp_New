-- Whales course description in the same structure as the Oracle:
-- who it's for / what you'll learn / the goal — without the English list
-- in parentheses that broke the lines (bidi) on the card.
update public.courses
   set description = $desc$למי הקורס מתאים?
למתחילים ולסוחרים שרוצים ללמוד מהיסודות ועד ניתוח טכני מתקדם, מסחר סווינג ומסחר יומי במניות.

מה תלמדו בקורס?
בקורס תלמדו לנתח מבנה שוק ונזילות בשיטת Smart Money, לזהות אזורי ביקוש והיצע, פערי מחיר ואזורי כניסה איכותיים, וליישם את הכלים במסחר יומי במניות ובאופציות.

המטרה היא לבנות לכם תוכנית עבודה יומית ברורה, לנהל עסקאות בזמן אמת ולשלב בין ניתוח זרימות לבין ניהול סיכונים מסודר.$desc$
 where id = 'whales-course-1';
