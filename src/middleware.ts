import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// กำหนดว่า path ไหนบ้างที่ต้องโดนล็อก
const isProtectedRoute = createRouteMatcher(["/admin11(.*)", "/api/admin(.*)"]);
const isAdminApiRoute = createRouteMatcher(["/api/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // ดึงข้อมูล User ออกมาเช็ค
    const { userId } = await auth(); 
    
    if (!userId) {
      if (isAdminApiRoute(req)) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }

      // ถ้าไม่มี userId (ยังไม่ล็อกอิน) ให้เตะไปหน้า Sign-in
      const signInUrl = new URL('/sign-in', req.url);
      return NextResponse.redirect(signInUrl);
    }

    if (isAdminApiRoute(req)) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const userEmail = user.emailAddresses[0]?.emailAddress?.trim().toLowerCase();
      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      if (!userEmail || !adminEmails.includes(userEmail)) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }
  }
});

export const config = {
  matcher: [
    // ข้ามไฟล์ระบบและไฟล์ static ต่างๆ
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // ให้ทำงานเสมอสำหรับ API routes
    '/(api|trpc)(.*)',
  ],
};
