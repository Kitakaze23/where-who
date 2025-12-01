import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, newPassword } = await req.json();

    if (!companyName || !newPassword) {
      throw new Error('Company name and new password are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    // Get admin user
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('company_id', company.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !adminRole) {
      throw new Error('Admin user not found');
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminRole.user_id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin password updated successfully',
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
