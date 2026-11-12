'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Copy, Store } from 'lucide-react';

import { GuideRegion, GuideSteps, RedeemSiteLink } from '@/components/redeem/guide-sections';
import { localeTags, type Locale } from '@/lib/i18n/config';
import { getDictionary, regionLabel } from '@/lib/i18n/dictionaries';
import { guidePath, resolveGuide } from '@/lib/redeem-guides';

interface ScanResponse {
    success?: boolean;
    key?: string;
    product?: string;
    brand?: string;
    region?: string | null;
    amount?: number;
    currency?: string;
    scansRemaining?: number;
    error?: string;
    store?: { name: string; phone: string };
}

type ScanState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: ScanResponse }
    | { kind: 'not_activated'; data: ScanResponse }
    | { kind: 'limit' }
    | { kind: 'not_found' }
    | { kind: 'error' };

/** Maps the API answer to a page state; the API wording stays internal. */
function toState(status: number, data: ScanResponse): ScanState {
    if (status === 200 && data.success && data.key) return { kind: 'ready', data };
    if (status === 404) return { kind: 'not_found' };
    if (status === 403 && data.store) return { kind: 'not_activated', data };
    if (status === 403) return { kind: 'limit' };
    return { kind: 'error' };
}

const CODE_GROUP = 4;

function codeGroups(code: string): string[] {
    return code.match(new RegExp(`.{1,${CODE_GROUP}}`, 'g')) ?? [];
}

function formatAmount(locale: Locale, amount?: number, currency?: string) {
    if (amount == null || !currency) return null;
    try {
        return new Intl.NumberFormat(localeTags[locale], {
            style: 'currency',
            currency,
            maximumFractionDigits: currency === 'COP' ? 0 : 2,
        }).format(amount);
    } catch {
        return `${amount} ${currency}`;
    }
}

/**
 * What the end customer sees after scanning a card: the code first, then how
 * to redeem it. `locale` is negotiated on the server from Accept-Language.
 */
