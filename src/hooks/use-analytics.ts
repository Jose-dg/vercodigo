import useSWR, { SWRConfiguration } from 'swr';

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error('Failed to fetch analytics data');
    return r.json();
});

export function useAnalytics<T>(
    endpoint: string | null,
    params?: Record<string, any>,
    options?: SWRConfiguration
) {
    const queryString = params ? new URLSearchParams(
        Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null && v !== '')
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v.toString() }), {})
    ).toString() : '';

    const url = endpoint ? (queryString ? `${endpoint}?${queryString}` : endpoint) : null;

    return useSWR<T>(url, fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 30000, // 30 seconds
        ...options,
    });
}
