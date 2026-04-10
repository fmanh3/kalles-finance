import { Knex } from 'knex';

/**
 * APAgent - Ansvarar för leverantörsreskontra och 3-way matching.
 */
export class APAgent {
  constructor(private db: Knex) {}

  /**
   * UC-FIN-08: Utför autonom 3-way matching.
   */
  async performThreeWayMatch(invoice: { vendorId: string, amount: number, poReference: string }) {
    console.log(`[AP-Agent] Startar 3-way match för faktura från ${invoice.vendorId}...`);

    // 1. Hitta Purchase Order (PO)
    const po = await this.db('purchase_orders')
      .where({ id: invoice.poReference, vendor_id: invoice.vendorId })
      .first();

    if (!po) {
      console.warn(`[AP-Agent] ❌ Matchning misslyckades: Ingen PO hittad för ${invoice.poReference}`);
      return { status: 'REJECTED', reason: 'NO_MATCHING_PO' };
    }

    // 2. Kontrollera Goods Receipt (GR) - Vi simulerar att vi har en GR-tabell eller event-logg
    // I denna demo antar vi att varan är mottagen om PO-status är 'RECEIVED'
    if (po.status !== 'RECEIVED') {
      console.warn(`[AP-Agent] ⏳ Väntar på varumottagning för PO ${po.id}`);
      return { status: 'PENDING_GOODS_RECEIPT' };
    }

    // 3. Kontrollera Belopp
    if (parseFloat(po.total_amount) !== invoice.amount) {
      console.warn(`[AP-Agent] ❌ Beloppskonflikt: PO ${po.total_amount} vs Faktura ${invoice.amount}`);
      return { status: 'FLAGGED_FOR_REVIEW', reason: 'AMOUNT_MISMATCH' };
    }

    // 4. Allt matchar! Godkänn och bokför
    console.log(`[AP-Agent] ✅ 3-Way Match Lyckad! Godkänner faktura.`);
    
    await this.db.transaction(async (trx) => {
      await trx('invoices').insert({
        invoice_number: `INV-${Math.random().toString(36).substring(7)}`,
        customer_name: `Vendor-${invoice.vendorId}`,
        amount_total: invoice.amount,
        status: 'APPROVED',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Bokför i huvudboken
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '4000',
        description: `Matchad reservdelsfaktura ${po.id}`,
        debit: invoice.amount
      });

      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '2440',
        description: `Leverantörsskuld Vendor ${invoice.vendorId}`,
        credit: invoice.amount
      });
    });

    return { status: 'APPROVED' };
  }
}
