import * as fs from 'fs';
import * as path from 'path';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const PDF_PATH = path.resolve(__dirname, '../output/mockups/test-dental/Sunrise-Dental-Clinic-Proposal.pdf');

async function main() {
  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const pdfBase64 = pdfBuffer.toString('base64');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SmartFlow Dev <onboarding@resend.dev>',
      to: ['kapusicsgo@gmail.com'],
      subject: 'AI chatbot for Sunrise Dental Clinic?',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
          <p>Hi,</p>
          <p>I help dental practices add AI chatbots that answer patient questions and book appointments 24/7.</p>
          <p>I put together a quick concept for <strong>Sunrise Dental Clinic</strong> — attached as a PDF.</p>
          <p>If it looks interesting, I can have it live on your site within 48 hours.</p>
          <p>Cheers,<br>Geri<br><a href="https://smartflowdev.com" style="color: #667eea;">smartflowdev.com</a></p>
        </div>
      `,
      attachments: [
        {
          filename: 'Sunrise-Dental-Clinic-AI-Chatbot-Proposal.pdf',
          content: pdfBase64,
        },
      ],
    }),
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
