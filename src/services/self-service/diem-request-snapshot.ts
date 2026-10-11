import {
    parseCodeRequestCommand,
    type CodeRequestCommand,
} from "@/lib/devdiem/fulfillment";

/**
 * Returns the command to send to Diem, freezing it on first use.
 *
 * Diem hashes the full payload behind the Idempotency-Key. Rebuilding it on a
 * retry from live data (user name, store name, origin phone) would produce a
 * different hash and a permanent 409. The first processor persists the
 * command with a compare-and-set on "no snapshot yet"; every processor,
 * including concurrent ones, then sends whichever command won.
 */
export async function frozenCodeRequestCommand(params: {
    stored: unknown;
    build: () => CodeRequestCommand | Promise<CodeRequestCommand>;
    /** Persist only if no snapshot exists yet; returns rows written. */
    persistIfAbsent: (command: CodeRequestCommand) => Promise<number>;
    reload: () => Promise<unknown>;
}): Promise<CodeRequestCommand> {
    const existing = parseCodeRequestCommand(params.stored);
    if (existing) return existing;
    const built = await params.build();
    if (await params.persistIfAbsent(built)) return built;
    const winner = parseCodeRequestCommand(await params.reload());
    if (!winner) throw new Error("No se pudo congelar la solicitud a Diem");
    return winner;
}
