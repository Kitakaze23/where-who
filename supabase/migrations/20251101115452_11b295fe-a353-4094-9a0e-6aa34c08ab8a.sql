-- Create settings table for storing office configuration
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow public access to settings" 
ON public.settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert default total desks setting
INSERT INTO public.settings (setting_key, setting_value) 
VALUES ('total_desks', '10');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();