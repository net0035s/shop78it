import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // ตรวจสอบอีเมลของผู้ใช้
  const userEmail = user.emailAddresses[0]?.emailAddress;
  
  // ดึงรายชื่ออีเมลแอดมิน, ตัดช่องว่าง, และแปลงเป็นพิมพ์เล็ก
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(',')
    .map(email => email.trim().toLowerCase());

  // นำอีเมลที่ล็อกอินมาแปลงเป็นพิมพ์เล็กก่อนเช็ค
  const currentUserEmail = (userEmail || "").trim().toLowerCase();
  const isAdmin = adminEmails.includes(currentUserEmail);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f111a] text-white">
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg text-center border border-red-500/30">
          <h1 className="text-2xl font-bold text-red-500 mb-4">⛔ Access Denied</h1>
          <p className="text-gray-300 mb-6">
            อีเมล <span className="font-semibold text-white">{userEmail}</span><br/>
            ไม่มีสิทธิ์เข้าถึงระบบหลังบ้านของ ShopAuto 24/7
          </p>
          <p className="text-sm text-gray-500 mt-4">กรุณาใช้ปุ่มโปรไฟล์บนแถบเมนูด้านบนเพื่อ Sign out</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-textPrimary">
      {children}
    </div>
  )
}
