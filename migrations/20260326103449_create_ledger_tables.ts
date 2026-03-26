import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Kontoplan (Chart of Accounts)
  await knex.schema.createTable('accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('account_number').notNullable().unique(); // t.ex. "3000" för Försäljning
    table.string('name').notNullable();
    table.string('type').notNullable(); // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    table.timestamps(true, true);
  });

  // Verifikationer (Journal Entries / Vouchers)
  await knex.schema.createTable('journal_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('description').notNullable(); // T.ex. "Fakturering Tur TOUR-999"
    table.string('source_event_id').notNullable(); // Referens till t.ex. TrafficTourCompleted
    table.timestamp('booking_date').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });

  // Verifikationsrader (Journal Lines - Debet/Kredit)
  await knex.schema.createTable('journal_lines', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('journal_entry_id').references('id').inTable('journal_entries').onDelete('CASCADE');
    table.uuid('account_id').references('id').inTable('accounts');
    table.decimal('amount', 14, 2).notNullable(); // Positivt för Debet, negativt för Kredit
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('journal_lines');
  await knex.schema.dropTableIfExists('journal_entries');
  await knex.schema.dropTableIfExists('accounts');
}
