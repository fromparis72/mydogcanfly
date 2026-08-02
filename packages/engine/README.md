# @mydogcanfly/engine

The **product**. Two pure components over the normalized knowledge base:

- **Decision Engine** — `evaluate(NormalizedKB, FinderRequest) → Decision`. Evaluates data-driven `Rule`s (airline + country + breed + crate + heat) against the request. No hardcoded airline logic.
- **Explanation Engine** — `explain(Decision) → DecisionReport`. Turns the decision into a sectioned, self-explaining report: **Compatible · Conditions · Warnings · Risks · Alternatives · Confidence · Sources**.

The website, mobile app and AI assistant all consume the same `DecisionReport` (ADR-0010, ADR-0013).

## Run the demo
```bash
npm run demo     # Golden Retriever · 11 kg · 34 °C · → Japan, end to end
```
