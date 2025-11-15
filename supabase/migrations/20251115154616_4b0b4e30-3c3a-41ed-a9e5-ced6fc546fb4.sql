-- Phase 1: Add context JSONB column to activity_swipes table
ALTER TABLE public.activity_swipes 
ADD COLUMN IF NOT EXISTS context JSONB;

COMMENT ON COLUMN public.activity_swipes.context IS 'Stores session metadata: {score_breakdown: {preference: 28, time_fit: 18, weather: 15, budget: 14, proximity: 8, duration: 10}, total_score: 87, weather_conditions: {...}, time_block: {...}, ai_reasoning: "...", insider_tip: "..."}';