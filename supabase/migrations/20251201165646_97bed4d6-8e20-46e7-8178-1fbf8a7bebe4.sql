-- Add user_login and user_password columns to employees table
ALTER TABLE employees 
ADD COLUMN user_login text UNIQUE,
ADD COLUMN user_password text;