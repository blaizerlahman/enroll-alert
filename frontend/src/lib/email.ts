import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

const client = new SESv2Client({ region: process.env.AWS_REGION })
const FROM = process.env.EMAIL_FROM!
const WELCOME_TEMPLATE = process.env.WELCOME_TEMPLATE;

async function sendTemplate(to: string, templateName: string, data: Record<string, unknown> = {}) {
  
  try { 
    const out = await client.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [to] },
        Content: {
          Template: {
            TemplateName: templateName,
            TemplateData: JSON.stringify(data),
          },
        },
      }),
    )
  } catch (err) {
    throw err;
  }
}

export async function sendWelcome(to: string) {
  await sendTemplate(to, WELCOME_TEMPLATE, {})
}

