import { Knex } from 'knex';
import { randomUUID } from 'crypto';

export interface TourCompletedEvent {
  tourId: string;
  line: string;
  distanceKm: number;
}

export interface ApcStats {
  totalBoarding: number;
}

export class BillingEngine {
  constructor(private db: Knex) {}

  async processTourCompletion(tour: TourCompletedEvent, apc: ApcStats) {
    console.log(`[BillingEngine] Processar fakturering för tur ${tour.tourId} på linje ${tour.line}...`);

    // 1. Hämta kontrakt
    const contract = await this.db('contracts').where({ line_id: tour.line }).first();
    if (!contract) {
      throw new Error(`Inget aktivt kontrakt hittat för linje ${tour.line}`);
    }

    // 2. Beräkna belopp
    const kmAmount = tour.distanceKm * parseFloat(contract.km_tariff);
    const bonusAmount = apc.totalBoarding * parseFloat(contract.boarding_bonus);
    const totalExclVat = kmAmount + bonusAmount;
    const vatAmount = totalExclVat * 0.06; // 6% moms på kollektivtrafik
    const totalInclVat = totalExclVat + vatAmount;

    // 3. Skapa faktura
    const invoiceId = randomUUID();
    const invoiceNumber = `INV-${Date.now()}-${tour.tourId.substring(0, 4)}`;
    
    await this.db.transaction(async (trx) => {
      await trx('invoices').insert({
        id: invoiceId,
        invoice_number: invoiceNumber,
        customer_name: 'Storstockholms Lokaltrafik (SL)',
        amount_total: totalInclVat,
        amount_vat: vatAmount,
        currency: 'SEK',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dagar netto
        status: 'PENDING_PAYMENT',
        reference_id: tour.tourId
      });

      // 4. Bokför i huvudboken (Inre ringen)
      // Debit 1510 (Kundreskontra)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '1510',
        description: `Kundfaktura ${invoiceNumber} - Linje ${tour.line}`,
        debit: totalInclVat,
        invoice_id: invoiceId
      });

      // Kredit 3000 (Försäljning)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '3000',
        description: `Försäljning tur ${tour.tourId}`,
        credit: totalExclVat,
        invoice_id: invoiceId
      });

      // Kredit 2611 (Utgående moms 6%)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '2611',
        description: `Moms på faktura ${invoiceNumber}`,
        credit: vatAmount,
        invoice_id: invoiceId
      });
    });

    console.log(`[BillingEngine] Faktura ${invoiceNumber} skapad och bokförd. Totalt: ${totalInclVat.toFixed(2)} SEK.`);
    return { invoiceId, invoiceNumber, totalInclVat };
  }
}
