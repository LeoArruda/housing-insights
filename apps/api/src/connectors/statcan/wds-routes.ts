/** Statistics Canada WDS REST base ([WDS user guide](https://www.statcan.gc.ca/eng/developers/wds/user-guide)). */
export const WDS_REST_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

export const wdsPaths = {
  getAllCubesListLite: `${WDS_REST_BASE}/getAllCubesListLite`,
  getCubeMetadata: `${WDS_REST_BASE}/getCubeMetadata`,
  getDataFromCubePidCoordAndLatestNPeriods: `${WDS_REST_BASE}/getDataFromCubePidCoordAndLatestNPeriods`,
  getDataFromVectorsAndLatestNPeriods: `${WDS_REST_BASE}/getDataFromVectorsAndLatestNPeriods`,
} as const;
