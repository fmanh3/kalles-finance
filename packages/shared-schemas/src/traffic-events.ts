import { z } from 'zod';

export const TrafficTourCompletedSchema = z.object({
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  timestamp: z.string().datetime(),
  tourId: z.string(),
  line: z.string(),
  busId: z.string(),
  driverId: z.string(),
  distanceKm: z.number().positive(),
  status: z.literal('COMPLETED'),
});

export type TrafficTourCompleted = z.infer<typeof TrafficTourCompletedSchema>;
