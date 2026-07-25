# Sysco Trace

How to build an app that shows which restaurants use Sysco — and how to make it
accurate enough to be worth publishing.

This directory contains the research behind that question and a working prototype
of the answer. It is standalone and is not linked from derekzhou.com.

---

## 1. The finding that shapes everything else

**There is no list, and there cannot be a complete one.**

Sysco serves roughly 700,000 customer locations and treats its customer roster as a
trade secret. It is not published, not licensed, and not derivable in full from any
public source. Neither is it available commercially at the level this app needs:
Circana's SupplyTrack and Datassential sell *aggregated* operator purchasing panels
under licences that forbid identifying individual operators — useful for market
sizing, useless and non-redistributable for a per-restaurant lookup.

So the honest product is not a directory. It is an **evidence engine**: for any given
operator, surface what the public record actually shows, cite it, and score how
strongly it supports the claim. The difference is not cosmetic. A directory that
silently mixes a sworn bankruptcy schedule with someone's guess is both wrong and
legally exposed. An evidence engine that says "confirmed, here is the filing" or
"no public trace, which means nothing either way" is defensible on both counts.

The single most important design consequence: **absence of evidence is not evidence
of absence.** Most Sysco customers leave no public trace whatsoever. The app must
never let an empty result read as "this restaurant doesn't use Sysco."

## 2. Where the signal actually is

Ranked by evidentiary strength. Tier A is documentary — a filing, contract or
registry record. Tier B is observable but interpretable. Tier C is suggestive only.

### Tier A

**Bankruptcy creditor schedules.** The strongest routinely-available source. Schedule
E/F and the Form 204 top-20 unsecured creditor list are filed under penalty of
perjury, and a Sysco operating company appearing as a trade creditor means the
operator bought from Sysco on credit. This is not hypothetical — it shows up
constantly in real filings: Damon's International listed Sysco Baltimore;
Restaurants Unlimited listed Sysco Food Service Portland at $707,000 and Sysco
Seattle at $606,000; a Village Inn franchisee listed Sysco Food Service at $35,000.
Available via PACER, and increasingly via free mirrors like CourtListener/RECAP.

**UCC-1 financing statements.** The highest-volume Tier A source, and the least
obvious. Sysco's standard credit application terms have the customer grant Sysco a
security interest in *all assets* and irrevocably authorise Sysco to file financing
statements:

> "Customer hereby grants to Sysco a continuing security interest in… all assets of
> Customer" … "Customer hereby irrevocably authorizes Sysco at any time… to file in
> any filing office in any Uniform Commercial Code jurisdiction any initial financing
> statements describing the Collateral as all assets of Customer."

Every credit customer is therefore a candidate public filing naming a Sysco entity as
secured party. The catch is retrieval direction: most state systems index by *debtor*,
and you need the reverse. Georgia (GSCCCA), Washington, Colorado and Minnesota expose
secured-party search; Kentucky sells a bulk feed including full debtor/secured-party
tables. Coverage is therefore state-by-state, not national — an honest constraint, not
a solved problem.

**Government contract awards.** Fully public, keyless, national. Verified working
against the USAspending API in `pipeline/usaspending.js`. Note the relationship runs
backwards here: Sysco is the *recipient* and a government agency is the *buyer*, so
these records identify institutional kitchens (base dining facilities, VA hospitals),
not independent restaurants. State and local procurement adds K-12 districts and
universities, plus cooperative vehicles like OMNIA Partners/Sourcewell.

**Collection lawsuits.** `Sysco <OpCo> v. <Operator>` over goods sold and delivered
presupposes a supply relationship. Strong, but structurally biased toward operators
who stopped paying, so it badly under-samples healthy customers.

**Sysco's own publications.** Case studies, press releases and Sysco Foodie features
name operators directly. A party admission by the distributor; essentially no
false-positive path.

