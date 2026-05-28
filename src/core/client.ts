/**
 * Un CLIENT acquis par Sales. Il paie un montant fixe à chaque versement
 * (toutes les billingCycleSec), pendant un nombre limité de versements
 * (paymentsRemaining). À 0, le client part (churn) et est retiré.
 */
export interface Client {
  id: number;
  paymentsRemaining: number;
}

export function createClient(id: number, paymentsRemaining: number): Client {
  return { id, paymentsRemaining };
}
