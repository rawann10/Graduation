"""
fix_law159.py
Reads law_159_cleaned (1).json, assigns unique مكرر suffixes to every
duplicate article number, and saves the result as law_159_fixed.json.

Convention:
  - First occurrence of a number  → kept as-is        e.g. "129"
  - Second occurrence             → "129_مكرر_1"
  - Third occurrence              → "129_مكرر_2"
  ... and so on.

Both the `number` field and the `title` field are updated so they stay
consistent. The `id` field is also made unique.
"""

import json
import collections
import copy

INPUT  = 'law_159_cleaned (1).json'
OUTPUT = 'law_159_fixed.json'

# ── Load ──────────────────────────────────────────────────────────────────────
with open(INPUT, encoding='utf-8') as f:
    data = json.load(f)

articles = data['articles']

print('=' * 55)
print('BEFORE fix')
print('=' * 55)
print(f'Total articles : {len(articles)}')

nums = [a['number'] for a in articles]
counter = collections.Counter(nums)
dupes_before = {k: v for k, v in counter.items() if v > 1}
print(f'Duplicate numbers: {len(dupes_before)}')
for k in sorted(dupes_before, key=lambda x: int(x) if x.isdigit() else 0):
    print(f'  Article {k:>4} appears {dupes_before[k]} times')

# ── Fix ───────────────────────────────────────────────────────────────────────
# Track how many times we have already seen each number
seen = collections.defaultdict(int)

fixed_articles = []
for article in articles:
    a = copy.deepcopy(article)
    num = a['number']
    seen[num] += 1
    count = seen[num]

    if count == 1:
        # First occurrence — leave number and title unchanged
        pass
    else:
        # Subsequent occurrence — append مكرر suffix (1-based from second)
        suffix_index = count - 1          # 2nd → مكرر_1, 3rd → مكرر_2 …
        new_number = f'{num}_مكرر_{suffix_index}'
        a['number'] = new_number
        a['title']  = f'المادة {new_number}'
        # Make the id unique too so ChromaDB doesn't collide
        a['id']     = f'{a["id"]}_مكرر_{suffix_index}'

    fixed_articles.append(a)

# ── Verify uniqueness ────────────────────────────────────────────────────────
new_nums = [a['number'] for a in fixed_articles]
new_counter = collections.Counter(new_nums)
dupes_after = {k: v for k, v in new_counter.items() if v > 1}

print()
print('=' * 55)
print('AFTER fix')
print('=' * 55)
print(f'Total articles : {len(fixed_articles)}')
print(f'Duplicate numbers: {len(dupes_after)}')

if dupes_after:
    print('  !! Still has duplicates — check logic !!')
    for k, v in dupes_after.items():
        print(f'  Article {k} still appears {v} times')
else:
    print('  All article numbers are now unique ✓')

# ── Sample of changed articles ───────────────────────────────────────────────
print()
print('Sample of renamed articles (first 10 مكرر):')
shown = 0
for a in fixed_articles:
    if 'مكرر' in str(a['number']):
        print(f'  id={a["id"]:<35} number={a["number"]}')
        shown += 1
        if shown >= 10:
            break

# ── Save ──────────────────────────────────────────────────────────────────────
data['articles'] = fixed_articles
data['metadata']['total_articles'] = len(fixed_articles)
data['metadata']['source_file']    = OUTPUT
data['metadata']['fix_note']       = (
    'Duplicate article numbers resolved: first occurrence kept as-is, '
    'subsequent occurrences renamed to <number>_مكرر_<n>.'
)

with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print()
print(f'Saved → {OUTPUT}')
print('=' * 55)
