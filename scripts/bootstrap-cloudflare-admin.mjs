// Retire the old token-to-file procedure. Never silently map its --apply flag.
console.error('This bootstrap procedure is retired. Use npm run admin:recovery -- inspect and docs/SUPERADMIN_RECOVERY.md. No write was performed.');
process.exitCode=1;
