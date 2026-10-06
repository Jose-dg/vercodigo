'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PurchaseTimeline, TimelineStep } from '@/lib/codes/purchase-timeline';
import { TONE_STYLES, formatShortWhen } from './order-format';

function StepMarker({ step, toneDot }: { step: TimelineStep; toneDot: string }) {
    if (step.state === 'done') {
        return (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted-foreground/70 text-background">
                <Check className="size-4" strokeWidth={3} />
            </span>
        );
    }
    if (step.state === 'error') {
        return (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <X className="size-4" strokeWidth={3} />
            </span>
        );
    }
    if (step.state === 'current') {
        return (
            <span className="relative flex size-7 shrink-0 items-center justify-center">
                <span className={cn('absolute inset-0 animate-ping rounded-full opacity-40', toneDot)} />
                <span className={cn('relative flex size-7 items-center justify-center rounded-full', toneDot)}>
                    <span className="size-3 animate-spin rounded-full border-2 border-white/90 border-t-transparent" />
                </span>
            </span>
        );
    }
    return <span className="size-7 shrink-0 rounded-full border-2 border-muted-foreground/30" />;
}

export function OrderProgress({ timeline }: { timeline: PurchaseTimeline }) {
    const tone = TONE_STYLES[timeline.tone];
    // Start empty and grow on mount so the fill animates in.
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setWidth(timeline.progress * 100));
        return () => cancelAnimationFrame(frame);
    }, [timeline.progress]);

    return (
        <div className="space-y-4">
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        'h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out',
                        tone.bar,
                    )}
                    style={{ width: `${width}%` }}
                />
                {!timeline.isTerminal && (
                    <div
                        className="pointer-events-none absolute inset-y-0 w-24 animate-[order-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        style={{ left: `calc(${width}% - 6rem)` }}
                        aria-hidden
                    />
                )}
            </div>
            <ol className="grid grid-cols-3 gap-2">
                {timeline.steps.map((step) => (
                    <li key={step.key} className="flex min-w-0 items-start gap-2.5">
                        <StepMarker step={step} toneDot={tone.dot} />
                        <div className="min-w-0">
                            <p
                                className={cn(
                                    'truncate text-sm font-medium',
                                    step.state === 'pending' && 'text-muted-foreground',
                                    step.state === 'error' && 'text-destructive',
                                )}
                            >
                                {step.label}
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                                {step.state === 'current' ? 'en curso' : formatShortWhen(step.at)}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}
