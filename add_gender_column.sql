-- הוספת עמודת gender לטבלת users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- הערה: gender יכול להיות NULL (אופציונלי)







