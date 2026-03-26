import { TrafficTourCompletedSchema, ApcEventSchema } from '../../../packages/shared-schemas/src/traffic-events';
import { v4 as uuidv4 } from 'uuid';

export class GeneralLedgerService {
  constructor(private db: any) {}

  /**
   * Hanterar inkommande APC (Trafiklab) händelser för att ackumulera resande per tur.
   */
  async handleApcEvent(eventData: any) {
    const event = ApcEventSchema.parse(eventData);
    
    await this.db('tour_passenger_stats')
      .insert({
        tour_id: event.journeyRef,
        total_boarding: event.boarding,
        total_alighting: event.alighting
      })
      .onConflict('tour_id')
      .merge({
        total_boarding: this.db.raw('tour_passenger_stats.total_boarding + ?', [event.boarding]),
        total_alighting: this.db.raw('tour_passenger_stats.total_alighting + ?', [event.alighting])
      });
      
    console.log(`[Finance] APC-data mottagen från Trafiklab för tur ${event.journeyRef}. Påstigande: ${event.boarding}`);
  }

  /**
   * Hanterar händelsen när en tur avslutats.
   * Agerar "Billing Engine": Beräknar pris utifrån avtal och bokför.
   */
  async handleTourCompleted(eventData: any) {
    const event = TrafficTourCompletedSchema.parse(eventData);
    
    console.log(`[Billing Engine] Tar emot TrafficTourCompleted för tur ${event.tourId}. Avstånd: ${event.distanceKm} km på linje ${event.line}.`);

    await this.db.transaction(async (trx: any) => {
      // 1. Hitta aktivt avtal och tariff
      const tariff = await trx('tariffs')
        .join('contracts', 'tariffs.contract_id', '=', 'contracts.id')
        .join('contractors', 'contracts.contractor_id', '=', 'contractors.id')
        .where('contracts.is_active', true)
        .andWhere(function(this: any) {
          this.where('tariffs.line_id', event.line).orWhere('tariffs.line_id', '*')
        })
        .orderByRaw(`CASE WHEN tariffs.line_id = ? THEN 1 ELSE 2 END`, [event.line])
        .select(
          'tariffs.base_price_per_km',
          'tariffs.pricing_rules',
          'tariffs.revenue_account_id',
          'contractors.default_receivable_account_id',
          'contractors.name as contractor_name'
        )
        .first();

      if (!tariff) {
        console.warn(`[Billing Engine] Inget avtal/tariff hittades för linje ${event.line}. Kan ej fakturera.`);
        return;
      }

      // 2. Beräkna pris (Pricing Engine)
      let pricePerKm = Number(tariff.base_price_per_km);
      const rules = typeof tariff.pricing_rules === 'string' ? JSON.parse(tariff.pricing_rules) : tariff.pricing_rules;
      
      const currentTime = new Date(event.timestamp);
      const hour = currentTime.getHours();
      const isNight = hour >= 22 || hour <= 5; // Enkel OB-check: 22:00-06:00
      const isHoliday = currentTime.getDay() === 0 || currentTime.getDay() === 6; // Lördag/Söndag som enklaste röd-dag proxy
      
      console.log(`[Billing Engine] Evaluerar regler för ${currentTime.toISOString()}`);

      // Applicera OB/Natt
      if (isNight && rules.night_multiplier) {
         pricePerKm = pricePerKm * Number(rules.night_multiplier);
         console.log(`[Billing Engine] Applicerar Natt-OB: x${rules.night_multiplier} (Nytt pris: ${pricePerKm.toFixed(2)} kr/km)`);
      }
      
      // Applicera Helg/Röd dag
      if (isHoliday && rules.holiday_multiplier) {
         pricePerKm = pricePerKm * Number(rules.holiday_multiplier);
         console.log(`[Billing Engine] Applicerar Helg-tariff: x${rules.holiday_multiplier} (Nytt pris: ${pricePerKm.toFixed(2)} kr/km)`);
      }

      // Applicera Miljöbonus
      if (rules.electric_bonus && event.busId.includes('101')) {
        pricePerKm += Number(rules.electric_bonus);
        console.log(`[Billing Engine] Applicerar miljöbonus: +${rules.electric_bonus} kr/km (Nytt pris: ${pricePerKm.toFixed(2)} kr/km)`);
      }

      // Resandeincitament (Hämtar aggregerad data från Trafiklab-APCs för denna tur)
      let passengerBonus = 0;
      let totalBoarding = 0;
      
      if (rules.boarding_bonus_per_passenger) {
         const stats = await trx('tour_passenger_stats')
            .where('tour_id', event.tourId)
            .first();
            
         if (stats) {
            totalBoarding = Number(stats.total_boarding);
            passengerBonus = totalBoarding * Number(rules.boarding_bonus_per_passenger);
            console.log(`[Billing Engine] Applicerar resandeincitament baserat på Trafiklab APC: ${totalBoarding} pax * ${rules.boarding_bonus_per_passenger} kr = +${passengerBonus.toFixed(2)} kr`);
         } else {
            console.log(`[Billing Engine] Ingen APC-data hittades för tur ${event.tourId}. Inget resandeincitament applicerat.`);
         }
      }

      const totalRevenue = (event.distanceKm * pricePerKm) + passengerBonus;

      // 3. Bokför i huvudboken
      const [journalEntry] = await trx('journal_entries').insert({
        id: uuidv4(),
        description: `Intäkt uppdragstrafik (${tariff.contractor_name}) Tur ${event.tourId}, Linje ${event.line}`,
        source_event_id: event.eventId,
      }).returning('id');

      // Debet: Kundreskontra
      await trx('journal_lines').insert({
        id: uuidv4(),
        journal_entry_id: journalEntry.id,
        account_id: tariff.default_receivable_account_id,
        amount: totalRevenue
      });

      // Kredit: Försäljningskonto
      await trx('journal_lines').insert({
        id: uuidv4(),
        journal_entry_id: journalEntry.id,
        account_id: tariff.revenue_account_id,
        amount: -totalRevenue
      });

      console.log(`[Ledger] Bokfört ${totalRevenue.toFixed(2)} kr mot kund ${tariff.contractor_name} för tur ${event.tourId}. (Slutgiltig tariff: ${pricePerKm.toFixed(2)} kr/km + ${passengerBonus} kr i passagerarbonus)`);
    });
  }
}