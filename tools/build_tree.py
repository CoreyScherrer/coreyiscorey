#!/usr/bin/env python
"""Generate tree.json — the Radich/Sullivan/Vranizan lineage only.

The discotheque graph holds every person Corey knows: Scherrer relatives,
friends, colleagues. This walks outward from the five Croatian-born
emigrants across family edges only, so the published tree contains the
lineage and nobody else.

Published fields are names, years, FamilySearch ids and name variants —
no contact details, no document contents.

Usage:  python tools/build_tree.py [--stdout]
"""
import sys, json, argparse, collections

sys.path.insert(0, '/Users/admin/Services/discotheque')

from src.models import get_session      # noqa: E402
from src.crypto import decrypt          # noqa: E402
from sqlalchemy import text             # noqa: E402

OUT = '/Users/admin/Sites-wt/coreyiscorey-site/public/croatia/tree.json'

EMIGRANTS = [
    'Marco Radich (Radić)',
    'Anna Radich (née Hlapcich / Hlapčić)',
    'Charles Andrew Turina',
    'Matthew C. Vranizan',
    'Lucretia Milašić',
]

# Family edges only. 'knows'/'worked_at'/etc. would drag in the address book.
FAMILY = ('child_of', 'parent_of', 'spouse_of', 'sibling_of',
          'step_parent_of', 'step_child_of', 'in_law_of')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stdout', action='store_true')
    args = ap.parse_args()
    s = get_session()

    rows = s.execute(text(
        "SELECT id,label_enc,properties_enc FROM nodes "
        "WHERE node_type='person' AND is_active")).fetchall()
    label, props = {}, {}
    for r in rows:
        lab = decrypt(bytes(r[1]), s) if r[1] else None
        if not lab:
            continue
        label[str(r[0])] = lab
        try:
            props[str(r[0])] = json.loads(decrypt(bytes(r[2]), s) or '{}') if r[2] else {}
        except (ValueError, TypeError):
            props[str(r[0])] = {}

    # Undirected adjacency — a one-way spouse_of edge must still connect,
    # which is how Corey was nearly dropped from his own family tree.
    adj = collections.defaultdict(set)
    edges = {'child_of': [], 'spouse_of': []}
    for a, b, t in s.execute(text(
            "SELECT source_node_id,target_node_id,edge_type FROM edges "
            "WHERE is_active AND edge_type = ANY(CAST(:f AS varchar[]))"),
            {'f': list(FAMILY)}):
        a, b = str(a), str(b)
        if a not in label or b not in label:
            continue
        adj[a].add(b)
        adj[b].add(a)
        if t == 'child_of':
            edges['child_of'].append((a, b))
        elif t == 'parent_of':
            edges['child_of'].append((b, a))
        elif t == 'spouse_of':
            edges['spouse_of'].append((a, b))

    seeds = [i for i, l in label.items() if l in EMIGRANTS]
    if not seeds:
        raise SystemExit('no emigrant seed found — check the EMIGRANTS list')

    keep, queue = set(seeds), list(seeds)
    while queue:
        n = queue.pop()
        for m in adj.get(n, ()):
            if m not in keep:
                keep.add(m)
                queue.append(m)

    def dedupe(pairs):
        seen, out = set(), []
        for a, b in pairs:
            if a in keep and b in keep and (a, b) not in seen:
                seen.add((a, b))
                out.append([a[:8], b[:8]])
        return out

    # ---- generation tiers -------------------------------------------------
    # Counting ancestor links puts anyone with no recorded parents at the top,
    # which dumped every married-in spouse (John Joseph, Corey, Carl, Kathy)
    # into generation 1. Instead we anchor on the Radich grandparents and walk
    # down; spouses then inherit their partner's tier.
    ANCHORS = {'Anthony John Radich', 'Margaret Radich'}
    TIER_NAMES = {1: 'Parents', 2: 'Children', 3: 'Grandchildren',
                  4: 'Great-Grandchildren', 5: 'Great-Great-Grandchildren'}

    kids_of = collections.defaultdict(set)
    for c, p in edges['child_of']:
        if c in keep and p in keep:
            kids_of[p].add(c)
    spouse_of = collections.defaultdict(set)
    for a, b in edges['spouse_of']:
        if a in keep and b in keep:
            spouse_of[a].add(b)
            spouse_of[b].add(a)

    anchor_ids = [i for i in keep if label[i] in ANCHORS]
    tier = {}
    frontier = set(anchor_ids)
    level = 1
    while frontier and level < 12:
        for i in frontier:
            tier.setdefault(i, level)
        nxt = set()
        for i in frontier:
            for k in kids_of.get(i, ()):
                if k not in tier:
                    nxt.add(k)
        level += 1
        frontier = nxt

    # Spouses sit beside their partner, not above them.
    for _ in range(3):
        for i in list(keep):
            if i in tier:
                continue
            partner_tiers = [tier[s] for s in spouse_of.get(i, ()) if s in tier]
            if partner_tiers:
                tier[i] = min(partner_tiers)

    # Blood descendants are those reached by walking down from the anchors;
    # anyone else placed in a tier got there by marriage.
    blood = set(anchor_ids)
    wave = set(anchor_ids)
    while wave:
        nxt = set()
        for i in wave:
            for k in kids_of.get(i, ()):
                if k not in blood:
                    blood.add(k)
                    nxt.add(k)
        wave = nxt

    people = []
    for i in sorted(keep, key=lambda x: label[x]):
        p = props.get(i, {})
        t = tier.get(i)          # None => ancestor, above the grandparents
        people.append({
            'id': i[:8],
            'name': label[i],
            'fs': p.get('fs_id'),
            'b': p.get('birth_year'),
            'bd': p.get('birth_date'),
            'd': p.get('death_year'),
            'living': bool(p.get('living')),
            'tier': t,
            'tier_name': TIER_NAMES.get(t) if t else 'Ancestors',
            'married_in': t is not None and i not in blood,
            'spouse_ids': sorted(x[:8] for x in spouse_of.get(i, ())),
            'variants': p.get('name_variants'),
        })

    out = {
        'generated': '2026-07-23',
        'scope': 'Radich / Sullivan / Vranizan lineage — walked from the Croatian-born emigrants',
        'people': people,
        'child_of': dedupe(edges['child_of']),
        'spouse_of': dedupe(edges['spouse_of']),
    }

    txt = json.dumps(out, ensure_ascii=False, indent=1)
    if args.stdout:
        print(txt)
    else:
        with open(OUT, 'w', encoding='utf-8') as fh:
            fh.write(txt + '\n')
        dropped = len(label) - len(keep)
        print(f'wrote {OUT}')
        print(f'  {len(people)} in the lineage · {dropped} unrelated people excluded')


if __name__ == '__main__':
    main()