**Franchise Disclosure Documents.** The highest-leverage source per document. FTC rules
require Item 8 of an FDD to disclose what a franchisee must buy from the franchisor or
its designated suppliers, any revenue or rebate the franchisor earns on those sales, and
the identity of any required purchasing cooperative. Where Item 8 names Sysco, every
franchisee in the system is contractually pushed toward it — one filing covering hundreds
of locations. Registration states publish FDDs and Wisconsin's DFI hosts them free and
searchable. The caveat is that Item 8 often lists several *approved* suppliers rather than
one *required* one, which is weaker and must be scored as such.

**State and municipal checkbook data.** Far higher volume than federal contract data.
New York's Open Book, OpenCT, the Illinois Comptroller, Texas and Oklahoma all publish
vendor-level payments; searching the payee side returns the paying agency, date and
amount. Same limitation as federal: institutional buyers, not independent restaurants.

### Tier B

**Menu forensics.** A menu is a bill of materials the operator publishes voluntarily.
Four readings, in descending strength:

- *Sysco private labels.* Arrezzio, Block & Barrel, Portico, Butcher's Block, Casa Solana,
  Wholesome Farms, Baker's Source, Fire River Farms, House Recipe, Jade Mountain, White
  Marble Farms and Sysco Simply are Sysco-owned and not sold through competing broadliners.
  Nearly conclusive, but operators rarely name them.
- *Convenience-item clusters.* Mozzarella sticks, onion rings, boneless wings, potato
  skins, crab rangoon. These arrive frozen, breaded and portioned. One proves nothing; a
  cluster is a strong operational tell — though the distributor could equally be US Foods
  or PFG, which is why the likelihood ratio stays modest.
- *Portion specs.* A kitchen breaking down primals does not describe a steak to the ounce.
  "8 oz center-cut sirloin" is a number off a distributor spec sheet.
- *Operational impossibility.* 90+ items, or 60+ across several cuisines, requires hundreds
  of SKUs at stable cost and year-round availability, which farm-direct sourcing cannot
  deliver. Likewise heirloom tomatoes on a January menu in Minnesota. **This is the main
  path that reaches the independent restaurants no registry, docket or contract touches** —
  the coverage gap that documentary sources structurally cannot close.

**Local sourcing, as negative evidence — but only when checkable.** Farm names on the menu
are matched against USDA's Local Food Directories (farmers market, CSA, food hub, on-farm
market, all with APIs and bulk CSV) and the USDA Organic INTEGRITY database of certified
operations. A verified relationship with named producers genuinely lowers the probability.
An unverifiable "locally sourced" is scored as near-neutral marketing — deliberately, since
treating it as evidence would let any operator edit their way out of the dataset.

**Photo evidence.** Crowd-submitted images of Sysco cases, invoices or a delivery in
progress. Valuable because it reaches the independents no registry covers, and weak
because cases are reused, travel between kitchens, and are trivially staged.

### Tier C

**Job postings** referencing Sysco ordering systems. **Negative signals** — an
operator naming a competing distributor, or claiming farm-direct sourcing — are
modelled explicitly but weakly, because multi-sourcing is the norm and "local
sourcing" usually covers produce while dry goods still arrive on a broadline truck.

## 3. The two hard engineering problems

