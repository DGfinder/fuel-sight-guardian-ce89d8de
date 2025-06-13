-- Add user preferences table for Fuel Sight Guardian
-- This table stores user-specific settings and preferences

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
    default_depot_group UUID REFERENCES tank_groups(id) ON DELETE SET NULL,
    timezone TEXT DEFAULT 'UTC',
    email_alerts BOOLEAN DEFAULT true,
    sms_alerts BOOLEAN DEFAULT false,
    webhook_alerts BOOLEAN DEFAULT false,
    low_fuel_threshold INTEGER DEFAULT 20 CHECK (low_fuel_threshold >= 0 AND low_fuel_threshold <= 100),
    critical_fuel_threshold INTEGER DEFAULT 10 CHECK (critical_fuel_threshold >= 0 AND critical_fuel_threshold <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(user_id),
    CHECK (critical_fuel_threshold <= low_fuel_threshold)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_default_depot ON user_preferences(default_depot_group);

-- Enable RLS (Row Level Security)
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- Grant necessary permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;