// API monetary values have two decimal places. Aggregate integer cents so
// repeated fractional simulations do not accumulate binary floating-point drift.
export const toCents = (value) => Math.round(Number(value || 0) * 100);

export function parseSimulationAmount(input) {
  if (!input.trim()) return { cents: 0, error: 'Enter an amount to explore your simulation.' };
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(input)) return { cents: 0, error: 'Use a number with no more than two decimal places.' };
  const [whole, fraction = ''] = input.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > 100000000) return { cents: 0, error: 'Choose an amount up to $1,000,000.' };
  if (cents <= 0) return { cents: 0, error: 'Your simulation amount must be greater than $0.' };
  return { cents, error: '' };
}

export function calculateSimulation(amountCents, expectedReturn) {
  const basisPoints = toCents(expectedReturn);
  // Positive-value half-up rounding mirrors the authoritative Django Decimal
  // calculation. The client only previews; saved profit comes from the server.
  const profitCents = Math.round(amountCents * basisPoints / 10000);
  return { profitCents, totalCents: amountCents + profitCents };
}

export function aggregatePortfolio(investments = []) {
  const categoryMap = new Map();
  const projectMap = new Map();
  let investedCents = 0;
  let profitCents = 0;
  let weightedBasisPoints = 0;

  investments.forEach((investment) => {
    const amount = toCents(investment.amount);
    const profit = toCents(investment.expected_profit);
    const category = investment.project.category || 'Other';
    investedCents += amount;
    profitCents += profit;
    weightedBasisPoints += amount * toCents(investment.expected_return_snapshot);
    categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    const existing = projectMap.get(investment.project.id) || {
      id: investment.project.id,
      name: investment.project.title,
      fullName: investment.project.title,
      investedCents: 0,
      estimatedCents: 0,
    };
    existing.investedCents += amount;
    existing.estimatedCents += amount + profit;
    projectMap.set(investment.project.id, existing);
  });

  return {
    invested: investedCents / 100,
    profit: profitCents / 100,
    value: (investedCents + profitCents) / 100,
    weighted: investedCents ? weightedBasisPoints / (investedCents * 100) : 0,
    projectCount: projectMap.size,
    categories: [...categoryMap.entries()].map(([name, value]) => ({ name, value: value / 100 })).sort((a, b) => b.value - a.value),
    projects: [...projectMap.values()].map((project) => ({
      id: project.id,
      name: project.name,
      fullName: project.fullName,
      invested: project.investedCents / 100,
      estimated: project.estimatedCents / 100,
    })),
  };
}
