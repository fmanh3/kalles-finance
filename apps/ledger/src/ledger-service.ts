import { TrafficTourCompletedSchema } from '../../packages/shared-schemas/src/traffic-events';
import { v4 as uuidv4 } from 'uuid';

/**
 * MOCK: Här borde vi ha en PubSubSubscriber precis som i kalles-traffic.
 * För tillfället bygger vi in logiken direkt för att visa DDD-flödet.
 */
export class GeneralLedgerService {
  constructor(private db: any) {}

  /**
   * Hanterar händelsen när en tur avslutats och skapar en verifikation.
   */
  async handleTourCompleted(eventData: any) {
    // 1. Validera händelsen
    const event = TrafficTourCompletedSchema.parse(eventData);
    
    console.log(`[Finance] Tar emot TrafficTourCompleted för tur ${event.tourId}. Avstånd: ${event.distanceKm} km.`);

    // 2. Kalkylera intäkt (Mock-logik: 50 kr per km)
    const REVENUE_PER_KM = 50;
    const totalRevenue = event.distanceKm * REVENUE_PER_KM;

    // 3. Bokför i databasen via en transaktion
    await this.db.transaction(async (trx: any) => {
      
      // Hämta konton (Antar att de finns seedade)
      const salesAccount = await trx('accounts').where('account_number', '3000').first();
      const accountsReceivable = await trx('accounts').where('account_number', '1510').first();

      if(!salesAccount || !accountsReceivable) {
         console.warn("[Finance] Varning: Kontoplan ej seedad. Skippar bokföring i demo-syfte.");
         return;
      }

      // Skapa verifikation (Journal Entry)
      const [journalEntry] = await trx('journal_entries').insert({
        id: uuidv4(),
        description: `Intäkt uppdragstrafik Tur ${event.tourId}, Linje ${event.line}`,
        source_event_id: event.eventId,
      }).returning('id');

      // Debet: Kundreskontra (Ökad fordran på SL)
      await trx('journal_lines').insert({
        id: uuidv4(),
        journal_entry_id: journalEntry.id,
        account_id: accountsReceivable.id,
        amount: totalRevenue // Debet
      });

      // Kredit: Försäljningstjänster
      await trx('journal_lines').insert({
        id: uuidv4(),
        journal_entry_id: journalEntry.id,
        account_id: salesAccount.id,
        amount: -totalRevenue // Kredit
      });

      console.log(`[Finance] Bokfört ${totalRevenue} kr på tur ${event.tourId} (Debet 1510, Kredit 3000). Korrelations-ID: ${event.correlationId}`);
    });
  }
}
