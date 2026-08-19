#!/usr/bin/env python3
"""generate-feature-graph.py -- regenerate a Mermaid dependency graph from a feature-list.json.

Shared across every part of this repo's harness that tracks work in a feature-list.json shape
(repo root, devops/, and .claude/skills/devops-request-grant/) so there is exactly ONE graph
renderer to maintain, not three hand-rolled diagrams that drift out of sync with their data.

Two modes:

  dependsOn (default) -- for a normal feature-list.json where each feature's own `dependsOn`
  array names prerequisite feature ids from the SAME file. Draws prerequisite -> dependent edges,
  grouped into one Mermaid subgraph per `tier` if the features carry a tier field.

  blocks -- for a grant-request-style feature-list.json (see
  .claude/skills/devops-request-grant/feature-list.json) where each entry's `blockedFeature`
  field names a feature id in a DIFFERENT file (--external). Draws grant -> blocked-feature
  edges; the external file is only used to resolve a nicer label, never modified.

Output is written between marker comments so this script can safely coexist with hand-written
content elsewhere in the same file (e.g. a static architecture diagram above the generated
section) -- only the text between the markers is ever replaced. If the markers aren't present
yet, they're appended to the end of the file (or the file is created if it doesn't exist).

Usage:
  scripts/generate-feature-graph.py <feature-list.json> --out <graph.md> [--relation dependsOn|blocks]
                                     [--external <other-feature-list.json>] [--title "..."]

Exit code is 0 on success, 1 if the input JSON doesn't parse or an id referenced by an edge
doesn't exist (a broken edge is a bug worth surfacing, not silently dropping).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MARK_BEGIN = "<!-- GENERATED:feature-graph:BEGIN (do not edit by hand -- run scripts/generate-feature-graph.py) -->"
MARK_END = "<!-- GENERATED:feature-graph:END -->"

STATUS_STYLE = {
    "passing":    ("#c8e6c9", "#2e7d32"),
    "verified":   ("#c8e6c9", "#2e7d32"),
    "failing":    ("#eeeeee", "#757575"),
    "requested":  ("#eeeeee", "#757575"),
    "blocked":    ("#ffcdd2", "#c62828"),
    "denied":     ("#ffcdd2", "#c62828"),
    "in_progress":("#fff9c4", "#f9a825"),
    "dispatched": ("#fff9c4", "#f9a825"),
    "applied":    ("#fff9c4", "#f9a825"),
}
DEFAULT_STYLE = ("#e0e0e0", "#616161")


def node_id(raw: str) -> str:
    """Mermaid node ids can't contain '.'/'-' unquoted; sanitize, keep raw text as the label."""
    return "n_" + re.sub(r"[^A-Za-z0-9_]", "_", raw)


def load(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def render_dependson(data: dict, title: str) -> str:
    features = {f["id"]: f for f in data["features"]}
    tiers: dict = {}
    for f in data["features"]:
        tiers.setdefault(f.get("tier", 0), []).append(f)

    lines = ["```mermaid", "flowchart TD"]
    for tier in sorted(tiers):
        lines.append(f'    subgraph tier{tier}["Tier {tier}"]')
        for f in tiers[tier]:
            nid = node_id(f["id"])
            label = f["id"].replace('"', "'")
            lines.append(f'        {nid}["{label}"]')
        lines.append("    end")

    edge_lines = []
    for f in data["features"]:
        for dep in f.get("dependsOn", []):
            if dep not in features:
                print(f"[ERROR] {f['id']} depends on unknown id '{dep}'", file=sys.stderr)
                sys.exit(1)
            edge_lines.append(f"    {node_id(dep)} --> {node_id(f['id'])}")
    lines.extend(edge_lines)

    for f in data["features"]:
        fill, stroke = STATUS_STYLE.get(f.get("status", ""), DEFAULT_STYLE)
        lines.append(f"    style {node_id(f['id'])} fill:{fill},stroke:{stroke}")
    lines.append("```")

    counts: dict = {}
    for f in data["features"]:
        counts[f.get("status", "?")] = counts.get(f.get("status", "?"), 0) + 1
    summary = ", ".join(f"{n} {s}" for s, n in sorted(counts.items()))

    header = f"### {title}\n\n_{len(data['features'])} features: {summary}._\n"
    return header + "\n" + "\n".join(lines)


def render_blocks(data: dict, external: dict | None, title: str) -> str:
    ext_titles = {f["id"]: f.get("title", f["id"]) for f in external["features"]} if external else {}

    lines = ["```mermaid", "flowchart LR"]
    seen_external: set = set()
    for f in data["features"]:
        nid = node_id(f["id"])
        label = f["id"].replace('"', "'")
        lines.append(f'    {nid}["{label}"]')

        blocked = f.get("blockedFeature")
        if blocked:
            ext_nid = node_id(f"ext_{blocked}")
            if blocked not in seen_external:
                ext_label = ext_titles.get(blocked, blocked).replace('"', "'")
                lines.append(f'    {ext_nid}["{blocked}<br/>{ext_label}"]')
                seen_external.add(blocked)
            edge_label = f.get("status", "")
            lines.append(f"    {nid} -- \"{edge_label}\" --> {ext_nid}")

    for f in data["features"]:
        fill, stroke = STATUS_STYLE.get(f.get("status", ""), DEFAULT_STYLE)
        lines.append(f"    style {node_id(f['id'])} fill:{fill},stroke:{stroke}")
    lines.append("```")

    header = f"### {title}\n\n_{len(data['features'])} grant entries._\n"
    return header + "\n" + "\n".join(lines)


def splice(out_path: Path, generated: str) -> None:
    block = f"{MARK_BEGIN}\n\n{generated}\n\n{MARK_END}"
    if out_path.exists():
        text = out_path.read_text()
        if MARK_BEGIN in text and MARK_END in text:
            pre = text.split(MARK_BEGIN)[0].rstrip("\n")
            post = text.split(MARK_END)[1].lstrip("\n")
            new_text = (pre + "\n\n" if pre else "") + block + ("\n\n" + post if post else "\n")
        else:
            new_text = text.rstrip("\n") + "\n\n" + block + "\n"
    else:
        new_text = block + "\n"
    out_path.write_text(new_text)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("feature_list", type=Path)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--relation", choices=["dependsOn", "blocks"], default="dependsOn")
    p.add_argument("--external", type=Path, default=None)
    p.add_argument("--title", default=None)
    args = p.parse_args()

    data = load(args.feature_list)
    title = args.title or data.get("meta", {}).get("project", args.feature_list.stem)

    if args.relation == "dependsOn":
        generated = render_dependson(data, title)
    else:
        external = load(args.external) if args.external else None
        generated = render_blocks(data, external, title)

    splice(args.out, generated)
    print(f"[ok] wrote generated graph section to {args.out}")


if __name__ == "__main__":
    main()
