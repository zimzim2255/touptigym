import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import nodemailer from 'npm:nodemailer@6.9.14'

const handler = async (req: Request): Promise<Response> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const smtpUser = Deno.env.get('SMTP_USER') || ''
    const smtpPass = Deno.env.get('SMTP_PASS') || ''
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || smtpUser

    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()

    // Find children whose birthday is today
    const { data: children, error: childError } = await supabase
      .from('children')
      .select('id, name, birth_date')
      .gte('birth_date', '1900-01-01')

    if (childError) {
      return new Response(JSON.stringify({ error: childError.message }), { status: 500, headers })
    }

    const birthdayChildren = (children || []).filter((child: any) => {
      if (!child.birth_date) return false
      const bd = new Date(child.birth_date)
      return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay
    })

    if (birthdayChildren.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No birthdays today' }), { status: 200, headers })
    }

    // Check which birthday emails have already been sent today
    const todayStr = today.toISOString().split('T')[0]
    const childIds = birthdayChildren.map((c: any) => c.id)

    const { data: alreadySent } = await supabase
      .from('birthday_email_sent')
      .select('child_id')
      .eq('sent_date', todayStr)
      .in('child_id', childIds)

    const sentChildIds = new Set((alreadySent || []).map((s: any) => s.child_id))
    const unsentChildren = birthdayChildren.filter((c: any) => !sentChildIds.has(c.id))

    if (unsentChildren.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'All birthday emails already sent today' }), { status: 200, headers })
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    let totalSent = 0

    for (const child of unsentChildren) {
      let childSent = 0

      // Get parents linked to this child via parent_children
      const { data: parentLinks } = await supabase
        .from('parent_children')
        .select('parent_id')
        .eq('child_id', child.id)

      let parentIds: string[] = (parentLinks || []).map((p: any) => p.parent_id)

      // Also check subscriptions for parent_id
      if (parentIds.length === 0) {
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('parent_id')
          .eq('child_id', child.id)
          .not('parent_id', 'is', 'null')
        parentIds = (subs || []).map((s: any) => s.parent_id).filter(Boolean)
      }

      parentIds = [...new Set(parentIds)]

      const parents: { name: string; email: string }[] = []
      for (const pid of parentIds) {
        const { data: p } = await supabase.from('parents').select('name, email').eq('id', pid).single()
        if (p?.email) parents.push(p)
      }

      for (const parent of parents) {
        try {
          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f9f9f9; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #fffcfd; padding: 30px; text-align: center; }
    .header img { max-height: 200px; width: auto; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; margin-top: 10px; }
    .body { padding: 30px; text-align: center; }
    .body h2 { color: #333; }
    .body p { color: #555; line-height: 1.6; font-size: 16px; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://atvdorphwnpzhobvfmtz.supabase.co/storage/v1/object/public/logo/logo.png" alt="Toupti Gym" />
      <h1>🎂 Joyeux Anniversaire !</h1>
    </div>
    <div class="body">
      <h2>Cher ${parent.name || 'Parent'},</h2>
      <p>Aujourd'hui est un jour special !</p>
      <p><strong>${child.name}</strong> fete son anniversaire aujourd'hui !</p>
      <p>Toute l'equipe de <strong>Toupti Gym</strong> souhaite un merveilleux anniversaire a ${child.name}.</p>
      <p>Sportivement,<br><strong>L'equipe Toupti Gym</strong></p>
    </div>
    <div class="footer">
      <p>Cet email a ete envoye automatiquement.</p>
      <p>&copy; ${today.getFullYear()} Toupti Gym.</p>
    </div>
  </div>
</body>
</html>`

          await transporter.sendMail({
            from: `"Toupti Gym" <${fromEmail}>`,
            to: parent.email,
            subject: `Joyeux Anniversaire ${child.name} ! - Toupti Gym`,
            html,
          })

          childSent++
        } catch (emailErr) {
          console.error(`Failed to send birthday email for child ${child.id} to ${parent.email}:`, emailErr)
        }
      }

      // Only log if we actually sent at least one email for this child
      if (childSent > 0) {
        await supabase.from('birthday_email_sent').insert({
          child_id: child.id,
          sent_date: todayStr,
        })
        totalSent += childSent
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      total_birthdays: birthdayChildren.length,
      already_sent: birthdayChildren.length - unsentChildren.length,
    }), { status: 200, headers })
  } catch (err: any) {
    console.error('Failed to process birthday emails:', err)
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers })
  }
}

serve(handler)