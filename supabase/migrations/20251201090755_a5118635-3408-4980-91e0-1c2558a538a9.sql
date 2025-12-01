-- Create storage bucket for office layouts
INSERT INTO storage.buckets (id, name, public)
VALUES ('office_layouts', 'office_layouts', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for office_layouts bucket
CREATE POLICY "Anyone can view office layouts"
ON storage.objects FOR SELECT
USING (bucket_id = 'office_layouts');

CREATE POLICY "Anyone can upload office layouts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'office_layouts');

CREATE POLICY "Anyone can update office layouts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'office_layouts');

CREATE POLICY "Anyone can delete office layouts"
ON storage.objects FOR DELETE
USING (bucket_id = 'office_layouts');