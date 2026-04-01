import { Knex } from 'knex';

export interface BankgirotPayment {
  amount: number;
  reference: string; // Fakturanummer
  paymentDate: string;
}

export class BankGateway {
  constructor(private db: Knex) {}

  /**
   * Simulerar inläsning av en fil från Bankgirot.
   * Detta är "Yttre Ringen" som pratar med det interna systemet.
   */
  async processIncomingPayments(payments: BankgirotPayment[]) {
    console.log(`[BankGateway] Tar emot ${payments.length} betalningar från Bankgirot...`);
    
    for (const payment of payments) {
      // 1. Hitta matchande faktura (Inre ringen)
      const invoice = await this.db('invoices').where({ invoice_number: payment.reference }).first();

      if (!invoice) {
        console.warn(`[BankGateway] ⚠️ Kunde inte hitta faktura med referens ${payment.reference}. Manuell hantering krävs.`);
        continue;
      }

      if (parseFloat(payment.amount.toString()) !== parseFloat(invoice.amount_total.toString())) {
        console.warn(`[BankGateway] ⚠️ Beloppsmismatch för ${payment.reference}. Väntat: ${invoice.amount_total}, Fått: ${payment.amount}`);
        // Här skulle vi kunna hantera delbetalningar, men för Walking Skeleton kräver vi full match
      }

      // 2. Uppdatera faktura och bokför
      await this.db.transaction(async (trx) => {
        await trx('invoices').where({ id: invoice.id }).update({
          status: 'PAID',
          updated_at: new Date()
        });

        // 3. Bokför inbetalningen
        // Debit 1930 (Företagskonto/Bank)
        await trx('ledger_entries').insert({
          transaction_date: new Date(payment.paymentDate),
          account_code: '1930',
          description: `Inbetalning fr. kund - Faktura ${invoice.invoice_number}`,
          debit: payment.amount,
          invoice_id: invoice.id
        });

        // Kredit 1510 (Kundreskontra - nollställer fordran)
        await trx('ledger_entries').insert({
          transaction_date: new Date(payment.paymentDate),
          account_code: '1510',
          description: `Reglering kundfordran - Faktura ${invoice.invoice_number}`,
          credit: payment.amount,
          invoice_id: invoice.id
        });
      });

      console.log(`[BankGateway] ✅ Faktura ${payment.reference} markerad som betald och bokförd.`);
    }
  }
}
