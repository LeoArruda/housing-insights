import { z } from "zod";

/** Single cube row from getAllCubesListLite (summary). StatCan often sends explicit JSON `null` for optional fields; use `.nullish()` (not `.optional()` alone), which rejects only invalid types. */
export const cubeListItemSchema = z
  .object({
    productId: z.number(),
    cansimId: z.string().nullish(),
    cubeTitleEn: z.string().nullish(),
    cubeTitleFr: z.string().nullish(),
    cubeStartDate: z.string().nullish(),
    cubeEndDate: z.string().nullish(),
    releaseTime: z.string().nullish(),
    archived: z.union([z.string(), z.number()]).nullish(),
    subjectCode: z.array(z.union([z.string(), z.number()])).nullish(),
    surveyCode: z.array(z.union([z.string(), z.number()])).nullish(),
    frequencyCode: z.number().nullish(),
    corrections: z.array(z.unknown()).nullish(),
    issueDate: z.string().nullish(),
    dimensions: z.array(z.unknown()).nullish(),
  })
  .passthrough();

export type CubeListItem = z.infer<typeof cubeListItemSchema>;

const wdsEnvelopeSchema = z.object({
  status: z.string(),
  object: z.unknown().optional(),
});

export const getCubeMetadataResponseSchema = z.array(wdsEnvelopeSchema);

export const getDataResponseSchema = z.array(wdsEnvelopeSchema);
