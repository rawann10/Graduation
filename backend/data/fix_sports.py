"""
fix_sports.py
Reads SPORTSS (1).json, adds a unique_id field (sports_001, sports_002 …)
to every article using its row position, and saves the result as SPORTSS_fixed.json.

The existing article_number field is left untouched.
"""

import json

INPUT  = 'SPORTSS (1).json'
OUTPUT = 'SPORTSS_fixed.json'

with open(INPUT, encoding='utf-8') as f:
    data = json.load(f)

articles = data['articles']
print('=' * 55)
print(f'Total articles: {len(articles)}')

fixed = []
for i, article in enumerate(articles):
    a = dict(article)                         # shallow copy
    a['unique_id'] = f'sports_{i + 1:03d}'   # sports_001, sports_002 …
    fixed.append(a)

# Verify: all unique_ids are unique
ids = [a['unique_id'] for a in fixed]
assert len(ids) == len(set(ids)), 'unique_id collision — check logic!'

print(f'unique_ids assigned: {ids[0]} … {ids[-1]}')
print(f'All unique_ids distinct: ✓')

# Show first 5
print()
print('Sample:')
for a in fixed[:5]:
    print(f'  unique_id={a["unique_id"]}  article_number={a["article_number"]}  type={a["type"]}')

data['articles'] = fixed
with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print()
print(f'Saved → {OUTPUT}')
print('=' * 55)
