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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, user_password')
      .eq('name', companyName)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    // Try to login as admin first
    const email = `${companyName}@company.local`;
    const { data: adminAuth, error: adminError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!adminError && adminAuth.user) {
      // Get admin role
      const { data: role } = await supabase
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
      // Create temporary session for regular user
      // We need to create or get existing user account
      const userEmail = `${companyName}.user@company.local`;
      
      let userId: string;
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const foundUser = existingUser.users.find(u => u.email === userEmail);

      if (foundUser) {
        userId = foundUser.id;
        // Update password
        await supabase.auth.admin.updateUserById(userId, { password });
      } else {
        // Create user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userEmail,
          password,
          email_confirm: true,
        });

        if (createError) throw createError;
        userId = newUser.user.id;

        // Create profile
        await supabase.from('profiles').insert({
          id: userId,
          company_id: company.id,
        });

        // Create user role
        await supabase.from('user_roles').insert({
          user_id: userId,
          role: 'user',
          company_id: company.id,
        });
      }

      // Sign in as user
      const { data: userAuth, error: userError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (userError) throw userError;

      return new Response(
        JSON.stringify({
          success: true,
          role: 'user',
          session: userAuth.session,
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