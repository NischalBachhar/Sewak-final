// Production deploys require local reconciliation/Auth evidence, never an implicit
// Worker-name override from a connected build using the default staging config.
if(process.env.WORKERS_CI||process.env.WRANGLER_CI_MATCH_TAG||process.env.WRANGLER_CI_OVERRIDE_NAME){
 throw new Error('Automatic Workers Builds are disabled for Sewak. Use the reviewed deploy:cloudflare workflow with the explicit production config and QA gates.');
}
