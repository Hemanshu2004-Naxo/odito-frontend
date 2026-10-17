"use client"

import { useQuery } from '@tanstack/react-query';
import apiService from '@/lib/apiService';
import { queryKeys } from '@/lib/query/keys';

/**
 * useIssueContext
 *
 * Fetches the IssueContext for a specific issue + page URL.
 * Returns currentState, expectedState, and pageContext — no recommendation.
 *
 * @param {string} projectId
 * @param {string} issueId   — issue_code or rule_id
 * @param {string} pageUrl   — the specific page URL to resolve context for
 */
export function useIssueContext(projectId, issueId, pageUrl) {
  return useQuery({
    queryKey: queryKeys.issueContext.detail(projectId, issueId, pageUrl),
    queryFn: async () => {
      const response = await apiService.getIssueContext(projectId, issueId, pageUrl);
      if (!response.success) throw new Error(response.message || 'Failed to load issue context');
      return response.data;
    },
    enabled: Boolean(projectId && issueId && pageUrl),
    staleTime: 5 * 60 * 1000,   // 5 minutes — context is stable within a crawl cycle
    retry: 1,
  });
}
