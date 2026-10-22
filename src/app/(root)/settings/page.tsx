"use client";

import { UserProfile } from "@clerk/nextjs";

/** Personal profile (name, email, password, linked accounts, sessions), owned by Clerk. */
export default function SettingsProfilePage() {
    return <UserProfile routing="hash" />;
}
