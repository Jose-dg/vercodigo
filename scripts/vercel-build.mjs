import { spawnSync } from "node:child_process";

function run(command, args) {
    const result = spawnSync(command, args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

run("prisma", ["generate"]);

if (process.env.VERCEL_ENV === "production") {
    run("prisma", ["migrate", "deploy"]);
} else {
    console.log(`[vercel-build] Skipping migrations for VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}.`);
}

run("next", ["build"]);
