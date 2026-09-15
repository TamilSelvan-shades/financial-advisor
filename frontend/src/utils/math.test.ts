import { describe, it, expect } from "vitest";
import { calculateAmortization, calculateTenure } from "./math";

describe("Loan Amortization Math Parity", () => {
  it("should calculate EMI and schedule correctly for a standard loan", () => {
    // 100k principal, 5% annual rate, 10 years
    const result = calculateAmortization(100000, 5, 10);
    
    // Monthly rate = 5 / 1200 = 0.00416666...
    // n = 120 months
    // Exact EMI should be ~1060.655
    expect(result.emi).toBeCloseTo(1060.655, 2);
    
    expect(result.schedule.length).toBe(120);
    // Final balance should be effectively zero
    expect(result.schedule[119].balance).toBe(0);
  });

  it("should handle 0% interest rate without dividing by zero", () => {
    const result = calculateAmortization(12000, 0, 1);
    expect(result.emi).toBe(1000); // 12k / 12 months
    expect(result.schedule.length).toBe(12);
    expect(result.schedule[11].balance).toBe(0);
  });

  it("should handle early prepayments terminating the loan faster", () => {
    // 100k principal, 5% annual rate, 10 years
    const standardResult = calculateAmortization(100000, 5, 10);
    
    // Add extra $500 monthly prepayment
    const fastResult = calculateAmortization(100000, 5, 10, 500);
    
    // Fast result should finish much sooner than 120 months
    expect(fastResult.schedule.length).toBeLessThan(standardResult.schedule.length);
    expect(fastResult.schedule.length).toBe(75); // Computed manually: ~75 months
    expect(fastResult.schedule[fastResult.schedule.length - 1].balance).toBe(0);
  });

  it("should return empty schedule if payments do not cover interest", () => {
    const result = calculateAmortization(1000000, 10, 10);
    // To trigger safety catch, we force negative extra payment larger than EMI - interest
    const maliciousResult = calculateAmortization(1000000, 10, 10, -result.emi);
    expect(maliciousResult.schedule.length).toBe(0);
  });

  it("should calculate correct logarithmic tenure", () => {
    // Principal 100k, 5% interest
    // Standard EMI for 10 years is ~1060.655
    const computedTenure = calculateTenure(100000, 5, 1060.655);
    expect(computedTenure).toBeCloseTo(10, 1); // Should be very close to 10 years
  });
});
