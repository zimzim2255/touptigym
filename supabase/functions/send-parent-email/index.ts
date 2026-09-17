import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
    const { to, parentName } = await req.json()

    if (!to) {
      return new Response(JSON.stringify({ error: 'Email recipient is required' }), { status: 400, headers })
    }

    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const smtpUser = Deno.env.get('SMTP_USER') || ''
    const smtpPass = Deno.env.get('SMTP_PASS') || ''
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || smtpUser

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f9f9f9; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #fff5f9; padding: 30px; text-align: center; }
    .header img { max-height: 200px; width: auto; }
    .body { padding: 30px; }
    .body h2 { color: #333; margin-top: 0; }
    .body p { color: #555; line-height: 1.6; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://lpjdpcguplkpdfgxomps.supabase.co/storage/v1/object/public/logo/logo.png" alt="Toupti Gym" />
    </div>
    <div class="body">
      <h2>Bienvenue à Toupti Gym${parentName ? `, ${parentName}` : ''} !</h2>
      <p>Votre compte parent a été créé avec succès dans notre système.</p>
      <p>Vous recevrez prochainement une confirmation par email lorsque l'abonnement de votre enfant sera enregistré.</p>
      <p>Pour toute question ou information complémentaire, n'hésitez pas à nous contacter.</p>
      <p>Sportivement,<br><strong>L'équipe Toupti Gym</strong></p>
    </div>
    <div class="footer">
      <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
      <p>&copy; ${new Date().getFullYear()} Toupti Gym. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`

    const text = `Bienvenue à Toupti Gym${parentName ? `, ${parentName}` : ''} !

Votre compte parent a été créé avec succès dans notre système.

Vous recevrez une confirmation par email lorsque l'abonnement de votre enfant sera enregistré.

Pour toute question, n'hésitez pas à nous contacter.

Sportivement, L'équipe Toupti Gym`

    const info = await transporter.sendMail({
      from: `"Toupti Gym" <${fromEmail}>`,
      to,
      subject: 'Bienvenue à Toupti Gym - Compte parent créé !',
      html,
      text,
    })

    console.log('Email sent:', info.messageId)

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), { status: 200, headers })
  } catch (err: any) {
    console.error('Failed to send email:', err)
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers })
  }
}

serve(handler)