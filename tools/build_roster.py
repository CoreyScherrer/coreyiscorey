#!/usr/bin/env python
"""Generate the per-person roster JSON for the Croatia family hub.

Reads the encrypted discotheque graph (the source of truth for lineage and
identity) and emits a static JSON file the site renders client-side.

WHAT IS DELIBERATELY EXCLUDED: birth dates, death dates, and any document
content. The published file carries names, the ancestral chain, and checklist
status only — enough to be useful, not enough to be a dossier if the URL leaks.

Usage:
    python tools/build_roster.py            # write public/croatia/roster.json
    python tools/build_roster.py --stdout   # print instead (inspection)
"""
import sys, json, argparse, collections, hashlib

sys.path.insert(0, '/Users/admin/Services/discotheque')

from src.models import get_session          # noqa: E402
from src.crypto import decrypt              # noqa: E402
from sqlalchemy import text                 # noqa: E402

OUT = '/Users/admin/Sites-wt/coreyiscorey-site/public/croatia/roster.json'

# The applicant roster, from the family Pre-Application Checklist.
# generation: 2 = grandchild of an emigrant, 3 = great-grandchild, etc.
# route: 'chain' proves descent; 'spouse' applies via marriage.
ROSTER = [
    # (name, route, generation, intent, minor_of)
    # intent: 'yes' = confirmed applying · 'to_confirm' · 'with_parent' (minor)
    #         · 'not_eligible'.  Source: family Tracker sheet, 2026-07-23.
    ('Joan Marita Sullivan',    'chain',  2, 'to_confirm',   None),
    ('John Joseph Sullivan',    'spouse', 0, 'to_confirm',   None),
    ('Margaret Mary Sullivan',  'chain',  3, 'yes',          None),
    ('Corey John Scherrer',     'spouse', 0, 'yes',          None),
    ('Anna Natalia Sullivan',   'chain',  3, 'to_confirm',   None),
    ('Carl Burton Buher',       'spouse', 0, 'to_confirm',   None),
    ('Luca Anthony Sullivan',   'chain',  4, 'with_parent',  'Anna Natalia Sullivan'),
    ('Nora Margaret Sullivan',  'chain',  4, 'with_parent',  'Anna Natalia Sullivan'),
    ('Mark Maurice Sullivan',   'chain',  3, 'yes',          None),
    ('Ian Anthony Sullivan',    'chain',  3, 'yes',          None),
    ('Laura Rose Sullivan',     'chain',  3, 'to_confirm',   None),
    ('Rita Marie Grant',        'chain',  2, 'to_confirm',   None),
    ('Patrick Jeff Grant',      'spouse', 0, 'to_confirm',   None),
    ('Mark Patrick Grant',      'chain',  3, 'yes',          None),
    ('Stephen Joseph Grant',    'chain',  3, 'to_confirm',   None),
    ('Jeffery Charles Grant',   'chain',  3, 'to_confirm',   None),
    ('Natalie Kathryn Radich',  'chain',  3, 'yes',          None),
    ('Matt John Radich',        'chain',  3, 'yes',          None),
    ('Rosalia Gobeo',           'spouse', 0, 'to_confirm',   None),
    ('Dominic Radich',          'chain',  4, 'with_parent',  'Matt John Radich'),
    ('Trina Maureen Radich',    'chain',  2, 'to_confirm',   None),
    ('Michele Eileen Dahl',     'chain',  2, 'to_confirm',   None),
    ('Paula Ann Radich',        'chain',  2, 'to_confirm',   None),
    ('Kathleen Mary Radich',    'chain',  2, 'to_confirm',   None),
    ('Elizabeth Anna Dahl',     'chain',  3, 'to_confirm',   None),
    ('Kathy Hochstettler',      'chain',  0, 'not_eligible', None),
]

# The 10 standard per-person items, from the checklist.
CHECKLIST = [
    ('participation',  'Confirm participation + consulate jurisdiction'),
    ('birth_cert',     'Certified birth certificate (order 2)'),
    ('marriage_cert',  'Marriage certificate'),
    ('passport_copy',  'Notarized copy of US passport photo page'),
    ('state_apostille','State apostilles on birth/marriage certificates'),
    ('fbi_check',      'FBI Identity History Summary + federal apostille'),
    ('biography',      'Biography in Croatian (životopis)'),
    ('form',           'Application form (Obrazac 1 or 2)'),
    ('appointment',    'Consulate appointment booked'),
    ('uploaded',       'Everything uploaded to the family Drive folder'),
]

# Only these three hold Drive access and may edit anyone's record.
KEEPERS = ['Paula Ann Radich', 'Mark Patrick Grant', 'Mark Maurice Sullivan']

