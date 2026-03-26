import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Uppdragsgivare (t.ex. SL, Skånetrafiken)
  await knex.schema.createTable('contractors', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable().unique();
    table.uuid('default_receivable_account_id').references('id').inTable('accounts'); // Länk till ex. 1510
    table.timestamps(true, true);
  });

  // Huvudavtal
  await knex.schema.createTable('contracts', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('contractor_id').references('id').inTable('contractors').onDelete('CASCADE');
    table.string('contract_reference').notNullable(); // t.ex. "E22-Norrtälje"
    table.date('valid_from').notNullable();
    table.date('valid_to').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // Tariffer och regler för ett avtal (Flexibel design)
  await knex.schema.createTable('tariffs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('contract_id').references('id').inTable('contracts').onDelete('CASCADE');
    table.string('line_id').notNullable(); // t.ex. "676" eller "*" för alla
    table.decimal('base_price_per_km', 10, 2).notNullable();
    // JSONB kolumn för att lagra komplexa regler: OB-tillägg, fordonstyper (el vs diesel), viten
    table.jsonb('pricing_rules').defaultTo('{}'); 
    table.uuid('revenue_account_id').references('id').inTable('accounts'); // Länk till ex. 3000
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tariffs');
  await knex.schema.dropTableIfExists('contracts');
  await knex.schema.dropTableIfExists('contractors');
}
