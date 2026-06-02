'use client'

import { useLanguage } from '@/lib/i18n'

export function Translate({ tKey }: { tKey: string }) {
  const { t, language } = useLanguage()
  
  // By returning a span or fragment with the key, we ensure it updates when language changes.
  // We use `key={language}` (if needed) but React Context handles the re-render automatically.
  return <>{t(tKey)}</>
}
