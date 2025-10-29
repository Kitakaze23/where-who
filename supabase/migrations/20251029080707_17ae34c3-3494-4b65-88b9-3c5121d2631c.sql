-- Add team field to employees table
ALTER TABLE public.employees 
ADD COLUMN team TEXT;

-- Create sick_leave_periods table for tracking sick leave
CREATE TABLE public.sick_leave_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sick_leave_periods ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow public access to sick_leave_periods" 
ON public.sick_leave_periods 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add index for better performance
CREATE INDEX idx_sick_leave_employee_id ON public.sick_leave_periods(employee_id);
CREATE INDEX idx_sick_leave_dates ON public.sick_leave_periods(start_date, end_date);