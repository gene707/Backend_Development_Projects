import nodemailer from 'nodemailer';

let transporter = null;

// Initialize mail transporter
export async function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    // Custom configured SMTP server
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
    console.log(`[EmailService] Using configured SMTP host: ${SMTP_HOST}`);
  } else {
    // Fallback: Create ethereal test account for zero-config demonstration
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[EmailService] Created Ethereal test account: ${testAccount.user}`);
    } catch {
      // If network fails to reach Ethereal, use jsonTransport for robust offline simulation
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      console.log('[EmailService] Using JSON transport fallback for local verification');
    }
  }

  return transporter;
}

// Send email forwarding the contact submission
export async function sendContactEmail(submission) {
  const mailer = await getTransporter();
  const recipient = process.env.RECIPIENT_EMAIL || 'contact-recipient@example.com';
  const fromEmail = process.env.SENDER_EMAIL || '"Contact System" <no-reply@example.com>';

  const mailOptions = {
    from: fromEmail,
    to: recipient,
    replyTo: submission.email,
    subject: `[New Inquiry] ${submission.subject} from ${submission.name}`,
    text: `
You have received a new contact submission:

Name: ${submission.name}
Email: ${submission.email}
Phone: ${submission.phone || 'N/A'}
Subject: ${submission.subject}
Submitted At: ${submission.submittedAt}

Message:
----------------------------------------
${submission.message}
----------------------------------------
    `,
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
  <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">New Contact Submission</h2>
  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
    <tr><td style="padding: 6px; font-weight: bold; width: 120px;">Name:</td><td>${submission.name}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">Email:</td><td><a href="mailto:${submission.email}">${submission.email}</a></td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">Phone:</td><td>${submission.phone || 'Not provided'}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">Subject:</td><td>${submission.subject}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">Date:</td><td>${submission.submittedAt}</td></tr>
  </table>
  <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #1e293b;">Message:</h4>
    <p style="white-space: pre-wrap; margin: 0; color: #334155;">${submission.message}</p>
  </div>
</div>
    `
  };

  try {
    const info = await mailer.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl,
      recipient: recipient
    };
  } catch (err) {
    console.error('[EmailService] Error dispatching email:', err);
    return {
      success: false,
      error: err.message
    };
  }
}
