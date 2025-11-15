-- Fix search_path for validation functions
CREATE OR REPLACE FUNCTION validate_preference_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score < 0 OR NEW.score > 10 THEN
    RAISE EXCEPTION 'Preference score must be between 0 and 10';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION validate_profile_budget()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL THEN
    IF NEW.budget_min < 0 THEN
      RAISE EXCEPTION 'Minimum budget cannot be negative';
    END IF;
    IF NEW.budget_max < NEW.budget_min THEN
      RAISE EXCEPTION 'Maximum budget cannot be less than minimum budget';
    END IF;
    IF NEW.budget_max > 10000 THEN
      RAISE EXCEPTION 'Maximum budget seems unreasonably high';
    END IF;
  END IF;
  
  IF NEW.home_address IS NOT NULL AND LENGTH(NEW.home_address) > 500 THEN
    RAISE EXCEPTION 'Address is too long';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;