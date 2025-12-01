-- Create companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  user_password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(user_id, role, company_id)
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Update employees table to add company_id
ALTER TABLE employees ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Update settings table to add company_id
ALTER TABLE settings ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Update office_layout table to add company_id
ALTER TABLE office_layout ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;