import Knex from 'knex';
import config from './knexfile';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const db = Knex(config.development!);
  
  console.log('--- SEEDING FINANCE DATA (ACCOUNTS & BILLING ENGINE) ---');
  
  // Clean up (Order is important due to foreign keys)
  await db('tariffs').del();
  await db('contracts').del();
  await db('contractors').del();
  await db('journal_lines').del();
  await db('journal_entries').del();
  await db('accounts').del();

  // 1. Seed Accounts
  const accountReceivableId = uuidv4();
  const accountRevenueId = uuidv4();
  
  await db('accounts').insert([
    { id: accountReceivableId, account_number: '1510', name: 'Kundreskontra SL', type: 'ASSET' },
    { id: accountRevenueId, account_number: '3000', name: 'Försäljning Uppdragstrafik', type: 'REVENUE' },
    { id: uuidv4(), account_number: '1910', name: 'Kassa/Bank', type: 'ASSET' }
  ]);

  // 2. Seed Contractor (SL)
  const contractorId = uuidv4();
  await db('contractors').insert({
    id: contractorId,
    name: 'Storstockholms Lokaltrafik (SL)',
    default_receivable_account_id: accountReceivableId
  });

  // 3. Seed Contract (E22 Norrtälje)
  const contractId = uuidv4();
  await db('contracts').insert({
    id: contractId,
    contractor_id: contractorId,
    contract_reference: 'E22-Norrtälje',
    valid_from: '2026-01-01',
    valid_to: '2036-12-31',
    is_active: true
  });

  // 4. Seed Tariffs
  await db('tariffs').insert([
    {
      id: uuidv4(),
      contract_id: contractId,
      line_id: '676', // Specifik taxa för stomlinje
      base_price_per_km: 65.50, // Ersättning per km
      pricing_rules: JSON.stringify({
        night_multiplier: 1.3,
        holiday_multiplier: 1.5,
        electric_bonus: 5.00, // +5 kr/km om elfordon används
        boarding_bonus_per_passenger: 1.50 // 1.50 kr per påstigande
      }),
      revenue_account_id: accountRevenueId
    },
    {
      id: uuidv4(),
      contract_id: contractId,
      line_id: '*', // Standardtaxa för övriga linjer
      base_price_per_km: 42.00,
      pricing_rules: JSON.stringify({}),
      revenue_account_id: accountRevenueId
    }
  ]);

  console.log('Seed complete: Accounts, Contractors, Contracts and Tariffs created.');
  await db.destroy();
}

seed().catch(console.error);
