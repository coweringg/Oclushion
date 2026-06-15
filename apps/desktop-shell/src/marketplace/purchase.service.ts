import { logger } from "../utils/logger";
import type { KeyValueStore } from "../persistent-store";
import type { MarketplaceItem } from "./marketplace.types";
import { z } from "zod";

const RECEIPTS_KEY = "ocl_marketplace_receipts";

export type PurchaseReceipt = {
  id: string;
  itemId: string;
  purchasedAt: string;
  pricePaid: number;
  signature: string; // Crypto signature to prevent tampering
};

export class PurchaseService {
  private receipts: PurchaseReceipt[] = [];

  constructor(private readonly kvStore: KeyValueStore) {}

  public async initialize(): Promise<void> {
    try {
      const raw = await this.kvStore.getItem(RECEIPTS_KEY);
      if (raw) {
        const parsed = z.array(z.any()).safeParse(JSON.parse(raw));
        if (parsed.success) {
          this.receipts = parsed.data;
        }
      }
    } catch (err) {
      logger.warn("PurchaseService", "Failed to load receipts", err);
    }
  }

  public async purchaseItem(item: MarketplaceItem): Promise<PurchaseReceipt> {
    logger.info("PurchaseService", `Initiating Stripe checkout for ${item.name} at $${item.priceUsd}`);
    
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const receipt: PurchaseReceipt = {
      id: `rcpt_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      itemId: item.id,
      purchasedAt: new Date().toISOString(),
      pricePaid: item.priceUsd ?? 0,
      signature: this.generateMockSignature(item.id, item.priceUsd ?? 0),
    };

    this.receipts.push(receipt);
    await this.kvStore.setItem(RECEIPTS_KEY, JSON.stringify(this.receipts));
    
    logger.info("PurchaseService", `Purchase successful. Author ${item.author ?? "Unknown"} receives 90% ($${((item.priceUsd ?? 0) * (item.revenueShare ?? 0.9)).toFixed(2)})`);
    return receipt;
  }

  public hasPurchased(itemId: string): boolean {
    return this.receipts.some(r => r.itemId === itemId);
  }

  public getReceipts(): PurchaseReceipt[] {
    return this.receipts;
  }

  private generateMockSignature(itemId: string, price: number): string {
    return `sig_${btoa(itemId + price + "oclushion_secret")}`;
  }
}
