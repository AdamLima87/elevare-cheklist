-- Fix security linter warning by explicitly revoking EXECUTE from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- The function still needs to be SECURITY DEFINER to run as trigger on auth.users, 
-- but it shouldn't be callable directly by users via RPC.