**Entity resolution on the Sysco side.** Sysco never appears as "Sysco". Real strings
from real records: `SYSCO IOWA, INC.`, `SYSCO CONNECTICUT, LLC`, `Sysco Baltimore`,
`Sysco Food Service Portland`, `SYSCO WESTERN MINNESOTA, INC.`. Plus wholly-owned
subsidiaries carrying no Sysco name at all — FreshPoint, Buckhead Meat, Newport Meat,
Greco & Sons, European Imports. A naive `grep sysco` is simultaneously too narrow
(misses every subsidiary) and too broad (matches prose like "Sysco and US Foods both
bid", and OCR'd court scans where Cisco becomes Sysco). `engine/entities.js` handles
all three cases and *refuses to guess* when a string names both Sysco and a competitor.

This filter earns its keep immediately: on a live 5,000-award pull it rejected 7 rows
that keyword matching would have accepted.

**The relationship graph — the highest-leverage idea in the whole design.** Supply
contracts are not signed per restaurant. They are signed by an operating entity, a
management company, or a franchise system, and then apply to every location underneath.
So a UCC filing naming one LLC is evidence about a dozen storefronts, and an FDD naming
a designated distributor is evidence about hundreds. Modelling restaurants as independent
data points throws away most of the available signal.

`engine/graph.js` builds an operator graph from shared legal entities, owners and
officers, management companies, phone numbers, premises and registered agents, then
propagates evidence across it with attenuation per edge type and per hop. Three details
make it defensible rather than a rumour mill:

- *Hub penalty.* Edge weight is divided by the square root of the connecting entity's
  degree. A registered agent listed on 400 filings — CT Corporation and friends — wires
  the whole dataset together if you let it, so it is penalised into irrelevance. A person
  appearing on exactly two filings is not. This is the graph analogue of inverse document
  frequency.
- *Max-product paths, not summed paths.* One underlying fact reachable by three routes is
  still one fact. Summing over paths would double-count it, the same independence error
  correlation damping fixes for repeated evidence.
- *Propagated evidence never propagates onward*, and **never counts as documentary**.
  Inheriting a sibling's sworn bankruptcy schedule is an inference about a different legal
  person. It can raise the probability; it can never produce a "confirmed" verdict. The UI
  labels every inherited item with the chain it travelled and the weight it lost.

**Entity resolution on the operator side — the genuinely hard one.** A UCC debtor is
a legal entity (`JBK Holdings LLC`), not a trade name (`Joe's Diner`). Bridging them
requires joining state business registries, DBA/assumed-name filings, and health-permit
or liquor-licence records, which carry legal name, trade name and address together. NYC's
Legally Operating Businesses dataset is a worked example: it carries legal `business_name`
alongside `dba_trade_name`, plus building identifiers and contact phone, which is exactly
the join this needs — and grouping it by legal entity immediately surfaces operators
running dozens of locations (along with `ecoATM, LLC` vs `ECOATM LLC`, a reminder that
normalisation is doing real work).
This join is probabilistic and it is where a real build would spend most of its effort.
The engine models this honestly rather than pretending it is solved: every evidence
item carries a `resolution` score in 0–1, and a filing we are only 40% sure maps to
this restaurant contributes only 40% of its weight.

## 4. The scoring model

Log-odds accumulation with four correctives, all visible in the UI:

1. **Segment prior.** An operator with no evidence starts at a base rate for its
   segment (~0.18 for an independent), not at zero and not at fifty-fifty.
2. **Likelihood ratios per evidence type**, stated explicitly in `engine/evidence.js`
   with the reasoning and known false-positive paths recorded alongside each one.
   These are calibrated judgements, not measured values — nobody outside Sysco can
   measure them — so they are written down to be argued with rather than buried.
3. **Recency half-life.** UCC-1s lapse after five years absent continuation, so that
   is their half-life. Menus go stale in 18 months. Decay shrinks evidence toward
   *no information*, never past it — a stale positive must never become a negative.
4. **Correlation damping.** Bayesian updating assumes independent observations, and
   real corpora violate this badly. The prototype's first live run produced an Army
   buyer with 43 awards under one contract vehicle; naively summed, that is
   overwhelming "proof" built from one fact counted 43 times. Within each evidence
   type the strongest item now counts fully and the k-th counts at 1/k.

**The tier cap is the guardrail that matters most.** No quantity of circumstantial
evidence can produce a "confirmed" verdict — only a Tier A document can, and only if
it is still fresh. This is enforced in `applyTierCap` and tested directly: stacking
30 fresh weak signals still cannot confirm. Without this rule, the arithmetic happily
manufactures certainty out of gossip, which is precisely what turns an informative
app into a defamatory one.

## 5. Publishing this without getting sued

Trade libel requires a false statement of fact causing demonstrable monetary harm.
The mitigations are structural, not cosmetic:

- **Never assert a bare fact.** Every claim carries its verdict band, its confidence,
  and a link to the underlying record.
- **Say what the claim is not.** "Uses Sysco" means Sysco is *one* supplier. It never
  means the menu is all Sysco product. The UI states this on every card.
- **Stay neutral.** Damages flow from the implied "and therefore this food is bad."
  Reporting a supply relationship is informational; editorialising about quality
  invites the claim the disclaimers are there to prevent.
- **Run a real corrections channel** and honour removals on the strength of the
  record.
- Crowd-sourced photo submissions attract §230 protection; the app's own inferences
  do not. That asymmetry is a reason to keep first-party claims tied to documents.

## 6. Live search: making it work for anyone, anywhere

The corpus-only version answered questions about 36 pre-computed operators. Searching
an arbitrary restaurant needs live fan-out, which needs a server: almost none of these
sources are reachable from the browser under this page's CSP, and the ones that are
still need schema mapping and escaping in one place.

`functions/api/search.js` is that server. Given a name — and optionally a locality and
a menu URL — it queries every source that can be asked about a name it has never seen,
resolves the results into operators, derives the ownership graph between them,
propagates evidence and scores everything.

**Discovery instead of hardcoding.** Socrata runs a cross-portal catalogue covering
every government open-data portal on the platform, so the relevant food-establishment
and business-licence datasets are found at query time rather than wired up by hand.
That is what makes the tool work in a jurisdiction nobody anticipated. Schemas are
wildly inconsistent between them — `dba`, `dba_name`, `facility_name`, `premise_name`
all mean the same thing — so columns are mapped by heuristic from the catalogue
metadata, and a dataset with no usable name column is skipped rather than guessed at.

**The menu field is the genuinely universal path.** Public-records lookup only reaches
US jurisdictions that publish open data. Pasting a menu URL works for any operator on
earth, because the inference is over the menu itself.

**The coverage report is not decoration.** This tool's most common answer is "nothing
found", and that sentence is only interpretable next to a list of what was actually
consulted. The response always names the datasets queried and how many matched, the
sources that failed and why, and the five source classes that carry the *strongest*
evidence in the whole model and cannot be queried live at all — UCC filings, bankruptcy
schedules, FDD Item 8, checkbook data and court dockets. A result is a floor on what
exists, never a ceiling. Without that list, a thin result reads as exoneration.

### Security of the live endpoint

The menu analyser fetches a URL supplied by whoever is using the page, which makes it
both an SSRF surface and, unbounded, an open proxy running on someone else's domain.
`functions/api/lib/http.js` enforces https only; no credentials in the URL; no
non-standard ports; no loopback, private, link-local or `.internal` hosts — which
covers cloud metadata endpoints; manual redirect following so **every hop is
re-validated** rather than trusting the first URL; a redirect cap; a timeout; and a
byte ceiling enforced while streaming, since `Content-Length` can lie. Only derived
signals are ever returned, never the fetched body. All of it is tested, including the
redirect-to-metadata-endpoint case.

SoQL string literals are escaped by doubling quotes, and the test asserts the literal
stays balanced rather than merely checking the escape appears.

## 7. What's in this prototype

```
engine/entities.js    Sysco entity resolution across OpCos, subsidiaries, competitors, OCR noise
engine/evidence.js    Evidence registry: likelihood ratios, half-lives, stated basis, false-positive paths
engine/score.js       Log-odds scoring: priors, decay, resolution scaling, correlation damping, tier cap
engine/graph.js       Operator graph + evidence propagation with hub penalty and hop decay
engine/menu.js        Menu forensics + local-sourcing verification
engine/*.test.js      45 tests, including every guardrail above
pipeline/usaspending.js  Live connector against the public USAspending API (no key)

../functions/api/search.js      Live search: fan-out, graph, scoring, coverage report
../functions/api/lib/socrata.js Cross-portal discovery + heuristic schema mapping
../functions/api/lib/http.js    SSRF-guarded fetch (https-only, redirect re-validation, size cap)
../functions/api/lib/*.test.js  20 tests covering the guards and schema inference
index.html app.js app.css  Static UI: search, verdict bands, per-item evidence math, citations
data.seed.json        Curated corpus; entries flagged "synthetic" are demo fixtures
data.usaspending.json Real data from a live API pull
```

Run it, from this directory:

```sh
npm test                                          # 45/45
node pipeline/usaspending.js --years 3 --out data.usaspending.json
npm run serve                                     # then open http://localhost:8080/
```

Entries in `data.seed.json` marked `"synthetic": true` are demo fixtures that exercise
the scoring bands. They are labelled as such in the UI and must never be presented as
findings about a real business.

## Access

Served publicly at `/sysco/`, but not linked from the home page and excluded from
search results by `X-Robots-Tag` in `_headers` plus a `noindex` meta tag. Anyone with
the URL can read it.

It was briefly built behind a Cloudflare Access gate — edge-verified JWT, email
allowlist, fail-closed — before being made public deliberately. That middleware and
its 16 tests are recoverable from git history (`git show a0c8f77`) if this ever needs
locking down again. Note that a client-side password check is not a substitute: static
content reaches the browser before any client-side check can run.

## 8. Honest limits

- **Coverage is skewed to institutions and the distressed.** Government contracts
  reach schools and bases; bankruptcy and collection suits reach failing operators.
  Menu forensics and graph propagation are what reach the healthy independent, and both
  are inference rather than documentation — which is why neither can confirm.
- **The graph is only as good as its ownership data.** Officer and DBA coverage varies
  enormously by state, and a missing edge silently costs signal rather than announcing
  itself.
- **Menu inference is the weakest link by design.** Every threshold in `menu.js` — three
  convenience items, 90 menu items, the winter produce list — is a judgement call, and a
  stale online menu is scored as if current.
- **UCC coverage is state-by-state**, gated on which states permit secured-party
  search.
- **Live search reaches identity, not evidence.** Open-data portals establish who an
  operator is and who it is connected to. They do not say anything about Sysco. The
  sources that do are exactly the five that cannot be queried live, so most live
  searches will correctly return the prior and a list of what was checked.
- **The USAspending connector resolves buyers to agency-plus-state**, not to an
  individual dining facility; the data does not expose finer granularity.
- **The likelihood ratios are unvalidated.** They can be sanity-checked against
  operators with known relationships, but true calibration needs ground truth that
  only Sysco holds.
- **Relationships churn.** Operators switch distributors, and restaurants close at a
  high rate. Every verdict is as-of a date, and the app shows it.

## Sources

- [Sysco credit applicant terms and conditions](https://corasysco.my.salesforce-sites.com/web/creditApplicantTermsandConditions) — security interest and UCC filing authorisation
- [USAspending API](https://api.usaspending.gov/) — federal award data
- [Georgia GSCCCA UCC secured-party search](https://search.gsccca.org/UCC_Search/search.asp?searchtype=SecuredParty)
- [Kentucky SoS UCC bulk data service](https://www.sos.ky.gov/bus/Pages/Bulk-Data-Service.aspx)
- [Restaurants Unlimited Ch. 11 — Sysco Portland and Sysco Seattle as creditors](https://www.fsrmagazine.com/finance/progressive-wage-laws-send-restaurants-unlimited-into-bankruptcy)
- [Damon's Ch. 11 — Sysco Baltimore among top creditors](https://www.restaurantbusinessonline.com/damons-files-chapter-11-bankruptcy-protection-sysco-usf-among-top-creditors)
- [Village Inn franchisee Ch. 11 — Sysco Food Service creditor](https://www.thestreet.com/restaurants/village-inn-restaurant-franchisee-files-chapter-11-bankruptcy)
- [Sysco private-label brand portfolio](https://foodie.sysco.com/brand-spotlight/)
- [Datassential × Circana SupplyTrack](https://datassential.com/resource/datassential-circana-supplytrack-industry-reports/) — why licensed panel data can't back this app
- [Digital Media Law Project — avoiding reputational liability](https://www.dmlp.org/legal-guide/practical-tips-avoiding-liability-associated-harms-reputation)
