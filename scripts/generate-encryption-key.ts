import crypto from 'crypto'

const key = crypto.randomBytes(32).toString('hex')

console.log('ENCRYPTION_KEY=')
console.log(key)
console.log('')
console.log('คำเตือน: หากคุณเปลี่ยน ENCRYPTION_KEY ในระบบที่มีข้อมูลถูกเข้ารหัสไว้แล้ว คุณจะไม่สามารถถอดรหัสข้อมูลเก่าได้ (ต้องทำการ Re-encrypt ข้อมูลเดิมก่อนเปลี่ยน)')
