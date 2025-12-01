import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, password } = await req.json();

    if (!companyName || !password) {
      throw new Error('Company name and password are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Client with anon key for user authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

    // Get company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, user_password')
      .eq('name', companyName)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    // Try to login as admin first
    const email = `${companyName}@company.local`;
    const { data: adminAuth, error: adminError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (!adminError && adminAuth.user) {
      // Get admin role
      const { data: role } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', adminAuth.user.id)
        .eq('role', 'admin')
        .single();

      if (role) {
        return new Response(
          JSON.stringify({
            success: true,
            role: 'admin',
            session: adminAuth.session,
            user: adminAuth.user,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // Check if password matches user password
    if (password === company.user_password) {
      // Try to sign in with existing user account first
      const userEmail = `${companyName}.user@company.local`;
      
      let userAuth = await supabaseAuth.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      // If user doesn't exist or password is wrong, create/update user
      if (userAuth.error) {
        // Try to create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password,
          email_confirm: true,
        });

        // If user already exists, update password
        if (createError && createError.message.includes('already been registered')) {
          // Get existing user by email
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = existingUsers.users.find(u => u.email === userEmail);
          
          if (foundUser) {
            // Update password
            await supabaseAdmin.auth.admin.updateUserById(foundUser.id, { password });
            
            // Try to sign in again with new password
            userAuth = await supabaseAuth.auth.signInWithPassword({
              email: userEmail,
              password,
            });
            
            if (userAuth.error) throw userAuth.error;
            
            return new Response(
              JSON.stringify({
                success: true,
                role: 'user',
                session: userAuth.data.session,
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            );
          }
        } else if (createError) {
          throw createError;
        } else if (newUser) {
          // Create profile and role for new user
          await supabaseAdmin.from('profiles').insert({
            id: newUser.user.id,
            company_id: company.id,
          });

          await supabaseAdmin.from('user_roles').insert({
            user_id: newUser.user.id,
            role: 'user',
            company_id: company.id,
          });
          
          // Sign in with new user
          userAuth = await supabaseAuth.auth.signInWithPassword({
            email: userEmail,
            password,
          });
          
          if (userAuth.error) throw userAuth.error;
          
          return new Response(
            JSON.stringify({
              success: true,
              role: 'user',
              session: userAuth.data.session,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      }

      // If we reached here, user signed in successfully on first try
      return new Response(
        JSON.stringify({
          success: true,
          role: 'user',
          session: userAuth.data.session,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Check if it's an employee login
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id, user_login, user_password, company_id')
      .eq('user_login', companyName)
      .eq('user_password', password)
      .maybeSingle();

    if (employee) {
      // Create or get employee user account
      const employeeEmail = `employee_${employee.id}@company.local`;
      
      let employeeAuth = await supabaseAuth.auth.signInWithPassword({
        email: employeeEmail,
        password,
      });

      if (employeeAuth.error) {
        // Try to create employee user
        const { data: newEmployeeUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: employeeEmail,
          password,
          email_confirm: true,
        });

        if (createError && createError.message.includes('already been registered')) {
          // Update password for existing user
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = existingUsers.users.find(u => u.email === employeeEmail);
          
          if (foundUser) {
            await supabaseAdmin.auth.admin.updateUserById(foundUser.id, { password });
            
            employeeAuth = await supabaseAuth.auth.signInWithPassword({
              email: employeeEmail,
              password,
            });
            
            if (employeeAuth.error) throw employeeAuth.error;
            
            return new Response(
              JSON.stringify({
                success: true,
                role: 'user',
                session: employeeAuth.data.session,
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            );
          }
        } else if (createError) {
          throw createError;
        } else if (newEmployeeUser) {
          // Create profile and role for new employee user
          await supabaseAdmin.from('profiles').insert({
            id: newEmployeeUser.user.id,
            company_id: employee.company_id,
          });

          await supabaseAdmin.from('user_roles').insert({
            user_id: newEmployeeUser.user.id,
            role: 'user',
            company_id: employee.company_id,
          });
          
          employeeAuth = await supabaseAuth.auth.signInWithPassword({
            email: employeeEmail,
            password,
          });
          
          if (employeeAuth.error) throw employeeAuth.error;
          
          return new Response(
            JSON.stringify({
              success: true,
              role: 'user',
              session: employeeAuth.data.session,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      }

      // Employee signed in successfully
      return new Response(
        JSON.stringify({
          success: true,
          role: 'user',
          session: employeeAuth.data.session,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error('Invalid credentials');
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});