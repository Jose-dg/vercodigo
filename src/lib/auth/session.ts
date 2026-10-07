import { getAuthenticatedActor, requireAuthenticatedActor } from "./actor";
import type { AuthenticatedActor } from "./actor";

export async function getSessionUser(): Promise<AuthenticatedActor | null> {
    return getAuthenticatedActor();
}

export async function requireSessionUser(): Promise<AuthenticatedActor> {
    return requireAuthenticatedActor();
}
