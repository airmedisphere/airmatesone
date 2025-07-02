
-- Phase 1: Critical RLS Policy Implementation
-- First, let's fix the build errors and then implement comprehensive RLS policies

-- 1. Fix roommates table RLS policies
DROP POLICY IF EXISTS "Users can view roommates they created or where they are listed" ON public.roommates;
DROP POLICY IF EXISTS "Users can create their own roommates" ON public.roommates;
DROP POLICY IF EXISTS "Users can update roommates they created" ON public.roommates;
DROP POLICY IF EXISTS "Users can delete roommates they created" ON public.roommates;

CREATE POLICY "Users can view their own roommates or where they are listed"
ON public.roommates FOR SELECT
USING (
  auth.uid() = user_id OR 
  email = public.get_current_user_email()
);

CREATE POLICY "Users can create their own roommates"
ON public.roommates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roommates"
ON public.roommates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roommates"
ON public.roommates FOR DELETE
USING (auth.uid() = user_id);

-- 2. Fix expenses table RLS policies
DROP POLICY IF EXISTS "Users can view expenses they created or are involved in" ON public.expenses;
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update expenses they created" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete expenses they created" ON public.expenses;

CREATE POLICY "Users can view expenses they created or are shared with"
ON public.expenses FOR SELECT
USING (
  auth.uid() = user_id OR
  public.get_current_user_email() = ANY(coalesce(sharers, '{}'))
);

CREATE POLICY "Users can create their own expenses"
ON public.expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
ON public.expenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
ON public.expenses FOR DELETE
USING (auth.uid() = user_id);

-- 3. Add missing RLS policies for settlements
CREATE POLICY "Users can view their own settlements"
ON public.settlements FOR SELECT
USING (
  auth.uid() = user_id OR
  auth.uid() = debtor_user_id OR
  auth.uid() = creditor_user_id
);

CREATE POLICY "Users can update their own settlements"
ON public.settlements FOR UPDATE
USING (
  auth.uid() = user_id OR
  auth.uid() = debtor_user_id OR
  auth.uid() = creditor_user_id
);

-- 4. Add RLS policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 5. Add RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- 6. Add RLS policies for shared_notes
CREATE POLICY "All users can view shared notes"
ON public.shared_notes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create shared notes"
ON public.shared_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shared notes"
ON public.shared_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared notes"
ON public.shared_notes FOR DELETE
USING (auth.uid() = user_id);

-- 7. Add RLS policies for chores
CREATE POLICY "All users can view chores"
ON public.chores FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own chores"
ON public.chores FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own chores"
ON public.chores FOR DELETE
USING (auth.uid() = created_by);

-- 8. Add RLS policies for events
CREATE POLICY "All users can view events"
ON public.events FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own events"
ON public.events FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own events"
ON public.events FOR DELETE
USING (auth.uid() = created_by);
