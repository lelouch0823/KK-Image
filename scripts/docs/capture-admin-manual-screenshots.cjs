const {
  runCaptureAdminManualScreenshotsCli,
  createCaptureAdminManualScreenshotsRunner,
  routes,
  stabilizePage,
} = require('./capture-admin-manual-screenshots-lib.cjs');

module.exports = {
  runCaptureAdminManualScreenshotsCli,
  createCaptureAdminManualScreenshotsRunner,
  routes,
  stabilizePage,
};

if (require.main === module) {
  runCaptureAdminManualScreenshotsCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
