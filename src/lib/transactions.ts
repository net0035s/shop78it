import { Prisma } from '@prisma/client'
import prisma from './db'

export async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: 'Serializable', timeout: 15000 }) }
    catch (error: any) {
      if (error?.code !== 'P2034' || attempt >= 3) throw error
      await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)))
    }
  }
}
