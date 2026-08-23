-- Allow poll creators to let voters change their answer after voting.
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS allow_vote_change BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.polls.allow_vote_change IS
  'When true, voters may change (replace) their vote after casting it. Default false.';
