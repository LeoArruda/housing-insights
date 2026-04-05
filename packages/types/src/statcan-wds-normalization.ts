import { z } from "zod";

/** One WDS vector data point (getData* responses). */
export const wdsVectorDataPointSchema = z.object({
  refPer: z.string(),
  value: z.number(),
  decimals: z.number().int().optional(),
});
export type WdsVectorDataPoint = z.infer<typeof wdsVectorDataPointSchema>;

/**
 * `object` payload for a SUCCESS row from getDataFromVectorsAndLatestNPeriods /
 * getDataFromCubePidCoordAndLatestNPeriods (StatCan WDS JSON API).
 */
export const wdsDataSuccessObjectSchema = z.object({
  responseStatusCode: z.number().int().optional(),
  productId: z.coerce.number().int(),
  vectorId: z.number().int().optional(),
  coordinate: z.string().optional(),
  vectorDataPoint: z.array(wdsVectorDataPointSchema).min(1),
});
export type WdsDataSuccessObject = z.infer<typeof wdsDataSuccessObjectSchema>;

/** Top-level array element before narrowing by `status`. */
export const wdsDataResponseRowSchema = z.object({
  status: z.string(),
  object: z.unknown(),
});
export type WdsDataResponseRow = z.infer<typeof wdsDataResponseRowSchema>;

/** Full WDS getData* JSON body as stored in `raw_payloads.body`. */
export const wdsGetDataResponseEnvelopeSchema = z.array(wdsDataResponseRowSchema);
export type WdsGetDataResponseEnvelope = z.infer<
  typeof wdsGetDataResponseEnvelopeSchema
>;

/** SQLite row: `statcan_wds_data_batch`. */
export const statcanWdsDataBatchRowSchema = z.object({
  id: z.number().int(),
  raw_payload_id: z.number().int(),
  product_id: z.number().int(),
  vector_id: z.number().int().nullable(),
  coordinate: z.string().nullable(),
  point_count: z.number().int(),
  created_at: z.string(),
});
export type StatcanWdsDataBatchRow = z.infer<typeof statcanWdsDataBatchRowSchema>;

/** SQLite row: `statcan_wds_data_observation`. */
export const statcanWdsDataObservationRowSchema = z.object({
  id: z.number().int(),
  batch_id: z.number().int(),
  raw_payload_id: z.number().int(),
  ref_per: z.string(),
  value: z.number(),
  decimals: z.number().int().nullable(),
});
export type StatcanWdsDataObservationRow = z.infer<
  typeof statcanWdsDataObservationRowSchema
>;

/** SQLite row: `statcan_wds_normalize_error`. */
export const statcanWdsNormalizeErrorRowSchema = z.object({
  id: z.number().int(),
  raw_payload_id: z.number().int(),
  message: z.string(),
  created_at: z.string(),
});
export type StatcanWdsNormalizeErrorRow = z.infer<
  typeof statcanWdsNormalizeErrorRowSchema
>;
