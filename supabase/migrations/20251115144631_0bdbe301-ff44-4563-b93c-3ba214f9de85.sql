-- Create function for finding nearby activities (fixed parameter names)
CREATE OR REPLACE FUNCTION nearby_activities(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION, radius_km DOUBLE PRECISION)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  price_level INTEGER,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.category,
    a.lat,
    a.lng,
    a.address,
    a.price_level,
    ST_Distance(
      a.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance
  FROM activities a
  WHERE ST_DWithin(
    a.location::geography,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_km * 1000
  )
  ORDER BY distance
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;