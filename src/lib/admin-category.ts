import { transaction } from './transactions'
export async function updateCategory(id:string,data:{name:string;slug:string;icon?:string;color?:string;sortOrder?:number;isActive?:boolean}) {
 return transaction(async tx=>{
  const old=await tx.category.findUniqueOrThrow({where:{id}})
  const category=await tx.category.update({where:{id},data})
  await tx.product.updateMany({where:{OR:[{categoryId:id},{category:old.slug}]},data:{category:category.slug,categoryId:id}})
  return category
 })
}
