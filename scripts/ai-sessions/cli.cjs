// @ts-check
import('./collector.ts').then(collector => collector.main(process.argv.slice(2))).catch((error) => {
  process.stderr.write('[ai-sessions] ' + String(error) + '\n');
  process.exitCode = 1;
});