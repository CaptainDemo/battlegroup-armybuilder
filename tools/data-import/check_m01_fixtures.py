"""Check M01 evidence integrity and arithmetic; this is not a game validator."""

from pathlib import Path
import hashlib
import json
import re


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    folder = root / "tests/fixtures/classic-coldwar"
    manifest = json.loads((folder / "m01-sources.json").read_text(encoding="utf-8"))
    fixture = json.loads((folder / "m01-calibration.json").read_text(encoding="utf-8"))
    assert fixture["rulesetId"] == manifest["rulesetId"] == "classic-coldwar"
    assert fixture["notRuntimeCatalog"] and fixture["notFinalRosterSchema"]
    sources = {s["id"]: s for s in manifest["sources"]}
    assert len(sources) == len(manifest["sources"])
    for source in sources.values():
        path = (root / source["path"]).resolve()
        assert path.is_relative_to(root / "references"), source["path"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source["sha256"], source["id"]
        assert all(1 <= p <= source["pdfPageCount"] for p in source["visuallyReviewedPdfPages"])

    rule_text = (root / "docs/data/classic-constraints.md").read_text(encoding="utf-8")
    ambiguity_text = (root / "docs/data/classic-ambiguities.md").read_text(encoding="utf-8")
    rules = set(re.findall(r"\| (C\d{2}) \|", rule_text))
    ambiguities = set(re.findall(r"\| (A\d{2}) \|", ambiguity_text))
    case_ids: set[str] = set()
    for case in fixture["cases"]:
        cid = case["id"]
        assert cid not in case_ids, cid
        case_ids.add(cid)
        lines = case["lines"]
        by_id = {line["selectionId"]: line for line in lines}
        assert len(by_id) == len(lines), cid
        totals = {"points": 0, "br": 0}
        for line in lines:
            assert line["entryId"] and line["selectionId"], cid
            assert type(line["quantity"]) is int and line["quantity"] > 0, cid
            for key, value in [("unitPoints", "points"), ("unitBr", "br")]:
                assert type(line[key]) is int, (cid, key)
                totals[value] += line["quantity"] * line[key]
            source = sources[line["sourceId"]]
            assert line["pdfPage"] in source["visuallyReviewedPdfPages"], cid
            seen = {line["selectionId"]}
            parent = line["parentSelectionId"]
            while parent is not None:
                assert parent in by_id and parent not in seen, (cid, parent)
                seen.add(parent)
                parent = by_id[parent]["parentSelectionId"]
        assert totals == case["expectedTotals"], (cid, totals, case["expectedTotals"])
        assert set(case["expectedViolations"]) <= rules, cid
        assert set(case.get("unresolved", [])) <= ambiguities, cid
        for allocation in case.get("supportAllocations", []):
            assert allocation["producerSelectionId"] in by_id, cid
            assert allocation["consumerSelectionId"] in by_id, cid
            assert allocation["count"] > 0, cid
        assert set(case.get("unfundedSelections", [])) <= by_id.keys(), cid
        print(f"{cid}: {totals['points']} Points / {totals['br']} BR (manual ledger checked)")
    assert case_ids == {f"B{i:02}" for i in range(1, 5)} | {f"L{i:02}" for i in range(1, 11)} | {"S01", "S02"} | {f"F{i:02}" for i in range(1, 8)}
    print(f"PASS: 4 source hashes, {len(case_ids)} ledgers, references and parent links.")
    print("Not checked: game legality, option expansion, support rule execution or final schema.")


if __name__ == "__main__":
    main()
