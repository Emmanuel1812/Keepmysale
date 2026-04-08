export async function assertOwnership(merchantId: string, resourceMerchantId: string): Promise<void> {
  if (merchantId !== resourceMerchantId) {
    throw new Error("NOT_FOUND");
  }
}
