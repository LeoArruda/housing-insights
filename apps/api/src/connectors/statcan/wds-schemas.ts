import { z } from "zod";

/** Single cube row from getAllCubesListLite (summary). */
export const cubeListItemSchema = z
  .object({
    productId: z.number(),
    cansimId: z.string().optional(),
    cubeTitleEn: z.string().optional(),
    cubeTitleFr: z.string().optional(),
    cubeStartDate: z.string().optional(),
    cubeEndDate: z.string().optional(),
    releaseTime: z.string().optional(),
    archived: z.union([z.string(), z.number()]).optional(),
    subjectCode: z.array(z.union([z.string(), z.number()])).optional(),
    surveyCode: z.array(z.union([z.string(), z.number()])).optional(),
    frequencyCode: z.number().optional(),
    corrections: z.array(z.unknown()).optional(),
    issueDate: z.string().optional(),
    dimensions: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type CubeListItem = z.infer<typeof cubeListItemSchema>;

const wdsEnvelopeSchema = z.object({
  status: z.string(),
  object: z.unknown().optional(),
});

export const getCubeMetadataResponseSchema = z.array(wdsEnvelopeSchema);

export const getDataResponseSchema = z.array(wdsEnvelopeSchema);
