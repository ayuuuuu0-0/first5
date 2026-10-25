export async function startFocusTimer(minutes = 5) {
  let remainingSeconds = minutes * 60;

  process.stdout.write(`\n\x1b[36m⏱  5-Minute Rule:\x1b[0m Just write for 5 minutes. Momentum will take care of the rest.\n`);

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      remainingSeconds--;
      const mins = Math.floor(remainingSeconds / 60);
      const secs = String(remainingSeconds % 60).padStart(2, '0');

      process.stdout.write(`\r\x1b[90mFocus clock:\x1b[0m \x1b[33m${mins}:${secs}\x1b[0m remaining... (Ctrl+C to finish early) `);

      if (remainingSeconds <= 0) {
        clearInterval(interval);
        process.stdout.write(`\r\x1b[32m✔ 5 minutes completed!\x1b[0m Momentum has taken over. Keep coding.\n\n`);
        resolve();
      }
    }, 1000);

    process.on('SIGINT', () => {
      clearInterval(interval);
      process.stdout.write(`\n\x1b[32m✔ Checked out.\x1b[0m Nice job breaking the activation energy.\n\n`);
      process.exit(0);
    });
  });
}
