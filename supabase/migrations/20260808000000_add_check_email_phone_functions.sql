-- Create function to check if email already exists
-- Used during registration to validate email uniqueness before creating account
CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE email = email_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if phone already exists
-- Used during registration to validate phone uniqueness
CREATE OR REPLACE FUNCTION check_phone_exists(phone_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE phone = phone_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_phone_exists(TEXT) TO authenticated;

-- Also grant to anon for registration flow (before authentication)
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_phone_exists(TEXT) TO anon;
