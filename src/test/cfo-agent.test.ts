import Knex from 'knex';
import { TreasuryAgent } from '../domain/ledger/treasury-agent';
import { ReportingAgent } from '../domain/ledger/reporting-agent';
import { ControllingAgent } from '../domain/ledger/controlling-agent';

describe('Milstolpe 8: CFO Agent Intelligence', () => {
  let db: any;
  let treasury: TreasuryAgent;
  let reporting: ReportingAgent;
  let controlling: ControllingAgent;

  beforeAll(async () => {
    db = Knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    });

    await db.schema.createTable('ledger_entries', (table: any) => {
      table.increments('id');
      table.string('account_code');
      table.string('description');
      table.date('transaction_date');
      table.decimal('debit').defaultTo(0);
      table.decimal('credit').defaultTo(0);
    });

    await db.schema.createTable('invoices', (table: any) => {
      table.increments('id');
      table.string('status');
      table.string('customer_name');
      table.date('due_date');
      table.decimal('amount_total');
    });

    await db.schema.createTable('assets', (table: any) => {
      table.uuid('id').primary();
      table.string('asset_id');
      table.decimal('purchase_price');
      table.decimal('book_value');
      table.decimal('accumulated_depreciation').defaultTo(0);
      table.timestamps(true, true);
    });

    await db.schema.createTable('accruals', (table: any) => {
      table.uuid('id').primary();
      table.string('period');
      table.decimal('amount');
      table.string('account_code');
      table.string('status');
      table.timestamps(true, true);
    });

    await db.schema.createTable('penalties', (table: any) => {
      table.uuid('id').primary();
      table.string('reference_id');
      table.decimal('amount');
      table.string('reason_code');
      table.string('status');
      table.text('dispute_draft');
      table.timestamps(true, true);
    });

    treasury = new TreasuryAgent(db);
    reporting = new ReportingAgent(db);
    controlling = new ControllingAgent(db, 'http://mock-traffic');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('UC-FIN-04: Skapa likviditetsvarning vid brist', async () => {
    // Bank: 1.5M (1930)
    await db('ledger_entries').insert({ account_code: '1930', debit: 1500000 });
    
    // Skuld: 0.8M (E.ON)
    await db('invoices').insert({ 
      status: 'PENDING_PAYMENT', 
      customer_name: 'E.ON Energi', 
      amount_total: 800000, 
      due_date: new Date() 
    });

    // Fordran: 0 SEK (ingen SL faktura inlagd)
    
    // Net: 1.5M - 0.8M - 1.2M (Payroll) = -0.5M
    const forecast = await treasury.generateLiquidityForecast(new Date());
    expect(forecast.projectedNet).toBe(-500000);
  });

  it('UC-FIN-07: Utföra dynamisk avskrivning baserat på batterihälsa', async () => {
    const assetId = 'BUSS-101';
    await db('assets').insert({ 
      id: '550e8400-e29b-41d4-a716-446655440000', 
      asset_id: assetId, 
      purchase_price: 5000000, 
      book_value: 5000000 
    });

    const dep = await reporting.calculateDynamicDepreciation({ assetId, degradationPct: 0.5 });
    expect(dep).toBe(25000);

    const updated = await db('assets').where({ asset_id: assetId }).first();
    expect(parseFloat(updated.book_value)).toBe(4975000);
  });

  it('UC-FIN-06: Bestrida vite automatiskt vid Force Majeure', async () => {
    const result = await controlling.processPenalty('TOUR-123', 5000);
    expect(result.status).toBe('DISPUTED');
    expect(result.disputeDraft).toContain('Force Majeure');
    
    const penalty = await db('penalties').where({ reference_id: 'TOUR-123' }).first();
    expect(penalty).toBeDefined();
    expect(penalty.status).toBe('DISPUTED');
  });
});
