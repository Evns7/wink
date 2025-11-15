-- Fix search_path for nearby_activities function
ALTER FUNCTION nearby_activities(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public;