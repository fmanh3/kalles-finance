import Knex from 'knex';
import { BillingEngine } from '../domain/billing/billing-engine';

describe('UC-FIN-01: Automatiserad Fakturering av Körtur', () => {
  let db: any;
  let billingEngine: BillingEngine;

  beforeAll(async () => {
    // Använd in-memory SQLite för snabbtest
    db = Knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    });

    // Skapa minimalt schema för test
    await db.schema.createTable('contracts', (table: any) => {
      table.string('line_id').primary();
      table.decimal('km_tariff', 10, 2);
      table.decimal('boarding_bonus', 10, 2);
    });

    await db.schema.createTable('invoices', (table: any) => {
      table.uuid('id').primary();
      table.string('invoice_number').unique();
      table.string('customer_name');
      table.decimal('amount_total', 15, 2);
      table.decimal('amount_vat', 15, 2);
      table.string('currency');
      table.date('due_date');
      table.string('status');
      table.string('reference_id');
      table.timestamps(true, true);
    });

    await db.schema.createTable('ledger_entries', (table: any) => {
      table.increments('id');
      table.date('transaction_date');
      table.string('account_code');
      table.string('description');
      table.decimal('debit', 15, 2);
      table.decimal('credit', 15, 2);
      table.uuid('invoice_id');
    });

    billingEngine = new BillingEngine(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('Scenario: Lyckad fakturering av avslutad tur', async () => {
    // Given an active contract exists for line "676" with tariff "15.00" SEK/km
    // And a passenger bonus of "2.00" SEK per boarding exists
    await db('contracts').insert({
      line_id: '676',
      km_tariff: 15.00,
      boarding_bonus: 2.00
    });

    // When a "TrafficTourCompleted" event is received for tour "TOUR-123"
    // And the tour distance was "73" km
    const tourEvent = { tourId: 'TOUR-123', line: '676', distanceKm: 73 };
    
    // And there were "25" total boardings
    const apcStats = { totalBoarding: 25 };

    const result = await billingEngine.processTourCompletion(tourEvent, apcStats);

    // Then a new invoice should be created in the ledger
    const invoice = await db('invoices').where({ id: result.invoiceId }).first();
    expect(invoice).toBeDefined();
    expect(invoice.invoice_number).toContain('INV-');

    // And the total amount should be "1145.00" SEK (plus 6% VAT)
    // Beräkning: (73 * 15) + (25 * 2) = 1095 + 50 = 1145. 
    // Med 6% moms: 1145 * 1.06 = 1213.7
    expect(parseFloat(invoice.amount_total)).toBeCloseTo(1213.7, 1);

    // And the invoice status should be "PENDING_PAYMENT"
    expect(invoice.status).toBe('PENDING_PAYMENT');

    // Kolla huvudboken
    const ledgerEntries = await db('ledger_entries').where({ invoice_id: result.invoiceId });
    expect(ledgerEntries.length).toBe(3); // 1510, 3000, 2611
  });
});
