'use client';

import { Mail } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { RecipientsCsvInput, type RecipientsCsv } from './RecipientsCsvInput';

export type DeliveryRecipientDraft = { firstName: string; lastName: string; email: string };
export type RecipientMode = 'single' | 'csv';

/**
 * "Enviar al email de mi cliente": Diem emails the codes to this person and the
 * buyer still sees them in the portal.
 */
export function DeliveryRecipientFields({
    enabled,
    onEnabledChange,
    draft,
    onDraftChange,
    consent,
    onConsentChange,
    error,
    mode,
    onModeChange,
    csv,
    onCsvChange,
}: {
    mode: RecipientMode;
    onModeChange: (mode: RecipientMode) => void;
    csv: RecipientsCsv | null;
    onCsvChange: (csv: RecipientsCsv | null) => void;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    draft: DeliveryRecipientDraft;
    onDraftChange: (draft: DeliveryRecipientDraft) => void;
    consent: boolean;
    onConsentChange: (consent: boolean) => void;
    error: string | null;
}) {
    const showError = enabled && error && (draft.firstName || draft.email);
    return (
        <div className="mt-3 rounded-xl border px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
                <Checkbox
                    checked={enabled}
                    onCheckedChange={(value) => onEnabledChange(value === true)}
                    className="mt-0.5"
                />
                <span>
                    <span className="flex items-center gap-1.5 font-medium">
                        <Mail className="size-4" aria-hidden="true" />
                        Enviar los códigos al email de mi cliente
                    </span>
                    <span className="text-muted-foreground">
                        Diem le envía el correo con los códigos. Tú también los verás aquí.
                    </span>
                </span>
            </label>

            {enabled && (
                <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist">
                        {([['single', 'Un destinatario'], ['csv', 'Varios (CSV)']] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={mode === value}
                                onClick={() => onModeChange(value)}
                                className={cn(
                                    'min-h-10 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    mode === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {mode === 'csv' ? (
                        <RecipientsCsvInput value={csv} onChange={onCsvChange} />
                    ) : (
                    <>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="recipient-first-name">Nombre</Label>
                            <Input
                                id="recipient-first-name"
                                name="recipient-first-name"
                                autoComplete="off"
                                value={draft.firstName}
                                onChange={(event) => onDraftChange({ ...draft, firstName: event.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="recipient-last-name">Apellido</Label>
                            <Input
                                id="recipient-last-name"
                                name="recipient-last-name"
                                autoComplete="off"
                                value={draft.lastName}
                                onChange={(event) => onDraftChange({ ...draft, lastName: event.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="recipient-email">Email del cliente</Label>
                        <Input
                            id="recipient-email"
                            name="recipient-email"
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            spellCheck={false}
                            value={draft.email}
                            onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
                        />
                    </div>
                    {showError && <p className="text-sm text-destructive">{error}</p>}
                    </>
                    )}
                    <label className="flex cursor-pointer items-start gap-3 text-xs text-muted-foreground">
                        <Checkbox
                            checked={consent}
                            onCheckedChange={(value) => onConsentChange(value === true)}
                            className="mt-0.5"
                        />
                        <span>
                            {mode === 'csv' ? 'Confirmo que tengo autorización de estas personas' : 'Confirmo que tengo autorización de esta persona'}{' '}
                            para usar su nombre y email para entregarle los códigos. Revisa el email: el código no se puede recuperar
                            si se envía a una dirección equivocada.
                        </span>
                    </label>
                </div>
            )}
        </div>
    );
}
