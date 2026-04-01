import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Kontrakt (Tariffer för olika linjer)
  await knex.schema.createTable('contracts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('line_id').notNullable().unique();
    table.decimal('km_tariff', 10, 2).notNullable(); // SEK per km
    table.decimal('boarding_bonus', 10, 2).notNullable(); // SEK per boarding
    table.string('currency').defaultTo('SEK');
    table.timestamps(true, true);
  });

  // 2. Fakturor (Kundreskontra)
  await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('invoice_number').notNullable().unique();
    table.string('customer_name').notNullable();
    table.decimal('amount_total', 15, 2).notNullable();
    table.decimal('amount_vat', 15, 2).notNullable();
    table.string('currency').defaultTo('SEK');
    table.date('due_date').notNullable();
    table.enum('status', ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'OVERDUE', 'CANCELLED']).defaultTo('PENDING_PAYMENT');
    table.string('reference_id'); // T.ex. TourID eller externt referensnummer
    table.timestamps(true, true);
  });

  // 3. Huvudbok (Kontoplan/Transaktioner)
  await knex.schema.createTable('ledger_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.date('transaction_date').notNullable();
    table.string('account_code').notNullable(); // T.ex. 1510 (Kundreskontra), 3000 (Försäljning)
    table.string('description').notNullable();
    table.decimal('debit', 15, 2).defaultTo(0);
    table.decimal('credit', 15, 2).defaultTo(0);
    table.uuid('invoice_id').references('id').inTable('invoices').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // 4. Temporär lagring för passagerardata per tur
  await knex.schema.createTable('tour_passenger_stats', (table) => {
    table.string('tour_id').primary();
    table.integer('total_boarding').defaultTo(0);
    table.integer('total_alighting').defaultTo(0);
    table.timestamps(true, true);
  });

  // Seed för linje 676
  await knex('contracts').insert({
    line_id: '676',
    km_tariff: 15.00,
    boarding_bonus: 2.00
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tour_passenger_stats');
  await knex.schema.dropTableIfExists('ledger_entries');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('contracts');
}
