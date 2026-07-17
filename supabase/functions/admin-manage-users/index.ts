import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { provisionAdminTenant } from "../_shared/tenant-provisioning.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function generateTemporaryPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
}

async function enqueueTemporaryPasswordEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
  tempPassword: string,
  nome?: string | null,
) {
  const safeName = escapeHtml(nome || 'Olá')
  const safePassword = escapeHtml(tempPassword)
  const messageId = crypto.randomUUID()
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; padding: 24px;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Senha provisória</h1>
      <p>${safeName}, recebemos uma solicitação para redefinir sua senha.</p>
      <p>Use a senha provisória abaixo para acessar o sistema:</p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 1px; background: #f3f4f6; padding: 12px 16px; border-radius: 6px; display: inline-block;">${safePassword}</p>
      <p>Ao entrar, você será obrigado a criar uma nova senha.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Se você não solicitou essa alteração, entre em contato com o suporte.</p>
    </div>
  `
  const text = `${nome || 'Olá'}, recebemos uma solicitação para redefinir sua senha. Use esta senha provisória para acessar o sistema: ${tempPassword}. Ao entrar, você será obrigado a criar uma nova senha.`

  const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'temporary_password',
    recipient_email: email,
    status: 'pending',
  })
  if (logError) console.error('Failed to log temporary password email', logError)

  const { error } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: email,
      from: 'Elevare Consultoria <noreply@notify.elevareconsultoria.com>',
      sender_domain: 'notify.elevareconsultoria.com',
      subject: 'Sua senha provisória',
      html,
      text,
      purpose: 'transactional',
      label: 'temporary_password',
      queued_at: new Date().toISOString(),
      idempotency_key: messageId,
      unsubscribe_token: messageId, // Critical: Transactional emails require an unsubscribe_token
    },
  })

  if (error) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'temporary_password',
      recipient_email: email,
      status: 'failed',
      error_message: error.message,
    })
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Error parsing request body:', e);
      throw new Error('Invalid JSON body');
    }
    
    console.log('Request received body:', body)
    const { action, userData, queueId } = body

    const authHeader = req.headers.get('Authorization')
    let isAuthorized = false
    let isSuperAdmin = false
    let callerEmpresaId: string | null = null

    // Skip auth check for forgot_password
    if (action !== 'forgot_password') {
      if (!authHeader) {
        console.warn('No Authorization header for protected action')
        throw new Error('Unauthorized: Missing token')
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

      if (userError) {
        console.error('Auth error:', userError)
        throw new Error(`Unauthorized: ${userError.message}`)
      }

      if (user) {
        console.log('User identified:', user.id)
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('perfil, empresa_id')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
        }

        console.log('User profile:', profile)
        if (profile?.perfil === 'admin' || profile?.perfil === 'consultor') {
          isAuthorized = true
        }
        if (profile?.perfil === 'super_admin') {
          isAuthorized = true
          isSuperAdmin = true
        }
        callerEmpresaId = profile?.empresa_id ?? null
      } else {
        console.warn('No user found for token')
      }
    } else if (action !== 'forgot_password') {
      console.warn('No Authorization header for protected action')
    }

    // Internal system actions or admin actions
    if (action === 'create_client' || action === 'create') {
      if (!isAuthorized) throw new Error('Unauthorized')
      if (!callerEmpresaId) throw new Error('Usuário autenticado não possui empresa associada')

      const { email, password, nome, perfil, cnpj } = userData

      // 1. Create user in Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, perfil, cnpj, force_password_change: perfil === 'consultor' }
      })

      if (authError) {
        if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
          // If user exists, try to update profile if it's a client
          const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers()
          const user = allUsers.find(u => u.email === email)

          if (user) {
            // Se o perfil for cliente, atualiza o CNPJ
            if (perfil === 'cliente') {
              await supabaseAdmin.from('profiles').update({ cnpj, perfil: 'cliente' }).eq('id', user.id)
            }

            if (queueId) {
              await supabaseAdmin.from('client_user_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId)
            }

            return new Response(JSON.stringify({
              message: 'User already exists, updated profile',
              user: user,
              alreadyExists: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            })
          }
        }
        throw authError
      }

      // 2. Create (or replace) the profile row — no DB trigger creates it automatically
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authUser.user.id,
          nome,
          email,
          perfil,
          empresa_id: callerEmpresaId,
          cnpj: perfil === 'cliente' ? cnpj : null,
          force_password_change: perfil === 'consultor',
          ativo: true,
        })

      if (upsertError) throw upsertError

      if (queueId) {
        await supabaseAdmin.from('client_user_queue').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', queueId)
      }

      return new Response(JSON.stringify({ user: authUser.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'create_empresa') {
      if (!isSuperAdmin) throw new Error('Unauthorized: apenas super_admin pode cadastrar novas empresas')

      const { empresaNome, empresaCnpj, plano, adminNome, adminEmail, adminPassword } = userData
      if (!empresaNome || !adminNome || !adminEmail) {
        throw new Error('Dados obrigatórios: empresaNome, adminNome, adminEmail')
      }

      const finalPassword = adminPassword || generateTemporaryPassword()

      // 1. Cria o usuário Auth primeiro — provision_tenant() exige que o
      // owner já exista em auth.users antes de rodar.
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { nome: adminNome, perfil: 'admin' },
      })
      if (authError) throw authError

      // 2. Provisiona empresa+profile+configuracoes atomicamente — mesma
      // camada compartilhada usada pelo cadastro público, mas com
      // plano/status vindos do formulário administrativo (não hardcoded
      // trial). Se falhar, o usuário Auth recém-criado é removido (evita
      // órfão).
      const provisioned = await provisionAdminTenant(supabaseAdmin, {
        ownerId: authUser.user.id,
        ownerEmail: adminEmail,
        empresaNome,
        ownerNome: adminNome,
        whatsapp: '',
        plano: plano || 'trial',
        status: 'ativo',
        origem: { via: 'admin-manage-users' },
      })

      if (provisioned.status !== 'created' && provisioned.status !== 'already_provisioned') {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        throw new Error('Não foi possível provisionar a empresa (estado inconsistente).')
      }

      if (empresaCnpj) {
        await supabaseAdmin.from('empresas').update({ cnpj: empresaCnpj }).eq('id', provisioned.empresaId)
      }
      // force_password_change: diferente do signup público (usuário
      // escolhe a própria senha), aqui o super admin define uma senha
      // temporária que precisa ser trocada no primeiro login.
      await supabaseAdmin.from('profiles').update({ force_password_change: true }).eq('id', authUser.user.id)

      try {
        await enqueueTemporaryPasswordEmail(supabaseAdmin, adminEmail, finalPassword, adminNome)
      } catch (e) {
        console.error('Failed to send onboarding email', e)
      }

      const { data: empresa } = await supabaseAdmin.from('empresas').select('*').eq('id', provisioned.empresaId).single()

      return new Response(JSON.stringify({ empresa, adminUser: authUser.user, tempPassword: finalPassword }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'list_with_auth') {
      if (!isAuthorized) throw new Error('Unauthorized')

      const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers()
      if (authError) throw authError

      let profilesQuery = supabaseAdmin.from('profiles').select('*')
      if (!isSuperAdmin) {
        profilesQuery = profilesQuery.eq('empresa_id', callerEmpresaId)
      }
      const { data: profiles, error: profError } = await profilesQuery

      if (profError) throw profError

      const merged = profiles.map(p => {
        const authUser = users.find(u => u.id === p.id)
        return {
          ...p,
          last_login: authUser?.last_sign_in_at || p.ultimo_acesso
        }
      })

      return new Response(JSON.stringify({ users: merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'reset_password') {
      if (!isAuthorized) throw new Error('Unauthorized')
      const { userId } = userData
      
      const tempPassword = generateTemporaryPassword()
      
      console.log(`Resetting password for user ${userId}`)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: tempPassword }
      )
      
      if (authError) {
        console.error('Auth update error:', authError)
        throw authError
      }
      
      // Update profile to force password change
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          force_password_change: true,
        })
        .eq('id', userId)
        
      if (updateError) {
        console.error('Profile update error:', updateError)
        throw updateError
      }

      // Try to send email with temporary password
      try {
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, nome')
          .eq('id', userId)
          .single()

        if (userProfile?.email) {
          await enqueueTemporaryPasswordEmail(supabaseAdmin, userProfile.email, tempPassword, userProfile.nome)
        }
      } catch (e) {
        console.error('Error fetching profile for email log:', e)
      }
      
      return new Response(JSON.stringify({ message: 'Senha redefinida com sucesso', tempPassword }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'forgot_password') {
      const { email } = userData
      if (!email) throw new Error('E-mail é obrigatório')

      // 1. Find user by email
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) throw listError
      
      const authUser = users.users.find(u => u.email === email)
      if (!authUser) {
        // Return 200 for security but don't do anything
        return new Response(JSON.stringify({ message: 'Se o e-mail existir no sistema, uma nova senha foi enviada.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // 2. Generate temp password
      const tempPassword = generateTemporaryPassword()
      
      // 3. Update Auth password
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { password: tempPassword }
      )
      if (authError) throw authError

      // 4. Update Profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          force_password_change: true,
        })
        .eq('id', authUser.id)
      if (updateError) throw updateError

      // 5. Send email with the temporary password
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('nome')
        .eq('id', authUser.id)
        .maybeSingle()
      await enqueueTemporaryPasswordEmail(supabaseAdmin, email, tempPassword, userProfile?.nome)

      return new Response(JSON.stringify({ message: 'E-mail enviado com a senha temporária.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    throw new Error('Invalid action or unauthorized')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
