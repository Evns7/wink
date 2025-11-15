-- Drop the old restrictive check constraint
ALTER TABLE public.preferences DROP CONSTRAINT IF EXISTS preferences_category_check;

-- Add new check constraint with all hobby categories
ALTER TABLE public.preferences 
ADD CONSTRAINT preferences_category_check 
CHECK (category IN (
  'shopping', 'cafe', 'sports', 'studying', 'music', 
  'concerts', 'parties', 'hiking', 'food', 'movies', 
  'arts', 'gaming', 'fitness', 'photography', 'cooking'
));