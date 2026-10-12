type ClerkIdentity = {
  primaryEmailAddressId: string | null
  emailAddresses: Array<{ id: string; emailAddress: string; verification: { status: string } | null }>
}
export function verifiedAdminEmail(user: ClerkIdentity, allowed: string): string {
  const primary = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)
  if (!primary || primary.verification?.status !== 'verified') return ''
  const email = primary.emailAddress.trim().toLowerCase()
  return allowed.split(',').some(value => value.trim().toLowerCase() === email) ? email : ''
}
