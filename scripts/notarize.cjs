// electron-builder afterSign hook — runs notarization asynchronously with
// visible progress, instead of letting electron-builder block silently on
// `notarytool submit --wait` for up to 24 hours.
//
// Flow:
//   1. Zip the signed .app (notarytool requires a zip, not a directory).
//   2. notarytool submit --no-wait → returns a submission ID immediately.
//   3. Poll `notarytool info <id>` every POLL_INTERVAL_MS, logging status
//      transitions and elapsed time on each tick.
//   4. On Accepted → staple the ticket onto the .app and return.
//   5. On Invalid/Rejected → dump the notarization log and fail the build.
//   6. On overall timeout → fail with the submission ID so it can be looked
//      up later (e.g. `xcrun notarytool log <id> ...`).

const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const POLL_INTERVAL_MS = 30 * 1000;
const MAX_WAIT_MS = 45 * 60 * 1000;

function log(msg) {
    process.stdout.write(`[notarize] ${msg}\n`);
}

function fmtElapsed(startMs) {
    const s = Math.floor((Date.now() - startMs) / 1000);
    return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, "0")}s`;
}

function notarytoolJson(args) {
    const out = execFileSync(
        "xcrun",
        ["notarytool", ...args, "--output-format", "json"],
        { encoding: "utf-8", maxBuffer: 16 * 1024 * 1024 }
    );
    return JSON.parse(out);
}

module.exports = async function notarize(context) {
    if (context.electronPlatformName !== "darwin") return;

    const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
    if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
        log("APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set — skipping notarization");
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(context.appOutDir, `${appName}.app`);
    const zipPath = path.join(context.appOutDir, `${appName}.zip`);

    if (!fs.existsSync(appPath)) {
        throw new Error(`expected signed .app at ${appPath}`);
    }

    const credArgs = [
        "--apple-id", APPLE_ID,
        "--password", APPLE_APP_SPECIFIC_PASSWORD,
        "--team-id", APPLE_TEAM_ID,
    ];

    log(`Zipping ${appName}.app for submission…`);
    execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", appPath, zipPath], { stdio: "inherit" });

    log(`Submitting to Apple notary service…`);
    const submitStart = Date.now();
    const submit = notarytoolJson(["submit", zipPath, ...credArgs, "--no-wait"]);
    const id = submit.id;
    if (!id) {
        throw new Error(`notarytool submit returned no id: ${JSON.stringify(submit)}`);
    }
    log(`Submission ID: ${id}`);

    let lastStatus = "";
    while (true) {
        if (Date.now() - submitStart > MAX_WAIT_MS) {
            throw new Error(
                `Notarization timeout after ${fmtElapsed(submitStart)} (submission ${id}). ` +
                `Check status with: xcrun notarytool info ${id} --apple-id ... --password ... --team-id ...`
            );
        }

        let info;
        try {
            info = notarytoolJson(["info", id, ...credArgs]);
        } catch (err) {
            // Transient notarytool failures (network blips) shouldn't kill the
            // build — log and keep polling.
            log(`info call failed (will retry): ${err.message}`);
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            continue;
        }

        const status = info.status || "Unknown";
        if (status !== lastStatus) {
            log(`Status: ${status} (elapsed: ${fmtElapsed(submitStart)})`);
            lastStatus = status;
        } else {
            // Keep emitting heartbeat lines so the GHA log shows progress
            // — even when Apple's status doesn't change for many minutes.
            log(`Still ${status} (elapsed: ${fmtElapsed(submitStart)})`);
        }

        if (status === "Accepted") {
            log(`Accepted. Stapling notarization ticket onto ${appName}.app…`);
            execFileSync("xcrun", ["stapler", "staple", appPath], { stdio: "inherit" });
            log(`Done. Total notarization time: ${fmtElapsed(submitStart)}`);
            try { fs.unlinkSync(zipPath); } catch { /* fine */ }
            return;
        }

        if (status === "Invalid" || status === "Rejected") {
            log(`Notarization failed with status: ${status}. Fetching log…`);
            try {
                execSync(
                    `xcrun notarytool log "${id}" --apple-id "${APPLE_ID}" --password "${APPLE_APP_SPECIFIC_PASSWORD}" --team-id "${APPLE_TEAM_ID}"`,
                    { stdio: "inherit" }
                );
            } catch (logErr) {
                log(`(couldn't fetch log: ${logErr.message})`);
            }
            throw new Error(`Notarization rejected by Apple (status: ${status}, submission ${id})`);
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
};
