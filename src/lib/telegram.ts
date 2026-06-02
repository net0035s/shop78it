/**
 * Utility for sending Telegram Bot messages to admin chat
 * Docs: https://core.telegram.org/bots/api#sendmessage
 */

export async function sendTelegramNotify(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.')
    return false
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          // parse_mode removed — plain text is safest (avoids MarkdownV2 escaping issues)
        }),
      }
    )

    const data = await res.json()

    if (!data.ok) {
      console.error('Telegram API error:', data.description)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending Telegram notification:', error)
    return false
  }
}
