-- Create desk_reservations table for temporary desk bookings
CREATE TABLE public.desk_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  desk_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT same_week CHECK (
    EXTRACT(WEEK FROM start_date) = EXTRACT(WEEK FROM end_date) AND
    EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM end_date)
  )
);

-- Enable RLS
ALTER TABLE public.desk_reservations ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow public access to desk_reservations" 
ON public.desk_reservations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_desk_reservations_updated_at
BEFORE UPDATE ON public.desk_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_desk_reservations_dates ON public.desk_reservations(start_date, end_date);
CREATE INDEX idx_desk_reservations_employee ON public.desk_reservations(employee_id);