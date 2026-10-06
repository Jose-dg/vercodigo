import { cn } from '@/lib/utils';
import type { PurchaseTimeline } from '@/lib/codes/purchase-timeline';
import { TONE_STYLES, formatLongWhen } from './order-format';

/**
 * Vertical status list. Only reached states are listed; while the order is
 * open a trailing "en curso ahora" row pulses under the current step.
 */
export function StatusHistory({ timeline }: { timeline: PurchaseTimeline }) {
    const tone = TONE_STYLES[timeline.tone];
    const reached = timeline.steps.filter((step) => step.state !== 'pending');

    return (
        <ol className="space-y-0">
            {reached.map((step, index) => {
                const isCurrent = step.state === 'current';
                const isLast = index === reached.length - 1;
                const showConnector = !isLast || !timeline.isTerminal;
                return (
                    <li key={step.key} className="relative flex gap-3 pb-5">
                        {showConnector && (
                            <span
                                className={cn(
                                    'absolute left-[5px] top-4 h-[calc(100%-0.75rem)] w-0.5',
                                    isCurrent ? cn(tone.dot, 'opacity-40') : 'bg-border',
                                )}
                                aria-hidden
                            />
                        )}
                        <span
                            className={cn(
                                'relative mt-1 size-3 shrink-0 rounded-full',
                                step.state === 'done' && !isLast && 'bg-muted-foreground/60',
                                step.state === 'done' && isLast && tone.dot,
                                step.state === 'error' && 'bg-destructive',
                                isCurrent && tone.dot,
                            )}
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
                            <span className={cn('text-sm font-medium', step.state === 'error' && 'text-destructive')}>
                                {step.label}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {step.state === 'error' ? '—' : formatLongWhen(step.at)}
                            </span>
                        </div>
                    </li>
                );
            })}
            {!timeline.isTerminal && (
                <li className="relative flex gap-3">
                    <span className={cn('mt-1 size-3 shrink-0 animate-pulse rounded-full opacity-50', tone.dot)} />
                    <span className="text-sm text-muted-foreground">en curso ahora</span>
                </li>
            )}
        </ol>
    );
}
