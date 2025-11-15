-- Add missing delete policy for preferences
CREATE POLICY "Users can delete their own preferences"
  ON preferences FOR DELETE
  USING (auth.uid() = user_id);