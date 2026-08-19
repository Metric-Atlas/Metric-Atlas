import type {
  AnalyticsConnector,
  ConnectorContext,
  NormalizedAnalyticsResult,
  ProviderAgnosticQuery,
} from "@metric-atlas/connector-sdk";

/** docs/06 §9 fingerprint: provider + propertyId + eventName + dateRange + metric + dimensions(breakdowns) + filters. */
function fingerprint(context: ConnectorContext, query: ProviderAgnosticQuery): string {
  return JSON.stringify({
    provider: context.provider,
    propertyId: context.propertyId,
    eventName: query.eventName,
    metric: query.metric,
    dateRange: query.dateRange,
    comparisonRange: query.comparisonRange ?? null,
    breakdowns: query.breakdowns ?? [],
    filters: query.filters ?? {},
  });
}

/**
 * resultStatus별로 캐시 여부를 가른다: ok/no_rows/unsupported는 같은 쿼리를 다시 던져도
 * 같은 값이 나올 것으로 기대되는 결정론적 결과라 캐시한다. unauthorized/error는 credential
 * 재설정이나 일시 장애처럼 곧 바뀔 수 있는 상태라 캐시하지 않고 매번 재시도되게 둔다.
 */
function isCacheable(result: NormalizedAnalyticsResult): boolean {
  return result.resultStatus === "ok" || result.resultStatus === "no_rows" || result.resultStatus === "unsupported";
}

export interface CachedAnalyticsConnector extends AnalyticsConnector {
  /** 특정 쿼리의 캐시만 무효화한다 (docs/06 §9 "Manual refresh"). */
  invalidate(context: ConnectorContext, query: ProviderAgnosticQuery): void;
  /** 전체 캐시를 비운다. */
  clear(): void;
}

export interface CacheOptions {
  ttlSeconds: number;
  /** 테스트 주입용. 기본은 실제 시각. */
  now?: () => Date;
}

/**
 * TTL 캐시 + in-flight 요청 중복 제거로 AnalyticsConnector를 감싼다 (docs/06 §9).
 * 순수 in-memory 구현이라 Runtime 재시작 시 자연히 폐기된다 — 별도 처리 불필요.
 */
export function withCache(connector: AnalyticsConnector, options: CacheOptions): CachedAnalyticsConnector {
  const store = new Map<string, { expiresAt: number; result: NormalizedAnalyticsResult }>();
  const inFlight = new Map<string, Promise<NormalizedAnalyticsResult>>();

  const nowMs = () => (options.now?.() ?? new Date()).getTime();

  return {
    testConnection: (context) => connector.testConnection(context),
    capabilities: () => connector.capabilities(),
    // listObservedEventNames는 GA4-only 판정에서 property당 드물게 호출될 것으로 예상돼
    // 아직 캐시 대상에 넣지 않았다. 호출 빈도가 늘면 query()와 같은 방식으로 캐시를 추가한다.
    listObservedEventNames: (context, dateRange) => connector.listObservedEventNames(context, dateRange),

    async query(context, query) {
      const key = fingerprint(context, query);

      const cached = store.get(key);
      if (cached && cached.expiresAt > nowMs()) return cached.result;

      const pending = inFlight.get(key);
      if (pending) return pending;

      const promise = connector
        .query(context, query)
        .then((result) => {
          inFlight.delete(key);
          if (isCacheable(result)) {
            store.set(key, { expiresAt: nowMs() + options.ttlSeconds * 1000, result });
          }
          return result;
        })
        .catch((error: unknown) => {
          inFlight.delete(key);
          throw error;
        });

      inFlight.set(key, promise);
      return promise;
    },

    invalidate(context, query) {
      store.delete(fingerprint(context, query));
    },

    clear() {
      store.clear();
    },
  };
}
