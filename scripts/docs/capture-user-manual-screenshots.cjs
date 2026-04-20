const {
  runCaptureUserManualScreenshotsCli,
  createCaptureUserManualScreenshotsRunner,
  fetchJson,
  resolveDocFixtures,
  stabilizePage,
  salesViewport,
} = require('./capture-user-manual-screenshots-lib.cjs');

module.exports = {
  runCaptureUserManualScreenshotsCli,
  createCaptureUserManualScreenshotsRunner,
  fetchJson,
  resolveDocFixtures,
  stabilizePage,
  salesViewport,
};

if (require.main === module) {
  runCaptureUserManualScreenshotsCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
