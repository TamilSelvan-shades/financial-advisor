export interface AmortizationRow {
  month: number;
  balance: number;
  cumulativeInterest: number;
}

export interface AmortizationResult {
  emi: number;
  schedule: AmortizationRow[];
}

/**
 * Calculates the amortization schedule mapping exact Python math parity.
 */
export function calculateAmortization(
  principal: number,
  annualRate: number,
  tenureYears: number,
  extraPayment: number = 0.0
): AmortizationResult {
  const r = annualRate / 12 / 100;
  const n = Math.round(tenureYears * 12);
  
  let emi = 0;
  if (r === 0) {
    emi = n > 0 ? principal / n : 0;
  } else {
    emi = n > 0 ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
  }

  const schedule: AmortizationRow[] = [];
  let balance = principal;
  let cumulativeInterest = 0.0;
  let month = 0;

  // Safety catch for infinite loop if extra payment isn't enough to cover interest
  if (emi + extraPayment <= balance * r) {
    return { emi, schedule: [] };
  }

  while (balance > 0.5 && month < 1200) {
    month += 1;
    const interestPayment = balance * r;
    let principalPayment = (emi - interestPayment) + extraPayment;
    
    if (balance - principalPayment < 0) {
      principalPayment = balance;
      balance = 0;
    } else {
      balance -= principalPayment;
    }
    
    cumulativeInterest += interestPayment;
    schedule.push({
      month,
      balance,
      cumulativeInterest
    });
  }
  
  return { emi, schedule };
}

/**
 * Calculates the required tenure in years given a target EMI (logarithmic).
 */
export function calculateTenure(
  principal: number,
  annualRate: number,
  emi: number
): number {
  const r = annualRate / 12 / 100;
  
  if (emi <= principal * r) {
    return 0; // Infinite or invalid
  }
  
  const nMonths = -Math.log(1 - (principal * r) / emi) / Math.log(1 + r);
  return nMonths / 12;
}
