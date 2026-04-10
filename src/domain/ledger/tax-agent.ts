import { Knex } from 'knex';

/**
 * TaxAgent - Automatiserar momsredovisning och skatteexport.
 */
export class TaxAgent {
  constructor(private db: Knex) {}

  /**
   * Sammanställer moms för en given period.
   */
  async generateVatReport(period: string) {
    console.log(`[TaxAgent] Sammanställer moms för ${period}...`);

    // Hämta utgående moms (Konto 2611)
    const outgoing = await this.db('ledger_entries')
      .where({ account_code: '2611' })
      .sum('credit as total');

    // Hämta ingående moms (Konto 2641)
    const incoming = await this.db('ledger_entries')
      .where({ account_code: '2641' })
      .sum('debit as total');

    const outgoingVat = parseFloat(outgoing[0]?.total || '0');
    const incomingVat = parseFloat(incoming[0]?.total || '0');

    return {
      period,
      outgoingVat,
      incomingVat,
      netVatToPay: outgoingVat - incomingVat,
      status: 'READY_FOR_FILING'
    };
  }

  /**
   * Simulerar generering av en SIE4 fil.
   */
  async exportSIE4(period: string) {
    return {
      filename: `export_${period}_kalles_buss.sie`,
      content: `#GEN ${new Date().toISOString()}\n#SIETYP 4\n#ORGNR 556677-8899\n...`,
      format: 'SIE4'
    };
  }
}
