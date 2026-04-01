import { Knex } from 'knex';

export class LiquidityService {
  constructor(private db: Knex) {}

  /**
   * Beräknar nuvarande likviditet baserat på huvudboken.
   */
  async getCurrentPosition() {
    const entries = await this.db('ledger_entries')
      .select('account_code')
      .sum('debit as total_debit')
      .sum('credit as total_credit')
      .groupBy('account_code');

    let bankBalance = 0;
    let accountsReceivable = 0;

    entries.forEach(entry => {
      const balance = parseFloat(entry.total_debit) - parseFloat(entry.total_credit);
      
      if (entry.account_code === '1930') {
        bankBalance = balance;
      } else if (entry.account_code === '1510') {
        accountsReceivable = balance;
      }
    });

    return {
      bankBalance,
      accountsReceivable,
      totalLiquidity: bankBalance + accountsReceivable,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enkel prognos för kommande 30 dagar baserat på utestående fakturor.
   */
  async get30DayForecast() {
    const current = await this.getCurrentPosition();
    
    const pendingInvoices = await this.db('invoices')
      .where({ status: 'PENDING_PAYMENT' })
      .sum('amount_total as total_pending');

    const totalPending = parseFloat(pendingInvoices[0]?.total_pending || '0');

    return {
      currentCash: current.bankBalance,
      expectedIncomings: totalPending,
      projectedLiquidity: current.bankBalance + totalPending,
      note: "Baserat på förfallodatum för utestående fakturor."
    };
  }
}
