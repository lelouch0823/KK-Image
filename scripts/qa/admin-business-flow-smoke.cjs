const {
  createAdminBusinessFlowSmokeRunner,
  createSeed,
  escapeCsv,
  createImportCsv,
  stabilizePage,
} = require('./admin-business-flow-smoke-lib.cjs');

module.exports = {
  createAdminBusinessFlowSmokeRunner,
  createSeed,
  escapeCsv,
  createImportCsv,
  stabilizePage,
};

if (require.main === module) {
  createAdminBusinessFlowSmokeRunner()
    .main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
