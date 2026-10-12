export function supportContact() {
  const line = process.env.NEXT_PUBLIC_LINE_URL || ''
  let lineUrl = ''
  try {
    const url = new URL(line)
    if (url.protocol === 'https:' && !url.username && !url.password) lineUrl = url.toString()
  } catch { /* Contact remains unavailable until configured. */ }
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || ''
  const emailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
  return { lineUrl, emailAddress, href: lineUrl || (emailAddress ? 'mailto:' + emailAddress : '/help') }
}
