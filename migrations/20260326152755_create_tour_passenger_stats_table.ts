import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tour_passenger_stats', (table) => {
    table.string('tour_id').primary();
    table.integer('total_boarding').defaultTo(0);
    table.integer('total_alighting').defaultTo(0);
    table.timestamps(true, true);
  });
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tour_passenger_stats');
}

