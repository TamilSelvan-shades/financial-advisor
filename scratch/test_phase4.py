"""
scratch/test_phase4.py - Automated Verification Suite for Phase 4: Wealth Mastery & Autonomous Financial Agent
Validates:
  1. Indian Income Tax Regime Optimization Engine (Old vs New, slabs, 87A rebate edge cases, HRA, break-even)
  2. Weekly Executive Financial Briefing (Cash velocity, Category leak analyzer, 7-day horizon, HTML generator)
  3. Autonomous Financial Agent ("Ghost Accountant", Auto-sweep, Budget guardrails, Micro-savings round-ups)
  4. FastAPI Endpoints integration
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
import json
from database import SessionLocal, engine
import models
import tax_engine
import executive_digest
import autonomous_agent
from fastapi.testclient import TestClient
from main import app
import auth

print("=" * 70)
print("🚀 STARTING PHASE 4 VERIFICATION SUITE")
print("=" * 70)

# ----------------------------------------------------------------------
# 1. TAX ENGINE VERIFICATION
# ----------------------------------------------------------------------
print("\n[1/4] Testing Indian Income Tax Regime Optimization Engine...")

# Test 1A: ₹12 Lakhs Income, ₹2.5L deductions (80C: 1.5L, 80D: 25k, NPS: 50k)
res_12l = tax_engine.calculate_tax_comparison(
    gross_salary=1200000.0,
    basic_salary=600000.0,
    section_80c=150000.0,
    section_80d_self=25000.0,
    section_80ccd_1b=50000.0,
)
print(f"  • Gross ₹12L Test:")
print(f"    - Old Regime Tax: ₹{res_12l['old_regime']['net_tax_payable']:,.2f} (Effective: {res_12l['old_regime']['effective_tax_rate']}%)")
print(f"    - New Regime Tax: ₹{res_12l['new_regime']['net_tax_payable']:,.2f} (Effective: {res_12l['new_regime']['effective_tax_rate']}%)")
print(f"    - Recommendation: {res_12l['recommendation_title']}")
print(f"    - Break-Even Deduction Gap: ₹{res_12l['break_even']['deduction_gap']:,.2f}")
assert res_12l["recommended_regime"] == "new", "Expected New Regime to be optimal for 12L with standard deductions"
assert res_12l["new_regime"]["net_tax_payable"] == 71500.0, f"Expected New Regime Tax 71,500, got {res_12l['new_regime']['net_tax_payable']}"
assert res_12l["old_regime"]["net_tax_payable"] == 101400.0, f"Expected Old Regime Tax 101,400, got {res_12l['old_regime']['net_tax_payable']}"
assert res_12l["savings_amount"] == 29900.0, f"Expected savings 29,900, got {res_12l['savings_amount']}"

# Test 1B: Section 87A Rebate in New Regime (Gross ₹7.75L -> Taxable ₹7.0L -> Tax ₹0)
res_87a_new = tax_engine.calculate_tax_comparison(gross_salary=775000.0)
print(f"\n  • Section 87A New Regime Edge Case (Gross ₹7.75L):")
print(f"    - Taxable Income: ₹{res_87a_new['new_regime']['taxable_income']:,.2f}")
print(f"    - Base Tax: ₹{res_87a_new['new_regime']['base_tax']:,.2f}")
print(f"    - 87A Rebate: ₹{res_87a_new['new_regime']['section_87a_rebate']:,.2f}")
print(f"    - Net Tax Payable: ₹{res_87a_new['new_regime']['net_tax_payable']:,.2f}")
assert res_87a_new["new_regime"]["net_tax_payable"] == 0.0, "Expected ₹0 tax under New Regime for taxable <= 7L"
assert res_87a_new["new_regime"]["section_87a_rebate"] == 20000.0, "Expected ₹20,000 rebate"

# Test 1C: Section 87A Rebate in Old Regime (Gross ₹5.5L -> Taxable ₹5.0L -> Tax ₹0)
res_87a_old = tax_engine.calculate_tax_comparison(gross_salary=550000.0)
print(f"\n  • Section 87A Old Regime Edge Case (Gross ₹5.5L):")
print(f"    - Taxable Income: ₹{res_87a_old['old_regime']['taxable_income']:,.2f}")
print(f"    - Base Tax: ₹{res_87a_old['old_regime']['base_tax']:,.2f}")
print(f"    - 87A Rebate: ₹{res_87a_old['old_regime']['section_87a_rebate']:,.2f}")
print(f"    - Net Tax Payable: ₹{res_87a_old['old_regime']['net_tax_payable']:,.2f}")
assert res_87a_old["old_regime"]["net_tax_payable"] == 0.0, "Expected ₹0 tax under Old Regime for taxable <= 5L"
assert res_87a_old["old_regime"]["section_87a_rebate"] == 12500.0, "Expected ₹12,500 rebate"

# Test 1D: HRA Exemption Math
hra_calc = tax_engine.calculate_hra_exemption(
    basic_salary=600000.0,
    hra_received=240000.0,
    rent_paid=200000.0,
    is_metro=True,
)
print(f"\n  • HRA Exemption Test (Basic ₹6L, HRA ₹2.4L, Rent ₹2L, Metro):")
print(f"    - Actual HRA: ₹{hra_calc['actual_hra']:,.2f}")
print(f"    - Rent - 10% Basic: ₹{hra_calc['rent_minus_10pct']:,.2f}")
print(f"    - 50% Basic (Metro): ₹{hra_calc['salary_pct_limit']:,.2f}")
print(f"    - Exemption (Min): ₹{hra_calc['exemption']:,.2f}")
print(f"    - Taxable HRA: ₹{hra_calc['taxable_hra']:,.2f}")
assert hra_calc["exemption"] == 140000.0, f"Expected HRA Exemption ₹1,40,000, got {hra_calc['exemption']}"
assert hra_calc["taxable_hra"] == 100000.0, f"Expected Taxable HRA ₹1,00,000, got {hra_calc['taxable_hra']}"

print("  ✅ All Tax Engine tests PASSED!")

# ----------------------------------------------------------------------
# 2. EXECUTIVE BRIEFING ENGINE VERIFICATION
# ----------------------------------------------------------------------
print("\n[2/4] Testing Weekly Executive Financial Briefing Engine...")
db = SessionLocal()
user = db.query(models.User).filter(models.User.is_active == True).first()
assert user is not None, "No active user found in database!"
tenant_id = str(user.id)

briefing = executive_digest.generate_weekly_executive_briefing(db, tenant_id)
print(f"  • Briefing Date: {briefing['briefing_date']} ({briefing['date_range']})")
print(f"  • Cash Velocity: Inflow=₹{briefing['cash_velocity']['weekly_inflow']:,.2f}, Outflow=₹{briefing['cash_velocity']['weekly_outflow']:,.2f}, Net=₹{briefing['cash_velocity']['net_weekly_cashflow']:,.2f} ({briefing['cash_velocity']['status']})")
print(f"  • Category Leaks: {briefing['category_leaks']['leak_count']} flagged")
if briefing['category_leaks']['leaks']:
    for l in briefing['category_leaks']['leaks'][:2]:
        print(f"    - Leak: {l['category']} (Spend: ₹{l['current_7d_spend']:,.0f}, +{l['surge_pct']:.0f}% over baseline)")
print(f"  • 7-Day Horizon: Liquid Buffer=₹{briefing['upcoming_horizon']['current_liquid_balance']:,.2f}, Projected Net=₹{briefing['upcoming_horizon']['projected_7d_liquidity']:,.2f}")
print(f"  • AI Pro-Tip: \"{briefing['ai_pro_tip']}\"")

# Test HTML Report Generation
html = executive_digest.generate_executive_report_html(briefing)
assert "<!DOCTYPE html>" in html, "HTML report missing DOCTYPE"
assert "Sunday Executive Briefing" in html, "HTML report missing header"
assert "AI Executive Pro-Tip of the Week" in html, "HTML report missing Pro-Tip box"
print("  • HTML Executive Report rendered successfully (Length: " + str(len(html)) + " bytes)")
print("  ✅ Executive Briefing Engine tests PASSED!")

# ----------------------------------------------------------------------
# 3. AUTONOMOUS FINANCIAL AGENT VERIFICATION
# ----------------------------------------------------------------------
print("\n[3/4] Testing Autonomous Financial Agent Engine...")
agent_res = autonomous_agent.run_autonomous_agent_cycle(db, tenant_id)
print(f"  • Agent Evaluated At: {agent_res['evaluated_at']}")
print(f"  • Liquid Balance: ₹{agent_res['liquid_balance']:,.2f}")
print(f"  • Auto-Sweep: Surplus=₹{agent_res['auto_sweep']['surplus_amount']:,.2f}, Yield Gain=₹{agent_res['auto_sweep']['annual_yield_gain']:,.2f}/yr")
print(f"  • Budget Guardrails: {agent_res['budget_guardrails']['active_breaches_count']} active breach warnings")
print(f"  • Micro-Savings Round-Ups: Accrued=₹{agent_res['micro_savings']['monthly_accrued_savings']:,.2f}, 1-Yr Proj=₹{agent_res['micro_savings']['projected_12m_savings']:,.2f}, 5-Yr Proj=₹{agent_res['micro_savings']['projected_5y_compound_savings']:,.2f}")
print(f"  • Action Logs Emitted: {agent_res['new_actions_emitted']} new actions; Total in audit: {len(agent_res['action_logs'])}")
assert "auto_sweep" in agent_res["rules"], "Missing auto_sweep rule config"
assert "budget_guardrail" in agent_res["rules"], "Missing budget_guardrail rule config"
assert "round_up" in agent_res["rules"], "Missing round_up rule config"
print("  ✅ Autonomous Agent Engine tests PASSED!")

# ----------------------------------------------------------------------
# 4. FASTAPI REST ENDPOINTS VERIFICATION
# ----------------------------------------------------------------------
print("\n[4/4] Testing FastAPI Endpoints via TestClient...")
token = auth.create_access_token(data={"sub": user.id})
client = TestClient(app)
headers = {"Authorization": f"Bearer {token}"}

# Test 4A: POST /api/v1/tax/calculate
tax_resp = client.post(
    "/api/v1/tax/calculate",
    json={"gross_salary": 1500000, "basic_salary": 750000, "section_80c": 150000, "section_80d_self": 25000},
    headers=headers,
)
assert tax_resp.status_code == 200, f"Tax calculate failed: {tax_resp.text}"
tax_data = tax_resp.json()
print(f"  • POST /api/v1/tax/calculate: Status 200, Recommended={tax_data['recommended_regime']}, Savings=₹{tax_data['savings_amount']:,.0f}")

# Test 4B: GET & PUT /api/v1/tax/profile
prof_get = client.get("/api/v1/tax/profile", headers=headers)
assert prof_get.status_code == 200, f"Tax profile GET failed: {prof_get.text}"
print(f"  • GET /api/v1/tax/profile: Status 200, Gross Salary=₹{prof_get.json()['gross_salary']:,.0f}")

prof_put = client.put(
    "/api/v1/tax/profile",
    json={"gross_salary": 1400000, "section_80c": 150000, "preferred_regime": "new"},
    headers=headers,
)
assert prof_put.status_code == 200, f"Tax profile PUT failed: {prof_put.text}"
assert prof_put.json()["gross_salary"] == 1400000.0, "Tax profile gross salary not updated"
print("  • PUT /api/v1/tax/profile: Status 200, Updated Gross Salary=₹14,00,000")

# Test 4C: GET /api/v1/reports/executive-briefing & download
rep_resp = client.get("/api/v1/reports/executive-briefing", headers=headers)
assert rep_resp.status_code == 200, f"Reports GET failed: {rep_resp.text}"
print(f"  • GET /api/v1/reports/executive-briefing: Status 200, Velocity={rep_resp.json()['cash_velocity']['status']}")

dl_resp = client.get("/api/v1/reports/executive-briefing/download", headers=headers)
assert dl_resp.status_code == 200, f"Download failed: {dl_resp.text}"
assert "text/html" in dl_resp.headers.get("content-type", ""), "Expected text/html content-type"
print("  • GET /api/v1/reports/executive-briefing/download: Status 200, Content-Type=text/html")

# Test 4D: Autonomous Agent endpoints
rules_get = client.get("/api/v1/autonomous/rules", headers=headers)
assert rules_get.status_code == 200, f"Rules GET failed: {rules_get.text}"
print(f"  • GET /api/v1/autonomous/rules: Status 200, Rules Count={len(rules_get.json())}")

eval_post = client.post("/api/v1/autonomous/evaluate", headers=headers)
assert eval_post.status_code == 200, f"Evaluate POST failed: {eval_post.text}"
print(f"  • POST /api/v1/autonomous/evaluate: Status 200, Liquid=₹{eval_post.json()['liquid_balance']:,.0f}")

logs_get = client.get("/api/v1/autonomous/actions-log", headers=headers)
assert logs_get.status_code == 200, f"Actions log GET failed: {logs_get.text}"
print(f"  • GET /api/v1/autonomous/actions-log: Status 200, Logs count={len(logs_get.json())}")

print("  ✅ All FastAPI Endpoints tests PASSED!")

db.close()
print("\n" + "=" * 70)
print("🎉 ALL PHASE 4 BACKEND VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!")
print("=" * 70)
