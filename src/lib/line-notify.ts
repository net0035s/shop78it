/**
 * Utility for sending Line Notify messages
 */

export async function sendLineNotify(message: string) {
  const token = process.env.LINE_NOTIFY_TOKEN

  if (!token) {
    console.warn('LINE_NOTIFY_TOKEN is not configured.')
    return false
  }

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
      body: new URLSearchParams({
        message,
      }),
    })

    const data = await response.json()
    return data.status === 200
  } catch (error) {
    console.error('Error sending Line Notify:', error)
    return false
  }
}
