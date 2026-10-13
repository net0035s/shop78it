import prisma from './db'
import { adminOrderInclude, adminOrderData } from './admin-orders'
import { CommerceError } from './commerce-rules'
export async function listAdminOrders(params: URLSearchParams) {
 const page=Number(params.get('page')||1),limit=Number(params.get('limit')||20)
 if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new CommerceError('เลขหน้าหรือจำนวนรายการไม่ถูกต้อง')
 const search=(params.get('search')||'').trim().slice(0,254),status=params.get('status')
 const where={...(status&&status!=='all'&&{status}),...(search&&{OR:[{orderNumber:{contains:search,mode:'insensitive' as const}},{customerEmail:{contains:search,mode:'insensitive' as const}}]})}
 const [orders,total,manualDeliveryOrders,actionableOrders]=await prisma.$transaction([
  prisma.order.findMany({where,include:adminOrderInclude,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*limit,take:limit}),
  prisma.order.count({where}),
  prisma.order.count({where:{status:'needs_manual_delivery'}}),
  prisma.order.count({where:{status:{in:['needs_manual_delivery','payment_review','paid','fulfilling']}}}),
 ])
 return {data:orders.map(adminOrderData),total,page,totalPages:Math.max(1,Math.ceil(total/limit)),summary:{manualDeliveryOrders,actionableOrders}}
}
