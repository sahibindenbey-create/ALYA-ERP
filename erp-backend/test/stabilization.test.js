const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('package.json ile package-lock temel bağımlılıkları uyumludur', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const locked = lock.packages[''].dependencies;
  for (const name of ['express', 'multer']) {
    assert.equal(pkg.dependencies[name], locked[name]);
  }
});

test('şirket bağlamı sabit şirket listesine bağlı değildir', () => {
  const source = read('company-context-hook.js');
  assert.doesNotMatch(source, /COMPANY_IDS/);
  assert.match(source, /Number\.isInteger\(id\) && id > 0/);
});

test('kritik migrationlar tekrar çalıştırılabilir korumalara sahiptir', () => {
  const sales = read('sql/014_SALES_FULFILLMENT_CHAIN.sql');
  const budget = read('sql/021_BUDGET_CASH_FORECAST_CHAIN.sql');
  assert.match(sales, /EXEC sys\.sp_executesql/);
  assert.match(budget, /name=N'IX_ButceKalemleri_Rapor'/);
  assert.match(budget, /name=N'IX_NakitTahminKalemleri_Tarih'/);
  for (const source of [sales, budget]) {
    assert.doesNotMatch(source, /DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM/i);
  }
});

test('Faz 9 backend kaydı ve arayüz yönlendirmesi mevcuttur', () => {
  assert.match(read('core/costingFlowRoutes.js'), /require\('\.\/budgetFlowRoutes'\)/);
  assert.match(read('../erp-frontend/src/pages/ModulePlaceholder.js'), /modulePath === "butce"/);
});
