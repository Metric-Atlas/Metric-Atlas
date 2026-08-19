import type { DataQualityFlag } from "@metric-atlas/connector-sdk";

/** GA4 runReport ResponseMetaData 중 flag 판정에 쓰는 부분 */
export interface Ga4ResponseMetadata {
  subjectToThresholding?: boolean | null | undefined;
  dataLossFromOtherRow?: boolean | null | undefined;
}

export function mapQualityFlags(input: {
  metadata: Ga4ResponseMetadata;
  /** 조회 종료일 (YYYY-MM-DD, Property timezone 기준 해석 결과) */
  endDate: string;
  now: Date;
  recentWindowHours: number;
}): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];

  // Spike §4 실측: false면 필드가 생략되므로 truthy 검사로 부재=false를 흡수한다
  if (input.metadata.subjectToThresholding === true) {
    flags.push("subject_to_thresholding");
  }
  if (input.metadata.dataLossFromOtherRow === true) {
    flags.push("other_row_data_loss");
  }

  // endDate는 날짜 단위이므로 그 날의 끝(23:59:59Z 근사)이 window 안이면 recent로 본다
  const windowStart = input.now.getTime() - input.recentWindowHours * 3_600_000;
  const endOfEndDate = new Date(`${input.endDate}T23:59:59Z`).getTime();
  if (endOfEndDate >= windowStart) {
    flags.push("recent_data_may_change");
  }

  return flags;
}
