import { PubSubClient } from '../../kalles-traffic/src/infrastructure/messaging/pubsub-client';
import { GeneralLedgerService } from '../apps/ledger/src/ledger-service';
import Knex from 'knex';
import config from '../knexfile';
import * as dotenv from 'dotenv';

dotenv.config();

async function start() {
  console.log('--- KALLES FINANCE: BILLING ENGINE & LEDGER ---');
  
  const db = Knex(config.development!);
  const ledgerService = new GeneralLedgerService(db);
  const pubsub = new PubSubClient();
  
  // Vi byter nu från telemetri till affärshändelser
  const TOPIC_NAME = 'traffic-events'; 
  const SUB_NAME = 'finance-billing-sub';
  
  const APC_TOPIC = 'apc-events';
  const APC_SUB_NAME = 'finance-apc-sub';

  await pubsub.subscribe(TOPIC_NAME, SUB_NAME, async (event) => {
    try {
      // Vi kontrollerar att det är rätt typ av händelse
      if (event.status === 'COMPLETED' && event.distanceKm) {
        await ledgerService.handleTourCompleted(event);
      }
    } catch (err) {
      console.error('[Finance] Fel vid hantering av händelse:', err);
    }
  });

  await pubsub.subscribe(APC_TOPIC, APC_SUB_NAME, async (event) => {
    try {
      if (event.boarding !== undefined || event.alighting !== undefined) {
        await ledgerService.handleApcEvent(event);
      }
    } catch (err) {
      console.error('[Finance] Fel vid hantering av APC-händelse:', err);
    }
  });
}

start().catch(console.error);
