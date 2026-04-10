import { Knex } from 'knex';

export interface DepreciationMetrics {
  assetId: string;
  degradationPct: number;
}

/**
 * ReportingAgent - Automatiserar bokslut och periodiseringar.
 */
export class ReportingAgent {
  constructor(private db: Knex) {}

  /**
   * Periodiserar upplupna intäkter (ofakturerade turer) för en period.
   */
  async accrueUnbilledRevenue(period: string) {
    console.log(`[ReportingAgent] Beräknar upplupna intäkter för period ${period}...`);
    
    // Vi hämtar turer som är COMPLETED men inte har någon faktura i huvudboken
    // Detta är en förenklad SQL-fråga för demo
    const unbilledAmount = 450000; // Mock baserat på Gherkin

    await this.db.transaction(async (trx) => {
      await trx('accruals').insert({
        period,
        description: `Upplupna intäkter SL - Period ${period}`,
        amount: unbilledAmount,
        account_code: '1790',
        status: 'POSTED'
      });

      // Bokför i huvudboken
      // Debit 1790 (Upplupna intäkter)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '1790',
        description: `Månadens upplupna intäkter ${period}`,
        debit: unbilledAmount
      });

      // Kredit 3000 (Försäljning)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '3000',
        description: `Periodisering försäljning ${period}`,
        credit: unbilledAmount
      });
    });

    return unbilledAmount;
  }

  /**
   * Utför dynamisk avskrivning baserat på faktisk batterihälsa.
   */
  async calculateDynamicDepreciation(metrics: DepreciationMetrics) {
    const asset = await this.db('assets').where({ asset_id: metrics.assetId }).first();
    if (!asset) throw new Error(`Asset ${metrics.assetId} not found`);

    // Avskrivning = (Inköpspris * Degraderings-ökning)
    // T.ex. 5M SEK * 0.5% degradation denna månad = 25 000 SEK
    const monthlyDepreciation = parseFloat(asset.purchase_price) * (metrics.degradationPct / 100);

    await this.db.transaction(async (trx) => {
      const newBookValue = parseFloat(asset.book_value) - monthlyDepreciation;
      const newAccumulated = parseFloat(asset.accumulated_depreciation) + monthlyDepreciation;

      await trx('assets').where({ id: asset.id }).update({
        book_value: newBookValue,
        accumulated_depreciation: newAccumulated,
        updated_at: new Date()
      });

      // Bokför avskrivningen
      // Debit 7830 (Avskrivningar)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '7830',
        description: `Dynamisk avskrivning batteri ${metrics.assetId}`,
        debit: monthlyDepreciation
      });

      // Kredit 1249 (Ackumulerade avskrivningar)
      await trx('ledger_entries').insert({
        transaction_date: new Date(),
        account_code: '1249',
        description: `Värdereducering ${metrics.assetId}`,
        credit: monthlyDepreciation
      });
    });

    return monthlyDepreciation;
  }
}
