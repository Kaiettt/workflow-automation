// @ts-check
async function main() {
  process.stdin.setEncoding('utf8');
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const collector = await import('./collector.ts');
  process.stdout.write(JSON.stringify(await collector.runHook(raw, process.argv.slice(2))) + '\n');
}
main().catch(() => {
  process.stderr.write('[ai-sessions] Hook could not load the collector; existing logs preserved.\n');
  process.stdout.write(JSON.stringify(process.argv.includes('claude') || process.argv.includes('cursor') ? {} : { decision: 'stop' }) + '\n');
  process.exitCode = 0;
});