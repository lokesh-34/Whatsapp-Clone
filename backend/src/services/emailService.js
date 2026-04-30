const nodemailer = require('nodemailer')

const isEmailConfigured = () =>
  !!(process.env.EMAIL_USER &&
     process.env.EMAIL_PASS &&
     !process.env.EMAIL_USER.includes('your_gmail') &&
     !process.env.EMAIL_PASS.includes('your_16char'))

let _transporter = null
function getTransporter() {
  if (_transporter) return _transporter
  // Use port 587 + STARTTLS (works on most networks, unlike port 465 which is often blocked)
  _transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,           // STARTTLS — NOT SSL
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
  })
  return _transporter
}

async function sendOtpEmail(to, otp) {
  const expiresMin = process.env.OTP_EXPIRES_MINUTES || 10

  // Dev fallback — log to console when email not configured
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_USER and EMAIL_PASS must be configured in production.')
    }
    console.log('\n' + '═'.repeat(52))
    console.log('  📧  OTP EMAIL (dev mode — not actually sent)')
    console.log('  To:  ' + to)
    console.log('  OTP: ' + otp)
    console.log('  Expires in: ' + expiresMin + ' minutes')
    console.log('═'.repeat(52) + '\n')
    return
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Your WhatsApp OTP</title></head>
<body style="margin:0;padding:0;background:#0B141A;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B141A;min-height:100vh;">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#202C33;border-radius:16px;border:1px solid #222D34;overflow:hidden;max-width:480px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#005C4B,#00A884);padding:32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">💬</div>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">WhatsApp Clone</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:14px;">Email Verification</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 36px;">
            <p style="margin:0 0 24px;color:#E9EDEF;font-size:14px;line-height:1.6;">
              Use the code below to verify your email and complete account creation.
            </p>
            <div style="background:#111B21;border:1.5px solid #00A884;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <div style="letter-spacing:16px;font-size:38px;font-weight:800;color:#00A884;font-family:'Courier New',monospace;">
                ${otp}
              </div>
            </div>
            <div style="background:rgba(0,168,132,.08);border:1px solid rgba(0,168,132,.2);border-radius:8px;padding:12px 16px;margin-bottom:24px;">
              <span style="color:#8696A0;font-size:13px;">
                ⏱ Expires in <strong style="color:#E9EDEF;">${expiresMin} minutes</strong>. Do not share this code.
              </span>
            </div>
            <p style="margin:0;color:#667781;font-size:13px;line-height:1.6;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#111B21;padding:20px 36px;text-align:center;border-top:1px solid #222D34;">
            <p style="margin:0;color:#667781;font-size:12px;">🔒 End-to-end encrypted · WhatsApp Web Clone</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await getTransporter().sendMail({
    from: `"WhatsApp Clone" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${otp} is your WhatsApp verification code`,
    html,
    text: `Your WhatsApp verification code is: ${otp}\nExpires in ${expiresMin} minutes.\nDo not share this code.`,
  })
}

module.exports = { sendOtpEmail, isEmailConfigured }
