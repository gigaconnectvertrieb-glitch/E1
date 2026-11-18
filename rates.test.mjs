import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeNumber, rankRates } from './rates.mjs';

test('parseDeNumber liest deutsche Beträge', () => {
  assert.equal(parseDeNumber('1.234,50 €'), 1234.5);
  assert.equal(parseDeNumber('31,40'), 31.4);
  assert.equal(parseDeNumber(150), 150);
});

test('nur 24 Monate Preisgarantie und ab 150 Euro Provision', () => {
  const { qualified, hidden, droppedGuarantee } = rankRates([
    { rate_id: 1, rate_name: 'Flex 1', provider_name: 'A', reseller_prov: '180,00', total_price_bonus: '800,00', opt_guarantee: '1' },
    { rate_id: 2, rate_name: 'Spar 24', provider_name: 'B', reseller_prov: '165,00', total_price_bonus: '1.120,00', opt_guarantee: '24' },
    { rate_id: 3, rate_name: 'Klein 24', provider_name: 'C', provision: '90', total_price: '1.000,00', opt_guarantee: 24 },
    { rate_id: 4, rate_name: 'Schutz 24', provider_name: 'D', provision: '240', total_price: '1.400,00', guarantee: '24 Monate' }
  ]);
  assert.equal(droppedGuarantee, 1);
  assert.equal(hidden, 1);
  assert.deepEqual(qualified.map((r) => r.name), ['Spar 24', 'Schutz 24']);
});

test('Provision in Cent wird auf Euro gesetzt', () => {
  const rows = [1, 2, 3, 4].map((i) => ({
    rate_id: i,
    rate_name: 'T' + i,
    reseller_prov: String(15000 + i * 1000),
    opt_guarantee: '24',
    total_price_bonus: String(1000 + i * 10)
  }));
  const { qualified } = rankRates(rows);
  assert.ok(qualified[0].provisionEuro < 500);
  assert.ok(qualified[0].provisionEuro >= 150);
});
