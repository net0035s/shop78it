// HISTORICAL audit evidence: asserts the OLD vulnerabilities. For fixed behavior run npm test.
// Read-only audit harness: application source executes against in-memory doubles.
// No real database, environment files, network, payment, email or Telegram access.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const evidence = [];
const json = (body, init) => Response.json(body, init);
const identity = x => x;
const common = {
  'next/server': { NextResponse: { json } },
  '@/lib/json-response': { jsonUtf8: json },
  '@/lib/utils': { generateOrderNumber: () => 'SA-AUDIT-FIXTURE' },
  '@/lib/money': { moneyToNumber: Number, normalizeProductMoney: identity },
  '@/lib/encryption': { decryptText: identity, encryptText: identity, decryptDeliveryItemFields: identity, encryptDeliveryItemFields: identity },
  '@/lib/admin-auth': { requireAdmin: async () => ({ authorized: true }) },
  '@/lib/mailer': { sendOrderReceiptEmail: async () => {} },
  '@/lib/telegram': { sendTelegramNotify: async () => {} },
};
function load(file, modules = {}, extra = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  const allowed = { ...common, ...modules };
  vm.runInNewContext(output, {
    exports, require(id) { if (!(id in allowed)) throw new Error('Unmocked import: ' + id); return allowed[id]; },
    Request, Response, URL, FormData, File, Date, console: { log() {}, warn() {}, error() {} },
    process: { env: { CRON_SECRET: 'audit-fixture', PROMPTPAY_NUMBER: '0000000000', TMN_RECEIVE_PHONE: '0800000000' } },
    fetch: async () => { throw new Error('Network prohibited in audit'); }, ...extra,
  }, { filename: file });
  return exports;
}
const dbModule = (db) => ({ __esModule: true, default: db, syncProductStock: async () => {} });
const request = (body) => new Request('http://audit.local/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const product = (id = 'p1', overrides = {}) => ({ id, name: 'Synthetic product', description: 'Audit only', price: 100, stock: 1, category: 'eligible', categoryId: null, deliveryType: 'manual', ...overrides });
const baseOrder = (overrides = {}) => ({ id: 'o1', orderNumber: 'SA-AUDIT-FIXTURE', customerName: 'Audit fixture', customerEmail: 'audit@example.invalid', total: 100, status: 'paid', createdAt: new Date(), deliveryItems: [], orderItems: [], claimedStocks: [], ...overrides });
async function test(name, fn) { const result = await fn(); evidence.push({ name, observed: result }); console.log('REPRODUCED: ' + name + ' — ' + result); }
async function main() {
  await test('Public order lookup, duplicate delivery, mutable purchase price, omitted instruction flag', async () => {
    const delivery = { type: 'license-key', productName: 'Synthetic product', licenseKey: 'SYNTHETIC-KEY', showInstruction: false };
    const order = baseOrder({ status: 'completed', deliveryItems: [delivery], orderItems: [{ product: product('p1', { price: 200 }), price: 100, quantity: 1 }], claimedStocks: [{ type: 'license-key', product: product(), content: JSON.stringify({ licenseKey: 'SYNTHETIC-KEY' }) }] });
    const route = load('src/app/api/orders/route.ts', { '@/lib/db': dbModule({ order: { findUnique: async () => order } }) });
    const response = await route.GET(new Request('http://audit.local/api/orders?orderNumber=SA-AUDIT-FIXTURE'));
    const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.data.customer.email, 'audit@example.invalid');
    assert.equal(result.data.deliveryItems.length, 2); assert.equal(result.data.deliveryItems[0].licenseKey, 'SYNTHETIC-KEY');
    assert.equal(result.data.items[0].product.price, 200); assert.equal(result.data.deliveryItems[0].showInstruction, undefined);
    return 'unauthenticated 200 with synthetic customer/key; one key appears twice; historical 100 becomes 200; false flag absent';
  });
  let created;
  const products = [product('p1'), product('p2', { price: 900, category: 'excluded' })];
  let coupon = null;
  const db = { product: { findUnique: async ({ where }) => products.find(p => p.id === where.id) }, discountCode: { findUnique: async () => coupon }, category: { findUnique: async () => ({ slug: 'eligible' }) }, order: { create: async ({ data }) => { created = data; return { ...data, createdAt: new Date() }; } } };
  const orders = load('src/app/api/orders/route.ts', { '@/lib/db': dbModule(db) });
  await test('Duplicate product rows exceed stock', async () => {
    const result = await (await orders.POST(request({ items: [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 1 }], customer: { name: 'Audit', email: 'audit@example.invalid' } }))).json();
    assert.equal(result.success, true); assert.equal(created.orderItems.create.reduce((sum, item) => sum + item.quantity, 0), 2);
    return 'stock 1 accepts quantity 2 split over two rows';
  });
  await test('Malformed customer email accepted', async () => {
    await orders.POST(request({ items: [{ productId: 'p1', quantity: 1 }], customer: { name: '   ', email: 'invalid-email' } }));
    assert.equal(created.customerEmail, 'invalid-email'); assert.equal(created.customerName, '   ');
    return 'server creates order with whitespace name and invalid-email';
  });
  await test('Category coupon discounts excluded items', async () => {
    coupon = { code: 'AUDIT', isActive: true, maxUses: null, usedCount: 0, minPurchaseAmount: 0, applicableCategoryId: 'cat1', discountType: 'PERCENT', discountValue: 50 };
    await orders.POST(request({ items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }], customer: { name: 'Audit', email: 'audit@example.invalid' }, discountCode: 'AUDIT' }));
    assert.equal(created.discountAmount, 500);
    return '50% coupon on eligible 100 plus excluded 900 deducts 500, rather than 50';
  });
  await test('Zero-total order has no payment path', async () => {
    coupon.discountValue = 100;
    await orders.POST(request({ items: [{ productId: 'p1', quantity: 1 }], customer: { name: 'Audit', email: 'audit@example.invalid' }, discountCode: 'AUDIT' }));
    assert.equal(created.total, 0); assert.equal(created.status, 'pending');
    const pay = load('src/app/api/payment/promptpay/route.ts', { '@/lib/db': dbModule({ order: { findFirst: async () => created } }), 'promptpay-qr': () => 'mock' });
    const response = await pay.POST(request({ orderId: created.orderNumber })); assert.equal(response.status, 400);
    return '100% coupon creates pending total 0; QR payment rejects it';
  });
  await test('Manual fulfillment never decrements stock', async () => {
    let updates = 0;
    const order = baseOrder({ orderItems: [{ product: product(), quantity: 1 }] });
    const fulfillment = load('src/lib/order-fulfillment.ts', { '@/lib/db': dbModule({ order: { findFirst: async () => order, update: async ({ data }) => ({ ...order, ...data, deliveryItems: [] }) }, product: { update: async () => { updates++; } } }) });
    const result = await fulfillment.fulfillPaidOrder('o1');
    assert.equal(result.status, 'needs_manual_delivery'); assert.equal(updates, 0);
    return 'paid manual order reaches delivery queue with no inventory update';
  });
  await test('Concurrent fulfillment consumes multiple keys for one order', async () => {
    const order = baseOrder({ orderItems: [{ product: product('p1', { deliveryType: 'auto' }), quantity: 1 }] });
    const available = ['key1', 'key2', 'key3'].map(id => ({ id, type: 'license-key', content: JSON.stringify({ licenseKey: 'SYNTHETIC-' + id }) }));
    const delivered = [];
    const db = {
      order: { findFirst: async () => ({ ...order }), update: async ({ data }) => { delivered.push(...data.deliveryItems.create); return { ...order, ...data, deliveryItems: [...delivered] }; } },
      digitalStock: { count: async () => available.length },
      $transaction: async fn => fn({ digitalStock: { findMany: async ({ take }) => available.splice(0, take), updateMany: async ({ where }) => ({ count: where.id.in.length }) } }),
    };
    const fulfillment = load('src/lib/order-fulfillment.ts', { '@/lib/db': dbModule(db) });
    await Promise.all([fulfillment.fulfillPaidOrder('o1'), fulfillment.fulfillPaidOrder('o1')]);
    assert.equal(delivered.length, 2); assert.equal(available.length, 1);
    return 'two overlapping calls for a quantity-1 order create two delivery records with different keys (simulated interleaving)';
  });
  await test('Storefront hides manual stock', async () => {
    const jsx = (type, props) => ({ type, props });
    const storefront = load('src/app/page.tsx', {
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
      'lucide-react': {}, 'next/link': 'link', '@/components/Translate': { Translate: 'translate' },
      '@/components/product/ProductGrid': { ProductGrid: 'PRODUCT_GRID' },
      '@/lib/db': dbModule({ product: { findMany: async () => [product('p1', { stock: 5, _count: { digitalStocks: 0 } })] }, orderItem: { groupBy: async () => [] }, category: { findMany: async () => [] } }),
    });
    const tree = await storefront.default();
    function find(node) { if (!node || typeof node !== 'object') return null; if (node.type === 'PRODUCT_GRID') return node; for (const child of Object.values(node)) { const result = find(child); if (result) return result; } return null; }
    const grid = find(tree); assert.equal(grid.props.products[0].stock, 0); assert.equal(grid.props.products[0].stockStatus, 'out-of-stock');
    return 'manual product with stock 5 and no digital keys renders stock 0 and out-of-stock';
  });
  await test('Stock import breaks HTTPS URL', async () => {
    let inserted;
    const stock = load('src/app/api/admin/stock/route.ts', { '@/lib/db': dbModule({ product: { findUnique: async () => product() }, digitalStock: { createMany: async ({ data }) => { inserted = data; }, count: async () => 1 } }) });
    await stock.POST(request({ productId: 'p1', type: 'login-info', bulkData: 'audit@example.invalid|fixture-password|https://example.invalid/login' }));
    assert.equal(JSON.parse(inserted[0].content).loginUrl, 'https');
    return 'email|password|https://example.invalid/login is stored with loginUrl=https';
  });
  await test('Cron can restore inventory of an order paid after selection', async () => {
    let restored = false;
    const cron = load('src/app/api/cron/clear-unpaid/route.ts', { '@/lib/db': dbModule({ order: { findMany: async () => [{ id: 'o1', orderNumber: 'SA-AUDIT', claimedStocks: [], digitalKeys: [] }] }, $transaction: async fn => fn({ digitalStock: { updateMany: async () => { restored = true; return { count: 1 }; } }, digitalKey: { updateMany: async () => ({ count: 0 }) }, order: { updateMany: async () => ({ count: 0 }) } }) }) });
    const response = await cron.GET(new Request('http://audit.local/cron', { headers: { Authorization: 'Bearer audit-fixture' } }));
    const result = await response.json(); assert.equal(restored, true); assert.equal(result.cancelledCount, 0); assert.equal(result.restoredDigitalStockCount, 1);
    return 'stale pending selection returns 0 orders cancelled but 1 sold stock restored';
  });
  await test('TrueMoney redemption survives failed order write without recovery', async () => {
    let redeemed = false, fulfilled = false;
    const payment = load('src/app/api/payment/truemoney/route.ts', {
      '@/lib/db': dbModule({ order: { findFirst: async () => baseOrder({ status: 'pending', orderItems: [{}] }), update: async () => { throw new Error('simulated database outage'); } } }),
      '@prakrit_m/tmn-voucher': async () => { redeemed = true; return { success: true, amount: 10000 }; },
      '@/lib/order-fulfillment': { fulfillPaidOrder: async () => { fulfilled = true; } },
    }, { fetch: async () => Response.json({ status: { code: 'SUCCESS' }, data: { voucher: { amount_baht: '100', member: 1 } } }) });
    const response = await payment.POST(request({ orderId: 'o1', voucherLink: 'AUDITONLYVOUCHER123' }));
    assert.equal(redeemed, true); assert.equal(fulfilled, false); assert.equal(response.status, 500);
    return 'money mock redeemed, first order update fails, returns 500 without fulfillment/recovery';
  });
  console.log(JSON.stringify({ reproduced: evidence.length, evidence }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