# Keeper email addresses, mirrored into roster.json so the page can show the
# right affordances. This is NOT a security boundary — the Cloudflare Access
# policy is what actually gates entry, and corrections are proposals a keeper
# applies by hand.
# Source: "Emails for login to Croatia Data" (Drive), 2026-07-23.
KEEPER_EMAILS = [
    'radichp2@frontier.com',      # Paula Radich — Record Keeper
    'grantmp14@gmail.com',        # Mark Grant — Orchestrator
    'markmsul@gmail.com',         # Mark Sullivan — Orchestrator
    'thecoreyis@gmail.com',       # Corey Scherrer — System Guide & Researcher
    'corey@coreyscherrer.com',    # Corey Scherrer — alternate
]

EMIGRANTS = {
    'Marco Radich (Radić)', 'Anna Radich (née Hlapcich / Hlapčić)',
    'Charles Andrew Turina', 'Matthew C. Vranizan', 'Lucretia Milašić',
}


# Person -> login email, from "Emails for login to Croatia Data" (Drive).
# Stored as a hash in the published file so addresses are never served.
PERSON_EMAIL = {
    'Mark Maurice Sullivan':  'markmsul@gmail.com',
    'Mark Patrick Grant':     'grantmp14@gmail.com',
    'Natalie Kathryn Radich': 'noodlenat9@comcast.net',
    'Ian Anthony Sullivan':   'iansullivan2010@gmail.com',
    'Matt John Radich':       'matt.radich@gmail.com',
    'Margaret Mary Sullivan': 'megsul99@hotmail.com',
    'Paula Ann Radich':       'radichp2@frontier.com',
    'Stephen Joseph Grant':   'StephenGrantMBA@outlook.com',
    'Laura Rose Sullivan':    'laurasullivan4@gmail.com',
    'Jeffery Charles Grant':  'jgrant1@outlook.com',
    'Corey John Scherrer':    'thecoreyis@gmail.com',
}


def ehash(email):
    """Short SHA-256 prefix — lets the page match a signed-in user to their
    row without publishing anyone's address."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16]


def slug(name):
    base = name.split('(')[0].strip().lower()
    return ''.join(c if c.isalnum() else '-' for c in base).strip('-')


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
    by_name = {v: k for k, v in label.items()}

    parents = collections.defaultdict(set)
    for a, b, t in s.execute(text(
            "SELECT source_node_id,target_node_id,edge_type FROM edges "
            "WHERE is_active AND edge_type IN ('child_of','parent_of')")):
        a, b = str(a), str(b)
        if t == 'child_of':
            parents[a].add(b)
        else:
            parents[b].add(a)

    def chain_to_emigrant(nid):
        """Shortest upward path from nid to a Croatian-born emigrant."""
        queue, seen = [(nid, [])], {nid}
        while queue:
            cur, path = queue.pop(0)
            name = label.get(cur, '?')
            if name in EMIGRANTS and cur != nid:
                return path + [name]
            for p in sorted(parents.get(cur, ()), key=lambda x: label.get(x, '')):
                if p not in seen:
                    seen.add(p)
                    queue.append((p, path + [name] if cur != nid else []))
        return []

    people = []
    for name, route, gen, intent, minor_of in ROSTER:
        nid = by_name.get(name)
        p = props.get(nid, {}) if nid else {}
        core = name.split('(')[0].strip()
        email = PERSON_EMAIL.get(name)
        people.append({
            'slug': slug(name),
            'name': name,
            'display': core,
            'has_legal_name': len(core.split()) >= 3,
            'route': route,
            'generation': gen,
            'keeper': name in KEEPERS,
            'chain': chain_to_emigrant(nid) if nid else [],
            'needs_verification': bool(p.get('needs_verification')),
            # Hash, never the address itself — this file is served to browsers.
            'email_hash': ehash(email) if email else None,
            'has_login': bool(email),
            'intent': intent,
            'minor_of': minor_of,
            'residence': p.get('residence'),
            'venue': p.get('venue'),
            'checklist': [{'key': k, 'label': l, 'status': 'unknown'} for k, l in CHECKLIST],
        })

    out = {
        'generated': '2026-07-23',
        'source': 'discotheque graph (encrypted) + family Pre-Application Checklist',
        'note': 'Names and lineage only. No dates, no document contents.',
        'keepers': [slug(k) for k in KEEPERS],
        'checklist_start_stage': 2,
        # Hashed, not plaintext: roster.json is fetched by the browser, so
        # publishing real addresses here would expose them to anyone who
        # reaches the page. The page hashes the signed-in Access email and
        # compares. This only toggles UI affordances — Access is the gate.
        'keeper_email_hashes': [
            hashlib.sha256(e.strip().lower().encode()).hexdigest()[:16]
            for e in KEEPER_EMAILS
        ],
        'checklist_template': [{'key': k, 'label': l} for k, l in CHECKLIST],
        'people': people,
    }

    text_out = json.dumps(out, ensure_ascii=False, indent=2)
    if args.stdout:
        print(text_out)
    else:
        with open(OUT, 'w', encoding='utf-8') as fh:
            fh.write(text_out + '\n')
        missing = sum(1 for x in people if not x['has_legal_name'])
        print(f"wrote {OUT}")
        print(f"  {len(people)} people · {missing} missing a full legal name")


if __name__ == '__main__':
    main()
