# SIRA Compliance Research Notes

**Date:** December 2024
**Context:** Received cold email from Fuel Analytics (competitor to Titan Cloud/Leighton O'Brien)

---

## What is SIRA?

**Statistical Inventory Reconciliation Analysis** - EPA-mandated leak detection for underground petroleum storage systems (UPSS) at service stations.

### Key Requirements
- Legal requirement for underground tanks with capacity > 5,500L
- Must detect leaks as small as 0.76 L/hr (18L per day)
- 95% detection probability, <5% false alarm rate
- Monthly reports verified by qualified analysts
- Required for EPA audits

### Australian Standards
- AS4897-2008: Design, installation & management of UPSS
- State-based EPA regulations vary
- Non-compliance penalties up to $1 million per breach + cleanup costs

---

## SIRA vs TankAlert

| Aspect | SIRA | TankAlert |
|--------|------|-----------|
| Tank type | Underground (service stations) | Above-ground (depots/industrial) |
| Purpose | EPA regulatory compliance | Operational efficiency |
| Leak detection | Certified to 0.76L/hr | Consumption anomaly detection |
| Certification | US EPA/NWGLDE accredited required | Not applicable |
| Reports | Monthly certified analysis | Real-time dashboards |
| Market | Petrol stations | Bulk fuel storage |

---

## Accreditation Requirements

Building SIRA features is NOT sufficient - the statistical method must be certified:

1. **Third-party evaluation** by independent testing organization
2. **Detection capability**: 0.2 GPH (0.76 L/hr) at ≥95% probability
3. **False alarm rate**: <5%
4. **Testing protocol**: US EPA protocol (EPA/530/UST-90/007)
5. **NWGLDE review**: Minimum 6-month review process
6. **Australian compliance**: AS4897-2008 standards

### NWGLDE (National Work Group on Leak Detection Evaluations)
- 10-member board (8 state reps + 2 US EPA)
- Maintains official list of approved SIRA methods/vendors
- Website: https://neiwpcc.org/nwglde/

---

## Market Players (Australia)

### Titan Cloud (Monopoly concern)
- Acquired Leighton O'Brien and EMS
- Now the dominant/only SIRA provider in Australia
- Fuel Analytics email claims prices are increasing, service diminishing

### Fuel Analytics
- New entrant, partnered with US/Europe SIRA provider
- Claims to offer more accurate reporting at lower cost
- EPA-certified (claims)
- Website: fuelanalytics.com.au

---

## Options If We Need SIRA

| Approach | Effort | Notes |
|----------|--------|-------|
| Build + certify | Very High | 12-18 months, uncertain outcome |
| Partner with certified provider | Medium | Integrate their analysis API |
| Continue outsourcing | Low | Keep paying Titan or switch to Fuel Analytics |

---

## Relevance to Our Business

- TankAlert serves above-ground bulk storage (depots, mining, farms)
- If company also operates BP service stations with underground tanks, SIRA is relevant
- These are separate compliance requirements - TankAlert doesn't replace SIRA

---

## References

- [NWGLDE](https://neiwpcc.org/nwglde/)
- [EPA Tasmania - Loss Monitoring](https://epa.tas.gov.au/business-industry/regulation/underground-fuel-tanks/loss-monitoring)
- [TankTrace - SIRA Compliance](https://tanktrace.com.au/why-sira-compliance-matters-more-than-ever/)
- [ServoPro - Importance of SIRA](https://servopro.com.au/importance-of-sira-at-your-service-station/)
