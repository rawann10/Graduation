const nodemailer = require('nodemailer');

function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

async function sendWelcomeEmail(toEmail, fullName) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  EMAIL_USER or EMAIL_PASS not set — skipping welcome email');
        return;
    }

    const displayName = fullName || toEmail.split('@')[0];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to LawGic</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(45,74,119,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2D4A77 0%,#55A6A0 100%);padding:40px 40px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;">
                    <span style="font-size:28px;vertical-align:middle;">⚖️</span>
                    <span style="font-size:24px;font-weight:800;color:#ffffff;vertical-align:middle;margin-left:8px;letter-spacing:-0.5px;">LawGic</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Welcome to LawGic!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.82);font-size:15px;">Your AI-powered legal contract analyzer</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">
                Hi <strong style="color:#2D4A77;">${displayName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
                Your account is ready. LawGic helps you analyze Egyptian sports and commercial contracts in seconds — spotting risky clauses, mapping legal references, and scoring your documents against local law.
              </p>

              <!-- Feature list -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#2D4A77;text-transform:uppercase;letter-spacing:0.08em;">What you can do</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="padding:5px 0;font-size:14px;color:#475569;"><span style="color:#55A6A0;font-weight:700;margin-right:8px;">✓</span>Upload PDF, Word, or image contracts</td></tr>
                    <tr><td style="padding:5px 0;font-size:14px;color:#475569;"><span style="color:#55A6A0;font-weight:700;margin-right:8px;">✓</span>Get instant risk scoring (0–100)</td></tr>
                    <tr><td style="padding:5px 0;font-size:14px;color:#475569;"><span style="color:#55A6A0;font-weight:700;margin-right:8px;">✓</span>See matched Egyptian law articles</td></tr>
                    <tr><td style="padding:5px 0;font-size:14px;color:#475569;"><span style="color:#55A6A0;font-weight:700;margin-right:8px;">✓</span>Ask questions about your contract</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
                Ready to get started? Open the app and upload your first contract.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:linear-gradient(135deg,#55A6A0,#2D4A77);border-radius:10px;">
                    <a href="#" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">Analyze Your First Contract →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
                © 2026 LawGic · AI-powered contract analysis<br/>
                This email was sent to ${toEmail} because you just created an account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const transporter = createTransporter();
    await transporter.sendMail({
        from: `"LawGic" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: '👋 Welcome to LawGic — Your account is ready',
        html
    });

    console.log(`✅ Welcome email sent to ${toEmail}`);
}

module.exports = { sendWelcomeEmail };
