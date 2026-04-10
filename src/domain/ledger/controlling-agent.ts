import { Knex } from 'knex';
import axios from 'axios';

/**
 * ControllingAgent - Ansvarar för intäktssäkring och viteshantering.
 */
export class ControllingAgent {
  constructor(private db: Knex, private trafficServiceUrl: string) {}

  /**
   * Hanterar en inkommande vitesnotering från SL.
   */
  async processPenalty(referenceId: string, amount: number) {
    console.log(`[ControllingAgent] Analyserar vite för ${referenceId} på ${amount} SEK...`);

    // 1. Fråga Traffic-domänen efter incident-loggar för denna tur
    let incidentReason = 'Normal delay';
    try {
      // Mock: I verkligheten anropar vi Traffic API
      // const trafficRes = await axios.get(`${this.trafficServiceUrl}/tours/${referenceId}/incidents`);
      // incidentReason = trafficRes.data.reason;
      
      // Simulerar Force Majeure för testet
      if (referenceId === 'TOUR-123') {
        incidentReason = 'Extreme weather / Road blocked by snow';
      }
    } catch (e) {
      console.warn(`[ControllingAgent] Kunde inte hämta data från Traffic för ${referenceId}`);
    }

    // 2. Utvärdera om vitet ska bestridas
    const isForceMajeure = incidentReason.toLowerCase().includes('weather') || incidentReason.toLowerCase().includes('police');
    const status = isForceMajeure ? 'DISPUTED' : 'APPROVED';

    let disputeDraft = '';
    if (isForceMajeure) {
      disputeDraft = `Bestridan av vite för ${referenceId}. Orsak: ${incidentReason}. Enligt avtalspunkt 4.2.1 (Force Majeure) ska vite ej utgå vid extrema väderförhållanden.`;
      console.log(`[ControllingAgent] 🛡️ Bestrider vite för ${referenceId}!`);
    }

    // 3. Spara i databasen
    await this.db('penalties').insert({
      reference_id: referenceId,
      amount,
      reason_code: isForceMajeure ? 'FORCE_MAJEURE' : 'OPERATIONAL',
      status,
      dispute_draft: disputeDraft
    });

    return { status, disputeDraft };
  }
}
