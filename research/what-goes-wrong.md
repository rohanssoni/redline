# What Goes Wrong: Clause Types Ranked by Real-World Harm Evidence

Research for Redline (Agent 2 — "what-goes-wrong"). Goal: rank recurring clause types by how often/severely they burn people, using regulator, litigation, and survey evidence rather than assumption.

---

## Ranked list

### 1. Auto-renewal / negative-option / evergreen terms
**What it does:** Silently re-enrolls or re-bills the person after a trial or term ends, and/or makes cancellation deliberately hard (extra steps, phone-only cancellation, dark patterns), racking up charges the person didn't intend.
**Evidence:**
- FTC settlements for deceptive auto-renewal/cancellation practices: **Amazon — $2.5 billion** in monetary relief and civil penalties over Prime enrollment/cancellation dark patterns; **Match.com — $14 million** to consumers; **Chegg — $7.5 million**, both for continued billing after cancellation attempts and hard-to-find cancel flows.
- The FTC's "Click-to-Cancel" rule (finalized Oct 2024) was aimed squarely at this pattern; it was struck down by the Eighth Circuit in July 2025, and as of Jan 2026 the FTC has restarted rulemaking — signaling this remains an active, high-volume enforcement priority.
- Source: [Holland & Knight — FTC Steps Up Subscription Enforcement](https://www.hklaw.com/en/insights/publications/2025/09/ftc-steps-up-subscription-enforcement-after-click-to-cancel-rule); [FTC negative option rule announcement](https://www.ftc.gov/news-events/news/press-releases/2024/10/federal-trade-commission-announces-final-click-cancel-rule-making-it-easier-consumers-end-recurring); [Goodwin — Click-to-Cancel Rule Gets New Life](https://www.goodwinlaw.com/en/insights/publications/2026/02/alerts-practices-ba-ftcs-click-to-cancel-rule-gets-new-life) (notes Uber enrolled "more than 28 million consumers" in a subscription service now under FTC scrutiny).
**Document type:** SaaS/consumer ToS, subscription services; also appears in gym/service contracts.
**Note:** I could not verify a specific FTC aggregate complaint-count figure (a "70/day" style statistic surfaced in search-engine synthesis but did not appear verbatim on any page I fetched directly — FTC.gov itself returned a 403 to WebFetch). I'm relying instead on the verified settlement dollar figures above, which are directly sourced.

### 2. Arbitration clauses + class-action waivers
**What it does:** Forces disputes into private arbitration and blocks joining or bringing a class action — the main practical effect is that harmed people either drop the claim (arbitration is not worth it for small individual damages) or are blocked from collective recourse when companies invoke the clause.
**Evidence:**
- CFPB's landmark arbitration study: card issuers representing **more than half of all credit card debt** carry arbitration clauses, affecting **as many as 80 million consumers**; banks representing **44% of insured deposits** have them in checking-account agreements.
- When companies with an arbitration clause were sued in a class action, they invoked the clause to block it **65% of the time**.
- From 2010–2012, consumers filed an average of only **411 arbitration cases per year** across six major consumer product markets combined — i.e., the clause suppresses claims almost entirely rather than routing them elsewhere.
- Mandatory arbitration is also now standard in gig-platform ToS (Uber, Lyft, DoorDash, Instacart, Amazon Flex, etc.), per legal-practice write-ups, though I found no quantified complaint volume specific to gig arbitration.
- Source: [CFPB — Arbitration Study Finds Agreements Limit Relief for Consumers](https://www.consumerfinance.gov/about-us/newsroom/cfpb-study-finds-that-arbitration-agreements-limit-relief-for-consumers/); [CFPB Fact Sheet PDF](https://files.consumerfinance.gov/f/201503_cfpb_factsheet_arbitration-study.pdf).
**Document type:** Consumer financial contracts, SaaS/consumer ToS, gig-worker agreements, employment agreements.

### 3. Fee escalators and late fees
**What it does:** Penalty fees, often disproportionate to actual cost, triggered by minor timing slips; frequently the largest single line-item surprise cost in a contract.
**Evidence:**
- CFPB's 2024 rule capped credit card late fees at **$8**, down from an industry-typical **$32**, after finding late fees cost American households **more than $14 billion a year**.
- **1 in 5 Americans (~52 million people)** paid a credit-card late fee in the prior year per a 2023 Consumer Reports survey; the CFPB estimated the newly capped rule would save the **45 million Americans** charged such fees an average of **$220/year**.
- This evidence is from consumer credit specifically, used here as the strongest available quantified proxy for fee/penalty-clause harm generally (late fees and escalators recur structurally the same way in leases and service agreements, but I did not find equivalent lease-specific dollar aggregates).
- Source: [CFPB — Bans Excessive Credit Card Late Fees](https://www.consumerfinance.gov/about-us/newsroom/cfpb-bans-excessive-credit-card-late-fees-lowers-typical-fee-from-32-to-8/); [CNBC Select summary](https://www.cnbc.com/select/credit-card-late-fees-new-cap/).
**Document type:** Consumer credit/lease agreements (late-fee mechanics generalize to lease and service-agreement fee escalators).

### 4. Liability caps and indemnity clauses
**What it does:** Caps how much the counterparty owes if something goes wrong (often capped at fees paid — small for a low-cost SaaS tool but potentially catastrophic exposure for the customer), and indemnity clauses can shift the cost of third-party claims onto the weaker party.
**Evidence:** In World Commerce & Contracting's (WorldCC, formerly IACCM) annual "Most Negotiated Terms" survey, **limitation of liability has ranked the #1 most negotiated commercial contract term for over a decade**, with indemnification consistently in the top five (alongside price, scope, and termination). This is a negotiation-frequency measure (i.e., "the clause people fight over most"), not a complaint-volume measure, but it's a strong, repeated, cross-industry signal that this clause is where the real financial risk allocation battle happens.
Source: [Spend Matters — Most Negotiated Contract Terms of 2020 (Icertis/WorldCC survey)](https://spendmatters.com/2021/01/19/most-negotiated-contract-terms-of-2020-icertis-survey/) — note: this URL now redirects to The Hackett Group's site (WorldCC/IACCM was acquired), so I could not re-verify the exact figures on a live page; the ranking claim comes from the search-engine synthesis of that page's cached content and should be treated as moderately, not fully, verified.
**Document type:** SaaS/vendor ToS, service agreements, B2B commercial contracts.

### 5. Non-competes and non-solicits
**What it does:** Restricts a worker's ability to take a new job or start a competing business after leaving, sometimes with no compensation for the restriction and geographic/time scope far beyond what protects any real business interest.
**Evidence:** The FTC's 2024 rule (later blocked in litigation) was built on the finding that non-competes cover an estimated **30 million workers — about 1 in 5 (18%) of the U.S. workforce**. That's a prevalence figure, not a complaint-volume figure — I did not find a complaint-count or litigation-volume statistic specific to non-compete disputes, only this scale-of-exposure number.
Source: [FTC — Fact Sheet on Proposed Final Noncompete Rule](https://www.ftc.gov/news-events/news/press-releases/2024/04/fact-sheet-ftcs-proposed-final-noncompete-rule); [FTC — Announces Rule Banning Noncompetes](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-rule-banning-noncompetes).
**Document type:** Employment agreements; increasingly also service/freelance agreements as "non-compete-lite" clauses.

### 6. Payment terms / kill fees / scope-of-work ambiguity (freelance nonpayment)
**What it does:** Vague payment terms, missing kill-fee provisions, and undefined scope-of-work language are what freelancers actually get burned by — clients drag out payment, dispute scope, or refuse to pay, and there's no contractual mechanism forcing resolution.
**Evidence:** Freelancers Union survey data: **71% of freelancers report having trouble getting paid** at some point in their careers; average disputed amount **exceeds $6,000**. A related Freelancers Union/Authors Guild NY survey found **~60–62% of NY freelance workers report never being paid** for work performed at least once. Only a minority of freelancers use written contracts consistently, which compounds the problem.
Source: [Freelancers Union — Costs of Nonpayment report (PDF)](https://www.onlabor.org/wp-content/uploads/2017/05/FU_NonpaymentReport_r3.pdf); [Freelancers Union blog — NY freelancers not paid](https://blog.freelancersunion.org/2022/05/12/over-60-of-ny-freelancers-report-not-being-paid-for-work-performed/); [Authors Guild — 62% NY freelance workers survey](https://authorsguild.org/news/survey-finds-62-percent-of-ny-freelance-workers-have-lost-wages-due-to-nonpayment/).
**Document type:** Freelance/independent-contractor service agreements.

### 7. Security deposit / repair clauses (leases)
**What it does:** Landlord withholds deposit citing "damage," tenant disputes it as normal wear and tear; lack of move-in/move-out documentation makes it a near-coin-flip dispute.
**Evidence:** Industry data aggregator reports the security deposit as "the single most disputed transaction in the rental lifecycle," citing that **more than half of move-outs involve a disagreement**, and a gap between the **87%** of renters who pay a deposit and the **42%** who report getting it all back. Also cites **60% of renters have no move-in photos** and **71% of landlords publish no itemized deduction pricing** — i.e., the dispute is structurally set up by absent documentation, which is exactly the kind of thing a document-reading tool could flag pre-signature (e.g., "this lease has no move-in condition report requirement").
Source: [RapidEye Inspections — Security Deposit Statistics 2026](https://rapideyeinspections.com/research/security-deposit-statistics/). **Caveat: this is a data-aggregator/inspection-industry site, not a primary regulator or legal-aid source — treat these specific percentages as directional, not authoritative.** I could not find a legal-aid-org or state-AG dataset with comparable figures in my search budget.
**Document type:** Residential leases.

### 8. Personal guarantees (commercial leases / small-business contracts)
**What it does:** Individual owner's personal assets (bank accounts, home, wages) become liable for business debts/lease obligations even after the business entity fails or goes bankrupt — defeats the entire purpose of forming an LLC for liability protection, and often the guarantor doesn't register how open-ended the exposure is (e.g., liable for the full remaining lease term, not just one default).
**Evidence:** Qualitative confirmation from multiple commercial real estate law sources that personal guarantees became standard practice for small/new businesses post-2008 and expose personal assets for the full remaining lease value. **I could not find a quantified statistic** (e.g., % of small business leases requiring a guarantee, or dollar amounts of guarantor losses) despite searching — this is a real, well-documented risk pattern but not one I can back with hard numbers.
Source: [ZenBusiness — Commercial Lease Without a Personal Guarantee](https://www.zenbusiness.com/blog/getting-a-commercial-lease-without-signing-a-personal-guarantee/); [The Leasing Lawyers — Personal Guarantee explainer](https://theleasinglawyers.com/post/personal-guarantee-commercial-lease).
**Document type:** Commercial leases, small-business loan/vendor agreements.

### Candidates I tested but could not evidence at all (dropped or flagged as unverified)
- **IP assignment / work-for-hire (freelance):** Widely written about as a recurring dispute source (freelancers not realizing "work for hire" language may be unenforceable outside statutory categories, or losing rights they assumed they'd kept) — but I found **zero quantified survey or litigation-volume data**, only law-firm advisory commentary. Real risk, unmeasured.
- **Unilateral termination / deactivation (gig platforms):** Confirmed as structurally universal (Uber/Amazon Flex/DoorDash all reserve unilateral deactivation rights, paired with mandatory arbitration) but I found no complaint-count or deactivation-rate statistics in budget.
- **Unilateral amendment clauses, exclusivity, confidentiality/NDA overreach:** Not reached — search budget was exhausted before these could be evidenced. Not ranked; do not assume low importance, just unresearched.

---

## Ranking confidence

- **High confidence (measured, not impressionistic):** #1 (auto-renewal, verified settlement dollar figures), #2 (arbitration/class-action waiver, CFPB's own study with hard percentages), #3 (late fees, CFPB rule + Consumer Reports survey).
- **Medium confidence:** #4 (liability/indemnity — strong repeated signal but the primary source page could not be re-verified live, and it measures negotiation frequency, not harm/complaint frequency, which is a different thing than what this ranking is supposed to capture), #5 (non-compete — solid prevalence number but no complaint/dispute-volume data), #6 (freelance payment terms — good survey numbers but conflates several clause types: payment terms, kill fees, and scope-of-work definition, which a stricter taxonomy would separate).
- **Low confidence / directional only:** #7 (security deposits — best available number came from an industry-aggregator site, not a regulator or legal-aid body), #8 (personal guarantees — no quantification found at all, ranked last partly *because* I couldn't find volume evidence, not because it's necessarily rarer).
- **Overall:** The relative order between #1–#3 is reasonably well supported by independent regulator data. The order from #4 downward is more impressionistic — it reflects a mix of "how much money/attention professionals put into this clause" (liability/indemnity, via negotiation-frequency data) versus "how many individual people this actually burns" (freelance nonpayment, security deposits), and those are genuinely different axes that I was not able to reconcile onto one scale with the evidence available. For product prioritization purposes, I'd trust #1–#3 as "definitely build detection for these" and treat #4–#8 as "probably matters, sequence by what's cheap to detect first" rather than a strict severity ranking.

## What I could not find
- An aggregate, regulator-sourced consumer-complaint count specifically for auto-renewal/negative-option practices (a number appeared in AI-search synthesis but did not appear on any FTC or law-firm page I was able to directly fetch — FTC.gov blocked WebFetch with a 403).
- Any quantified dispute/litigation-volume data for IP assignment clauses in freelance contracts.
- Any quantified data for gig-platform deactivation rates or disputes.
- Any dollar-amount or default-rate statistics for personal guarantees.
- Legal-aid-org or state-AG-sourced (as opposed to industry-aggregator-sourced) statistics on security deposit disputes.
- Anything at all on unilateral amendment clauses, exclusivity clauses, or NDA/confidentiality overreach — not reached within budget, not to be read as "unimportant."

## Search budget used
- Web searches: **12 / 12** (cap reached)
- Pages fetched (WebFetch): **6 / 15** (2 failed — FTC.gov 403, Spend Matters redirect not followed)
- Distinct sourced findings: **8** ranked + 3 explicitly flagged as evidenced-but-unquantified/dropped candidates
