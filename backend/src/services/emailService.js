const nodemailer = require('nodemailer')

// Reuse the same transport across requests (connection pool)
let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  return _transporter
}

/**
 * Sends a 6-digit OTP email with a styled HTML template.
 * @param {string} to  – recipient email
 * @param {string} otp – 6-digit code
 */
async function sendOtpEmail(to, otp) {
  const expiresMin = process.env.OTP_EXPIRES_MINUTES || 10

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Your WhatsApp OTP</title>
</head>
<body style="margin:0;padding:0;background:#0B141A;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B141A;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#202C33;border-radius:16px;border:1px solid #222D34;overflow:hidden;max-width:480px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#005C4B 0%,#00A884 100%);padding:32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">💬</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                WhatsApp Clone
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:14px;">
                Email Verification
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px;">
              <p style="margin:0 0 8px;color:#8696A0;font-size:14px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">
                Your verification code
              </p>
              <p style="margin:0 0 28px;color:#E9EDEF;font-size:14px;line-height:1.6;">
                Use the code below to verify your email address and complete your account creation.
              </p>

              <!-- OTP Box -->
              <div style="background:#111B21;border:1.5px solid #00A884;border-radius:12px;
                          padding:24px;text-align:center;margin-bottom:28px;">
                <div style="letter-spacing:18px;font-size:38px;font-weight:800;
                            color:#00A884;font-variant-numeric:tabular-nums;
                            font-family:'Courier New',monospace;">
                  ${otp}
                </div>
              </div>

              <!-- Expiry notice -->
              <div style="background:rgba(0,168,132,.08);border:1px solid rgba(0,168,132,.2);
                          border-radius:8px;padding:12px 16px;margin-bottom:28px;display:flex;align-items:center;">
                <span style="font-size:18px;margin-right:10px;">⏱</span>
                <span style="color:#8696A0;font-size:13px;">
                  This code expires in <strong style="color:#E9EDEF;">${expiresMin} minutes</strong>.
                  Do not share it with anyone.
                </span>
              </div>

              <p style="margin:0;color:#667781;font-size:13px;line-height:1.6;">
                If you didn't request this code, you can safely ignore this email.
                Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111B21;padding:20px 36px;text-align:center;
                       border-top:1px solid #222D34;">
              <p style="margin:0;color:#667781;font-size:12px;">
                🔒&nbsp; End-to-end encrypted &nbsp;·&nbsp; WhatsApp Web Clone
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  await getTransporter().sendMail({
    from: `"WhatsApp Clone" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${otp} is your WhatsApp verification code`,
    html,
    text: `Your WhatsApp verification code is: ${otp}\nIt expires in ${expiresMin} minutes.\nDo not share this code with anyone.`,
  })
}

module.exports = { sendOtpEmail }
