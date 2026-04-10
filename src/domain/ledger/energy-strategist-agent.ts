import { PubSub } from '@google-cloud/pubsub';

export interface SpotPrice {
  hour: number;
  price: number; // SEK/kWh
}

/**
 * EnergyStrategistAgent - CFO-agentens modul för energi-hedging.
 */
export class EnergyStrategistAgent {
  private pubsub: PubSub;

  constructor() {
    this.pubsub = new PubSub({ projectId: process.env.GOOGLE_CLOUD_PROJECT || 'joakim-hansson-lab' });
  }

  /**
   * Analyserar morgondagens priser och publicerar optimeringsorder.
   */
  async optimizeEnergyCosts(prices: SpotPrice[]) {
    console.log('[EnergyStrategist] Analyserar elpriser...');

    const morningPeak = prices.find(p => p.hour === 7)?.price || 0;
    const nightTrough = prices.find(p => p.hour === 2)?.price || 0;

    console.log(`[EnergyStrategist] Pris kl 02:00: ${nightTrough} SEK, Pris kl 07:00: ${morningPeak} SEK`);

    // Om morgonpriset är mer än dubbelt så dyrt som nattpriset -> Hedga!
    if (morningPeak > nightTrough * 2) {
      console.log('[EnergyStrategist] 📉 Prisskillnad identifierad. Beordrar nattladdning!');
      
      const strategy = {
        strategy: 'SPOT_PRICE_HEDGING',
        targetSoC: 100,
        startTime: new Date().toISOString().split('T')[0] + 'T02:00:00Z'
      };

      const dataBuffer = Buffer.from(JSON.stringify(strategy));
      await this.pubsub.topic('energy-optimization').publishMessage({ data: dataBuffer });
      
      return { action: 'OPTIMIZED', strategy };
    }

    return { action: 'NO_ACTION_REQUIRED' };
  }
}
