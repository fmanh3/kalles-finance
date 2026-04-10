import { Knex } from 'knex';

export interface CashFlowForecast {
  currentCash: number;
  upcomingPayables: number;
  upcomingPayroll: number;
  expectedReceivables: number;
  projectedNet: number;
}

export class TreasuryAgent {
  constructor(private db: Knex) {}

  async generateLiquidityForecast(targetDate: Date): Promise<CashFlowForecast> {
    const bankEntry = await this.db('ledger_entries')
      .where({ account_code: '1930' })
      .sum('debit as total_debit')
      .sum('credit as total_credit')
      .first();

    const currentCash = parseFloat(bankEntry?.total_debit || '0') - parseFloat(bankEntry?.total_credit || '0');

    // Payables: I verkligheten har vi en AP-tabell eller flagga. För demo antar vi negativa belopp eller specifik kund.
    const payables = await this.db('invoices')
      .where({ status: 'PENDING_PAYMENT' })
      .andWhere('customer_name', 'not like', '%SL%') // Mock: Allt som inte är SL är en skuld
      .andWhere('due_date', '<=', targetDate)
      .sum('amount_total as total');

    const upcomingPayables = parseFloat(payables[0]?.total || '0');

    const upcomingPayroll = 1200000;

    // Receivables: Allt från SL
    const receivables = await this.db('invoices')
      .where({ status: 'PENDING_PAYMENT' })
      .andWhere('customer_name', 'like', '%SL%')
      .andWhere('due_date', '<=', targetDate)
      .sum('amount_total as total');

    const expectedReceivables = parseFloat(receivables[0]?.total || '0');

    const projectedNet = currentCash + expectedReceivables - upcomingPayables - upcomingPayroll;

    return {
      currentCash,
      upcomingPayables,
      upcomingPayroll,
      expectedReceivables,
      projectedNet
    };
  }
}
