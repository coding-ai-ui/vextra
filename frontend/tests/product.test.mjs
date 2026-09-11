import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePortfolio, calculateSimulation, parseSimulationAmount } from '../src/utils/portfolio.js';

const investment = (id, projectId, category, amount, rate, profit, title = `Project ${projectId}`) => ({
  id, amount, expected_return_snapshot: rate, expected_profit: profit,
  project: { id: projectId, title, category, expected_return: '99.00' },
});

test('the presentation simulation produces $150 profit and $1,150 total', () => {
  const amount = parseSimulationAmount('1000');
  assert.equal(amount.error, '');
  assert.deepEqual(calculateSimulation(amount.cents, '15.00'), { profitCents: 15000, totalCents: 115000 });
});

test('decimal input accepts cents and decimal shorthand without scientific notation', () => {
  assert.equal(parseSimulationAmount('12.29').cents, 1229);
  assert.equal(parseSimulationAmount('.50').cents, 50);
  assert.equal(parseSimulationAmount('1000.').cents, 100000);
  assert.equal(parseSimulationAmount('0.01').cents, 1);
  assert.equal(parseSimulationAmount('1000000.00').cents, 100000000);
  for (const invalid of ['', ' ', '0', '0.00', '-1', '1e3', 'Infinity', '1,000', '0.001', '1.234', '1000000.01', '999999999999999999999999']) {
    assert.notEqual(parseSimulationAmount(invalid).error, '', `${invalid} must fail validation`);
    assert.equal(parseSimulationAmount(invalid).cents, 0);
  }
});

test('preview rounds half a cent upward and handles fractional expected returns', () => {
  assert.deepEqual(calculateSimulation(10, '15.00'), { profitCents: 2, totalCents: 12 });
  assert.deepEqual(calculateSimulation(1, '15.00'), { profitCents: 0, totalCents: 1 });
  assert.deepEqual(calculateSimulation(123456, '12.35'), { profitCents: 15247, totalCents: 138703 });
  assert.deepEqual(calculateSimulation(100000000, '100.00'), { profitCents: 100000000, totalCents: 200000000 });
});

test('empty portfolios have usable zero metrics and no chart entries', () => {
  assert.deepEqual(aggregatePortfolio([]), { invested: 0, profit: 0, value: 0, weighted: 0, projectCount: 0, categories: [], projects: [] });
});

test('duplicate projects aggregate while expected return uses saved snapshots', () => {
  const result = aggregatePortfolio([
    investment(1, 1, 'Clean Energy', '1000.00', '15.00', '150.00'),
    investment(2, 1, 'Clean Energy', '500.00', '20.00', '100.00'),
    investment(3, 2, 'Technology', '1500.00', '10.00', '150.00'),
  ]);
  assert.equal(result.projectCount, 2);
  assert.equal(result.invested, 3000);
  assert.equal(result.profit, 400);
  assert.equal(result.value, 3400);
  assert.ok(Math.abs(result.weighted - 13.333333333333334) < 1e-10);
  assert.deepEqual(result.projects.map(({ id, invested, estimated }) => ({ id, invested, estimated })), [
    { id: 1, invested: 1500, estimated: 1750 }, { id: 2, invested: 1500, estimated: 1650 },
  ]);
  assert.deepEqual(result.categories, [{ name: 'Clean Energy', value: 1500 }, { name: 'Technology', value: 1500 }]);
});

test('portfolio totals add rounded persisted profits instead of recalculating them', () => {
  const result = aggregatePortfolio([
    investment(1, 1, 'Water', '0.10', '15.00', '0.02'),
    investment(2, 1, 'Water', '0.20', '15.00', '0.03'),
    investment(3, 1, 'Water', '0.10', '15.00', '0.02'),
  ]);
  assert.equal(result.invested, 0.4);
  assert.equal(result.profit, 0.07);
  assert.equal(result.value, 0.47);
  assert.equal(result.weighted, 15);
  assert.equal(result.projects[0].estimated, 0.47);
});

test('same-named projects stay distinct and category totals sort by allocation', () => {
  const result = aggregatePortfolio([
    investment(1, 1, 'Clean Energy', '250.00', '12.00', '30.00', 'An idea'),
    investment(2, 2, 'Water', '750.00', '16.00', '120.00', 'An idea'),
    investment(3, 3, 'Water', '100.00', '5.00', '5.00'),
  ]);
  assert.equal(result.projectCount, 3);
  assert.equal(result.projects.length, 3);
  assert.deepEqual(result.categories, [{ name: 'Water', value: 850 }, { name: 'Clean Energy', value: 250 }]);
});
