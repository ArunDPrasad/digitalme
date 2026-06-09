-- 1. Journal Entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    mood_evolution TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Site Settings (Bio, Stats, etc.)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    bio TEXT,
    ventures_count INTEGER DEFAULT 0,
    experience_years INTEGER DEFAULT 0,
    phone TEXT,
    email TEXT,
    next5_start_date DATE DEFAULT '2024-05-01',
    cover_url TEXT,
    cover_position_y INTEGER DEFAULT 50
);

-- 3. Ventures (Pinned Milestones)
CREATE TABLE IF NOT EXISTS public.ventures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[],
    link TEXT,
    display_order INTEGER DEFAULT 0
);

-- 4. Login Attempts (Brute Force Protection)
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT UNIQUE NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    lockout_until TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for journal_entries (Private)
DROP POLICY IF EXISTS "Users can only access their own entries" ON public.journal_entries;
CREATE POLICY "Users can only access their own entries" ON public.journal_entries FOR ALL USING (auth.uid() = user_id);

-- Policies for site_settings (Public view, Admin Edit)
DROP POLICY IF EXISTS "Public View Site Settings" ON public.site_settings;
CREATE POLICY "Public View Site Settings" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin Manage Site Settings" ON public.site_settings;
CREATE POLICY "Admin Manage Site Settings" ON public.site_settings FOR ALL USING (auth.uid() IS NOT NULL);

-- Policies for ventures (Public view, Admin Edit)
DROP POLICY IF EXISTS "Public View Ventures" ON public.ventures;
CREATE POLICY "Public View Ventures" ON public.ventures FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin Manage Ventures" ON public.ventures;
CREATE POLICY "Admin Manage Ventures" ON public.ventures FOR ALL USING (auth.uid() IS NOT NULL);

-- Policies for login_attempts (System/Admin Only)
DROP POLICY IF EXISTS "Admin Manage Login Attempts" ON public.login_attempts;
CREATE POLICY "Admin Manage Login Attempts" ON public.login_attempts FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. Security Functions (Bypassing RLS safely for failure tracking)
CREATE OR REPLACE FUNCTION record_login_failure(target_ip TEXT) 
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.login_attempts (ip_address, attempts, last_attempt)
    VALUES (target_ip, 1, NOW())
    ON CONFLICT (ip_address) DO UPDATE 
    SET attempts = login_attempts.attempts + 1,
        last_attempt = NOW(),
        lockout_until = CASE 
            WHEN login_attempts.attempts + 1 >= 5 THEN NOW() + INTERVAL '1 hour'
            ELSE NULL
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_login_attempts(target_ip TEXT) 
RETURNS VOID AS $$
BEGIN
    UPDATE public.login_attempts 
    SET attempts = 0, lockout_until = NULL 
    WHERE ip_address = target_ip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_login_failure(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reset_login_attempts(TEXT) TO authenticated;

-- 6. Storage Bucket & Policies (Cover Media)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'profile-media');

DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-media');

DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
CREATE POLICY "Admin Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-media');

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-media');

-- Migration: Add tags and metadata to journal_entries
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

