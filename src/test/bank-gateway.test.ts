import Knex from 'knex';
import { BankGateway } from '../domain/gateways/bank-gateway';
import { LiquidityService } from '../domain/ledger/liquidity-service';

describe('UC-FIN-02: Matchning av Inbetalning (Bankgirot)', () => {
  let db: any;
  let bankGateway: BankGateway;
  let liquidityService: LiquidityService;

  beforeAll(async () => {
    db = Knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    });

    await db.schema.createTable('invoices', (table: any) => {
      table.uuid('id').primary();
      table.string('invoice_number').unique();
      table.decimal('amount_total', 15, 2);
      table.string('status');
      table.timestamps(true, true);
    });

    await db.schema.createTable('ledger_entries', (table: any) => {
      table.increments('id');
      table.date('transaction_date');
      table.string('account_code');
      table.string('description');
      table.decimal('debit', 15, 2).defaultTo(0);
      table.decimal('credit', 15, 2).defaultTo(0);
      table.uuid('invoice_id');
    });

    bankGateway = new BankGateway(db);
    liquidityService = new LiquidityService(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('Scenario: Automatisk matchning av full betalning', async () => {
    // Given an outstanding invoice "INV-500" exists with amount "1145.00" SEK
    const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
    await db('invoices').insert({
      id: invoiceId,
      invoice_number: 'INV-500',
      amount_total: 1145.00,
      status: 'PENDING_PAYMENT'
    });

    // Bokför initial fordran
    await db('ledger_entries').insert({
      account_code: '1510',
      debit: 1145.00,
      invoice_id: invoiceId,
      transaction_date: new Date()
    });

    // When a payment file is received from "Bankgirot"
    // And the file contains a payment of "1145.00" SEK with reference "INV-500"
    const payments = [{
      amount: 1145.00,
      reference: 'INV-500',
      paymentDate: new Date().toISOString()
    }];

    await bankGateway.processIncomingPayments(payments);

    // Then the invoice "INV-500" should be marked as "PAID"
    const updatedInvoice = await db('invoices').where({ invoice_number: 'INV-500' }).first();
    expect(updatedInvoice.status).toBe('PAID');

    // And a matching entry should be created in the General Ledger
    // And the cash account balance should increase by "1145.00" SEK
    const position = await liquidityService.getCurrentPosition();
    expect(position.bankBalance).toBe(1145.00);
    expect(position.accountsReceivable).toBe(0); // Fordran ska vara nollställd
  });
});
