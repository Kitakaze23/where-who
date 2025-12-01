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

    // Validate company name (only Latin characters)
    if (!/^[a-zA-Z0-9_-]+$/.test(companyName)) {
      throw new Error('Company name must contain only Latin characters, numbers, dashes and underscores');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if company already exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .single();

    if (existingCompany) {
      throw new Error('Company already exists');
    }

    // Create auth user with company name as email
    const email = `${companyName}@company.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // Create company with default user password
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        user_password: Math.random().toString(36).slice(-8), // Generate random password
      })
      .select()
      .single();

    if (companyError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw companyError;
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        company_id: company.id,
      });

    if (profileError) {
      // Rollback
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('companies').delete().eq('id', company.id);
      throw profileError;
    }

    // Create admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
        company_id: company.id,
      });

    if (roleError) {
      // Rollback
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('companies').delete().eq('id', company.id);
      throw roleError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin registered successfully',
        companyName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
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