import { z } from 'zod';

export const clinicSlugSchema = z.object({
  clinicSlug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
});

export const dentistSlugSchema = z.object({
  dentistSlug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
});

export const stateSlugSchema = z.object({
  stateSlug: z.string().min(2).max(50).regex(/^[a-z]+$/),
});

export const citySlugSchema = z.object({
  stateSlug: z.string().min(2).max(50).regex(/^[a-z]+$/),
  citySlug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
});

export const serviceSlugSchema = z.object({
  serviceSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export const reviewSubmissionSchema = z.object({
  clinicId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(2000),
  authorName: z.string().min(1).max(100).optional(),
  authorEmail: z.string().email().optional(),
});

export const bookingSubmissionSchema = z.object({
  clinicId: z.string().uuid(),
  patientName: z.string().min(1).max(100),
  patientEmail: z.string().email(),
  patientPhone: z.string().min(10).max(20),
  treatmentId: z.string().uuid().optional(),
  appointmentDate: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export const claimProfileSchema = z.object({
  clinicId: z.string().uuid().optional(),
  clinicName: z.string().min(1).max(200),
  clinicAddress: z.string().min(1).max(500),
  dentistName: z.string().min(1).max(100),
  dentistEmail: z.string().email(),
  dentistPhone: z.string().min(10).max(20),
  proofDocument: z.string().url().optional(),
});

export const listPracticeSchema = z.object({
  practiceName: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(50),
  zipCode: z.string().min(5).max(10),
  phone: z.string().min(10).max(20),
  email: z.string().email(),
  website: z.string().url().optional(),
  services: z.array(z.string()).optional(),
  description: z.string().max(2000).optional(),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(200),
  location: z.string().optional(),
  service: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
