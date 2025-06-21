import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

const client = new SESv2Client({ region: process.env.AWS_REGION })
const FROM = process.env.EMAIL_FROM as string

async function send(to: string, subject: string, html: string, text: string) {
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: html },
            Text: { Data: text },
          },
        },
      },
    }),
  )
}

export async function sendWelcome(to: string) {
  await send(
    to,
    'Welcome to EnrollAlert',
    '<p>Thanks for joining EnrollAlert. We will email you when seats open.</p>',
    'Thanks for joining EnrollAlert. We will email you when seats open.',
  )
}