export function ScanView({ uuid, locale }: { uuid: string; locale: Locale }) {
    const [state, setState] = useState<ScanState>({ kind: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [copied, setCopied] = useState(false);
    const requested = useRef<number | null>(null);
    const dict = getDictionary(locale);

    useEffect(() => {
        // Each request counts one of the card's limited views: never fire twice
        // for the same attempt (React dev mode runs effects twice).
        if (requested.current === attempt) return;
        requested.current = attempt;
        fetch(`/api/qr/${encodeURIComponent(uuid)}`, { cache: 'no-store' })
            .then(async (res) => setState(toState(res.status, await res.json().catch(() => ({})))))
            .catch(() => setState({ kind: 'error' }));
    }, [uuid, attempt]);

    const retry = () => {
        setState({ kind: 'loading' });
        setAttempt((value) => value + 1);
    };

    const data = state.kind === 'ready' || state.kind === 'not_activated' ? state.data : null;
    const guide = useMemo(
        () => (data ? resolveGuide({ brand: data.brand, name: data.product }, locale) : null),
        [data, locale],
    );
    const region = regionLabel(locale, data?.region);
    const fullGuidePath = guide ? guidePath(guide, locale) : null;

    const code = state.kind === 'ready' ? (state.data.key ?? '').replace(/\s+/g, '') : '';

    const handleCopy = async () => {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard blocked: the code stays selectable on screen.
        }
    };

    return (
        <main className="redeem-page px-4 py-8 sm:py-12">
            <div className="mx-auto w-full max-w-md space-y-8">
                {state.kind === 'loading' && (
                    <div className="space-y-4" role="status" aria-label={dict.scan.loading}>
                        <div className="redeem-shimmer h-7 w-2/3 rounded-md" />
                        <div className="redeem-shimmer h-32 w-full rounded-2xl" />
                        <div className="redeem-shimmer h-11 w-full rounded-lg" />
                    </div>
                )}

                {state.kind === 'ready' && guide && (
                    <>
                        <header className="redeem-rise space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight">{state.data.product}</h1>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                {formatAmount(locale, state.data.amount, state.data.currency) && (
                                    <span className="font-medium text-foreground">
                                        {formatAmount(locale, state.data.amount, state.data.currency)}
                                    </span>
                                )}
                                {region && (
                                    <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                                        {dict.scan.regionBadge(region)}
                                    </span>
                                )}
                            </div>
                        </header>

                        <section
                            aria-labelledby="code-heading"
                            className="redeem-rise space-y-4 rounded-2xl border bg-card p-5 shadow-sm [animation-delay:80ms]"
                        >
                            <h2 id="code-heading" className="text-sm font-medium text-muted-foreground">
                                {dict.scan.yourCode}
                            </h2>
                            {/* Groups of 4 read better and give long codes places to wrap
                                on narrow phones; Copy always copies the code without spaces. */}
                            <p className="text-center font-mono text-2xl font-semibold leading-relaxed tracking-[0.12em]">
                                <span className="sr-only">{code}</span>
                                {codeGroups(code).map((group, groupIndex) => (
                                    <span key={groupIndex} aria-hidden="true" className="inline-block whitespace-nowrap px-1.5">
                                        {group.split('').map((char, charIndex) => {
                                            const index = groupIndex * CODE_GROUP + charIndex;
                                            return (
                                                <span
                                                    key={index}
                                                    className="redeem-char"
                                                    style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
                                                >
                                                    {char}
                                                </span>
                                            );
                                        })}
                                    </span>
                                ))}
                            </p>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border font-medium transition-colors hover:bg-muted"
                            >
                                {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                                <span aria-live="polite">{copied ? dict.scan.copied : dict.scan.copy}</span>
                            </button>
                            <RedeemSiteLink guide={guide} label={dict.scan.openRedeemSite} />
                            <p className="text-center text-xs leading-relaxed text-muted-foreground">
                                {dict.scan.keepItSafe}
                                {typeof state.data.scansRemaining === 'number' && state.data.scansRemaining >= 0 && (
                                    <> {dict.scan.scansLeft(state.data.scansRemaining)}</>
                                )}
                            </p>
                        </section>

                        <div className="redeem-rise space-y-8 [animation-delay:160ms]">
                            <GuideSteps guide={guide} heading={dict.scan.howToRedeem} />
                            <GuideRegion guide={guide} dict={dict} cardRegion={region} />
                            {fullGuidePath && (
                                <Link
                                    href={fullGuidePath}
                                    className="inline-block text-sm font-medium underline underline-offset-4"
                                >
                                    {dict.scan.fullGuide}
                                </Link>
                            )}
                        </div>
                    </>
                )}

                {state.kind === 'not_activated' && (
                    <StatusCard title={dict.scan.notActivatedTitle} body={dict.scan.notActivatedBody}>
                        {state.data.store && (
                            <div className="mt-4 flex items-start gap-3 rounded-lg bg-muted p-3 text-left text-sm">
                                <Store aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <p className="text-muted-foreground">{dict.scan.storeLabel}</p>
                                    <p className="font-medium">{state.data.store.name}</p>
                                    {state.data.store.phone && (
                                        <a href={`tel:${state.data.store.phone}`} className="underline underline-offset-4">
                                            {state.data.store.phone}
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </StatusCard>
                )}

                {state.kind === 'limit' && <StatusCard title={dict.scan.limitTitle} body={dict.scan.limitBody} />}
                {state.kind === 'not_found' && <StatusCard title={dict.scan.notFoundTitle} body={dict.scan.notFoundBody} />}
                {state.kind === 'error' && (
                    <StatusCard title={dict.scan.genericErrorTitle} body={dict.scan.genericErrorBody}>
                        <button
                            type="button"
                            onClick={retry}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border font-medium transition-colors hover:bg-muted"
                        >
                            {dict.scan.retry}
                        </button>
                    </StatusCard>
                )}
            </div>
        </main>
    );
}

function StatusCard({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
    return (
        <section className="redeem-rise rounded-2xl border bg-card p-6 text-center shadow-sm">
            <AlertCircle aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
            {children}
        </section>
    );
}
