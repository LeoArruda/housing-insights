/** Statistics Canada WDS REST base ([WDS user guide](https://www.statcan.gc.ca/eng/developers/wds/user-guide)). */
export const WDS_REST_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

export const wdsPaths = {
  getAllCubesListLite: `${WDS_REST_BASE}/getAllCubesListLite`,
  getCubeMetadata: `${WDS_REST_BASE}/getCubeMetadata`,
  getDataFromCubePidCoordAndLatestNPeriods: `${WDS_REST_BASE}/getDataFromCubePidCoordAndLatestNPeriods`,
  getDataFromVectorsAndLatestNPeriods: `${WDS_REST_BASE}/getDataFromVectorsAndLatestNPeriods`,
  getChangedSeriesList: `${WDS_REST_BASE}/getChangedSeriesList`,
  getChangedCubeList: (isoDate: string) =>
    `${WDS_REST_BASE}/getChangedCubeList/${isoDate}`,
  getSeriesInfoFromCubePidCoord: `${WDS_REST_BASE}/getSeriesInfoFromCubePidCoord`,
  getSeriesInfoFromVector: `${WDS_REST_BASE}/getSeriesInfoFromVector`,
  getChangedSeriesDataFromCubePidCoord: `${WDS_REST_BASE}/getChangedSeriesDataFromCubePidCoord`,
  getChangedSeriesDataFromVector: `${WDS_REST_BASE}/getChangedSeriesDataFromVector`,
  getBulkVectorDataByRange: `${WDS_REST_BASE}/getBulkVectorDataByRange`,
  getFullTableDownloadCSV: (productId: number, lang: "en" | "fr") =>
    `${WDS_REST_BASE}/getFullTableDownloadCSV/${productId}/${lang}`,
  getFullTableDownloadSDMX: (productId: number) =>
    `${WDS_REST_BASE}/getFullTableDownloadSDMX/${productId}`,
} as const;
