
-- Create designs table
CREATE TABLE public.designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('evaluate', '2d', '3d')),
  name TEXT NOT NULL DEFAULT 'Untitled Design',
  thumbnail_url TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own designs
CREATE POLICY "Users can view own designs" ON public.designs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own designs
CREATE POLICY "Users can insert own designs" ON public.designs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own designs
CREATE POLICY "Users can update own designs" ON public.designs
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own designs
CREATE POLICY "Users can delete own designs" ON public.designs
  FOR DELETE USING (auth.uid() = user_id);
