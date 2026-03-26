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

// Trafiklab / APC (Automatic Passenger Counting) Event
export const ApcEventSchema = z.object({
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  timestamp: z.string().datetime(),
  vehicleRef: z.string(),     // Ex: "BUSS-101"
  journeyRef: z.string(),     // Ex: "TOUR-1234" (tourId)
  lineRef: z.string(),        // Ex: "676"
  stopPointRef: z.string(),   // Ex: "STOP-NORRTALJE"
  boarding: z.number().int().nonnegative(),
  alighting: z.number().int().nonnegative(),
  occupancy: z.number().int().nonnegative(),
});

export type ApcEvent = z.infer<typeof ApcEventSchema>;

