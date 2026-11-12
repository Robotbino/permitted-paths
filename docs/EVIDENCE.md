# Evidence audit — 2026-11-13

For each important claim, this file records its status, where it appears, the source, and a note.

Status values:
- **Measured**: a primary source gives a measurement.
- **One report**: a primary source exists, but it is a single, unreplicated report.
- **Teaching model**: an illustration, not a measurement.
- **Not confirmed**: not found in the cited source.
- **Corrected**: the source says something different, and the text was changed to match it.

Every claim below now cites its source inline; the bracket numbers link to the reference shelf.

| Claim | Where | Status | Source | Note |
|---|---|---|---|---|
| p^n compounding table | Part 1 | Teaching model | none (arithmetic) | Assumes independent, equally reliable steps. The text now says that real errors are correlated and can be recovered from. No credible source treats it as a measurement. |
| Temperature 0 still varies | Part 1 | Measured | He 2025 (Thinking Machines); Ouyang et al., TOSEM 2025, doi:10.1145/3697010 | Cause given: the batch size depends on server load, and the kernels are not batch-invariant. |
| AlphaCodium 19% → 44% | Part 2 | Measured | Ridnik et al. 2024, arXiv:2401.08500 | Reported as pass@5 on the CodeContests validation set. Previously cited via DataCamp. Limitation added: one benchmark, and it has tests that act as a verifier. |
| Multi-agent 90.2% better; ~15× tokens | Part 2 | One report | Anthropic Engineering, 13 Jun 2025 | The evaluation is internal and not public. Previously cited via PuppyGraph. |
| `Agent = Loop(LLM + Harness)` | Part 1 drawer | Not confirmed | Feng et al., arXiv:2608.21156 | Not in the abstract, which treats harness and loop as separate. Check the full text. |
| Three planes | Part 5 | Teaching model | Alake talk | A way of sorting the parts, not a standard. |
| Midway "AF" story | Part 5 | Measured (history) | NSA Center for Cryptologic History, "The Battle of Midway" (PDF) | The PDF returned 403 to an automated check. The details were confirmed only through search results. Sources disagree on whether the reply came after 24 or 48 hours, so the page leaves that detail out. |
| "Factory idea began at GE in 1968" | Part 5 drawer | Corrected | Cusumano 1989, IEEE Software, doi:10.1109/MS.1989.1430446 | Bemer, then at GE, *proposed* a software factory in 1968. GE did not build one. |
| RDFS / OWL / SHACL | Part 4 | Measured (standards) | W3C TR pages (2014, 2012, 2017) | All three URLs returned 200. |
| Governed agent 99%; 200k vs 32k tokens | Part 5 | One report (demo) | Alake talk | Already caveated: there is no question count, so the sample size is unknown. |
| Loan demo "about half the time" | Part 3 | One report (demo) | Blumenfeld talk | Already labelled "not a benchmark". |
| Part L prices and tariffs | Part L | — | Linked inline | Not re-checked in this pass. Prices change, so re-check them before relying on them. |

**Learning-science sources** (design drawer in part 0): Sweller & Cooper 1985, Renkl & Atkinson 2003, Kalyuga et al. 2003, Roediger & Karpicke 2006, Richland et al. 2009, Chi et al. 1989.
- All six DOIs resolved through doi.org.
- Crossref confirmed the title and pages for four of them.
- Richland was confirmed via PubMed.
- For Chi 1989, the DOI resolves, but Crossref returned no metadata.
- The drawer says that Chi 1989 is correlational.

**Still to investigate:**
- The Feng formula: check the full text.
- The Midway PDF: open it manually.
- Part L prices: re-check them.
