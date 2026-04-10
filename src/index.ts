import { FinancePubSubClient } from './infrastructure/messaging/finance-pubsub-client';
import { BillingEngine } from './domain/billing/billing-engine';
import { BankGateway } from './domain/gateways/bank-gateway';
import { LiquidityService } from './domain/ledger/liquidity-service';
import { TreasuryAgent } from './domain/ledger/treasury-agent';
import { ReportingAgent } from './domain/ledger/reporting-agent';
import { ControllingAgent } from './domain/ledger/controlling-agent';
import Knex from 'knex';
import config from '../knexfile';
import * as dotenv from 'dotenv';
import express from 'express';

dotenv.config();

async function start() {
  const db = Knex(config.development!);
  const billingEngine = new BillingEngine(db);
  const bankGateway = new BankGateway(db);
  const liquidityService = new LiquidityService(db);
  const treasuryAgent = new TreasuryAgent(db);
  const reportingAgent = new ReportingAgent(db);
  const controllingAgent = new ControllingAgent(db, process.env.TRAFFIC_SERVICE_URL || '');

  const pubsub = new FinancePubSubClient();

  const app = express();
  app.use(express.json());
  const port = process.env.PORT || 8080;

  app.get('/', (req, res) => res.send('Kalles Finance Domain is live! 💰 (v8.0)'));
  app.get('/health', (req, res) => res.send('OK'));

  app.get('/liquidity', async (req, res) => {
    try {
      const status = await liquidityService.getCurrentPosition();
      const forecast = await liquidityService.get30DayForecast();
      res.json({ status, forecast });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/planning/liquidity-forecast', async (req, res) => {
    try {
      const targetDate = req.query.date ? new Date(req.query.date as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const forecast = await treasuryAgent.generateLiquidityForecast(targetDate);
      res.json(forecast);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/accounting/close-month', async (req, res) => {
    try {
      const { period } = req.body;
      const accrued = await reportingAgent.accrueUnbilledRevenue(period);
      res.json({ message: 'Month-end accruals completed', accruedAmount: accrued });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/accounting/depreciate-assets', async (req, res) => {
    try {
      const { assetId, degradationPct } = req.body;
      const amount = await reportingAgent.calculateDynamicDepreciation({ assetId, degradationPct });
      res.json({ message: 'Dynamic depreciation recorded', amount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/controlling/process-penalty', async (req, res) => {
    try {
      const { referenceId, amount } = req.body;
      const result = await controllingAgent.processPenalty(referenceId, amount);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => console.log(`[Finance] API & Heartbeat listening on port ${port}`));

  // Invänta händelser från bussen
  await pubsub.subscribe('traffic-events', 'finance-billing-sub', async (event) => {
    try {
      if (event.status === 'COMPLETED' && event.distanceKm) {
        await billingEngine.processTourCompletion(
          { tourId: event.tourId, line: event.lineId, distanceKm: event.distanceKm },
          { totalBoarding: 0 }
        );
      }
    } catch (err) {
      console.error('[Finance] Error handling billing event:', err);
    }
  });
}

start().catch(console.error);
