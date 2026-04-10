import Knex from 'knex';
import { EnergyStrategistAgent } from '../domain/ledger/energy-strategist-agent';
import { ChargerAgent } from '../../../kalles-energy-depot/src/domain/charging/charger-agent';

describe('Milstolpe 9: Det Optimerade Imperiet (Integration)', () => {
  let financeDb: any;
  let depotDb: any;
  let strategist: EnergyStrategistAgent;
  let charger: ChargerAgent;

  beforeAll(async () => {
    // Setup Finance Mock DB
    financeDb = Knex({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    
    // Setup Depot Mock DB
    depotDb = Knex({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    await depotDb.schema.createTable('vehicle_depot_status', (table: any) => {
      table.string('vehicle_id');
      table.uuid('connected_station_id');
      table.decimal('current_soc');
    });
    await depotDb.schema.createTable('charging_sessions', (table: any) => {
      table.increments('id');
      table.uuid('station_id');
      table.string('vehicle_id');
      table.datetime('start_time');
      table.decimal('start_soc');
      table.string('optimization_strategy');
    });

    strategist = new EnergyStrategistAgent();
    charger = new ChargerAgent(depotDb);
  });

  it('Ska identifiera dyra elpriser och beordra nattladdning', async () => {
    // 1. Simulerade priser (Dyr morgon, billig natt)
    const prices = [
      { hour: 2, price: 0.40 },
      { hour: 7, price: 5.00 }
    ];

    // 2. Kör analysen
    const result = await strategist.optimizeEnergyCosts(prices);
    expect(result.action).toBe('OPTIMIZED');
    expect(result.strategy?.strategy).toBe('SPOT_PRICE_HEDGING');

    // 3. Simulera att Depån tar emot eventet
    // Vi lägger in en buss som är ansluten i depån
    await depotDb('vehicle_depot_status').insert({
      vehicle_id: 'BUSS-101',
      connected_station_id: '550e8400-e29b-41d4-a716-446655440000',
      current_soc: 45
    });

    const chargerResult = await charger.applyOptimizationStrategy(result.strategy as any);
    expect(chargerResult.count).toBe(1);

    // 4. Verifiera att laddning schemalagts
    const session = await depotDb('charging_sessions').first();
    expect(session.vehicle_id).toBe('BUSS-101');
    expect(session.optimization_strategy).toBe('SPOT_PRICE_HEDGING');
    console.log('✅ Verifierat: Buss 101 schemalagd för nattladdning pga elpriser!');
  });
});
