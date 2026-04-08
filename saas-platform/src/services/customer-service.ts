import type { SupabaseClient } from "@supabase/supabase-js";
import type { ICustomer, ICustomerCreate, ICustomerUpdate } from "@/types";
import { CustomersDal } from "@/dal/customers";

export class CustomerService {
  private readonly customersDal: CustomersDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.customersDal = new CustomersDal(supabase);
  }

  findById(id: string): Promise<ICustomer | null> {
    return this.customersDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<ICustomer[]> {
    return this.customersDal.findByMerchant(merchantId);
  }

  create(input: ICustomerCreate): Promise<ICustomer> {
    return this.customersDal.create(input);
  }

  update(id: string, input: ICustomerUpdate): Promise<ICustomer> {
    return this.customersDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.customersDal.delete(id);
  }

  findOrCreate(input: ICustomerCreate): Promise<ICustomer> {
    return this.customersDal.findOrCreate(input);
  }

  resolveCustomer(input: ICustomerCreate): Promise<ICustomer> {
    return this.customersDal.findOrCreate(input);
  }
}
