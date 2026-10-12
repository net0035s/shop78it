import crypto from 'crypto'

const key = crypto.randomBytes(32).toString('hex')
const shouldShow = process.argv.includes('--show')

console.log('Generated a new 32-byte encryption key.')
console.log('The key is hidden by default to avoid leaking secrets into logs.')

if (shouldShow) {
  console.log('')
  console.log('ENCRYPTION_KEY=')
  console.log(key)
}

console.log('')
console.log(
  'คำเตือน: หากคุณเปลี่ยน ENCRYPTION_KEY ในระบบที่มีข้อมูลถูกเข้ารหัสไว้แล้ว คุณจะไม่สามารถถอดรหัสข้อมูลเก่าได้ ต้องหมุนคีย์หรือ Re-encrypt ข้อมูลเดิมก่อนเปลี่ยน'
)
console.log('เมื่อต้องการแสดงคีย์บนเครื่องของคุณเอง ให้รัน: npx tsx scripts/generate-encryption-key.ts --show')
