import { donors, type Donor, type InsertDonor } from "@shared/schema";
import { db } from "./db";
import { eq, lte, and, sql } from "drizzle-orm";
import { subMonths } from "date-fns";

export interface IStorage {
  createDonor(donor: InsertDonor & { userId: string }): Promise<Donor>;
  getDonors(filters?: { bloodGroup?: string; userType?: "donor" | "receiver" }): Promise<Donor[]>;
  getDonorByUserId(userId: string): Promise<Donor | undefined>;
  updateDonor(userId: string, donor: Partial<InsertDonor>): Promise<Donor | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createDonor(insertDonor: InsertDonor & { userId: string }): Promise<Donor> {
    const [donor] = await db.insert(donors).values(insertDonor).returning();
    return donor;
  }

  async getDonors(filters?: { bloodGroup?: string; userType?: "donor" | "receiver" }): Promise<Donor[]> {
    const threeMonthsAgo = subMonths(new Date(), 3);

    // Convert JS date to SQL string or comparison
    // Actually, drizzle handles date objects fine if column is 'date' or 'timestamp'
    // But for 'date' column type, it might expect string 'YYYY-MM-DD'.
    // Let's use SQL operator for safety or just pass the Date object.

    let conditions = [];

    // Filter by userType if provided, default only show 'donor' in public list usually? 
    // The requirement says "Only those peoples details should be shown who has not donated blood before 3 month".
    // This implies we are listing donors.
    // If userType is 'receiver', maybe they don't have a 'lastDonationDate' that matters, or we just show them.
    // Let's assume the public list is for DONORS.

    // We will show donors who are ELIGIBLE.
    // Eligible means: lastDonationDate <= 3 months ago.

    if (filters?.bloodGroup) {
      conditions.push(eq(donors.bloodGroup, filters.bloodGroup));
    }

    if (filters?.userType) {
      conditions.push(eq(donors.userType, filters.userType));
    }

    // "Only those peoples details should be shown who has not donated blood before 3 month"
    // This phrasing is tricky. "not donated before 3 month".
    // "Has not donated blood [in the last] 3 months"? 
    // If I donated 1 month ago, I should NOT be shown.
    // If I donated 4 months ago, I SHOULD be shown.
    // So `lastDonationDate` < `threeMonthsAgo`.

    conditions.push(lte(donors.lastDonationDate, threeMonthsAgo.toISOString().split('T')[0]));

    if (conditions.length === 0) {
      return await db.select().from(donors);
    }

    return await db.select().from(donors).where(and(...conditions));
  }

  async getDonorByUserId(userId: string): Promise<Donor | undefined> {
    const [donor] = await db.select().from(donors).where(eq(donors.userId, userId));
    return donor;
  }

  async updateDonor(userId: string, updateData: Partial<InsertDonor>): Promise<Donor | undefined> {
    const [updated] = await db
      .update(donors)
      .set(updateData)
      .where(eq(donors.userId, userId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
