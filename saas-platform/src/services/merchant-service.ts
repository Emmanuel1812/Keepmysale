import type { SupabaseClient } from "@supabase/supabase-js";
import type { IMerchant, IMerchantCreate, IMerchantUpdate } from "@/types";
import { MerchantsDal } from "@/dal/merchants";

export class MerchantService {
  private readonly merchantsDal: MerchantsDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.merchantsDal = new MerchantsDal(supabase);
  }

  findById(id: string): Promise<IMerchant | null> {
    return this.merchantsDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<IMerchant[]> {
    return this.merchantsDal.findByMerchant(merchantId);
  }

  findByUserId(supabaseUserId: string): Promise<IMerchant | null> {
    return this.merchantsDal.findByUserId(supabaseUserId);
  }

  findByShopDomain(shopDomain: string): Promise<IMerchant | null> {
    return this.merchantsDal.findByShopDomain(shopDomain);
  }

  create(input: IMerchantCreate): Promise<IMerchant> {
    return this.merchantsDal.create(input);
  }

  update(id: string, input: IMerchantUpdate): Promise<IMerchant> {
    return this.merchantsDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.merchantsDal.delete(id);
  }
}
