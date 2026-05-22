"""
fix_law159_ocr.py
Fixes common OCR broken Arabic ligatures in law_159_fixed.json content fields.
Saves the result as law_159_final.json and reports how many articles were changed.
"""

import json
import copy

INPUT  = 'law_159_fixed.json'
OUTPUT = 'law_159_final.json'

REPLACEMENTS = [
    ('احملدودة',  'المحدودة'),
    ('اجلريدة',  'الجريدة'),
    ('الرمسية',  'الرسمية'),
    ('بألسهم',   'بالأسهم'),
    ('مبا',      'بما'),
    ('مبجرد',    'بمجرد'),
    ('الناجتة',  'الناتجة'),
    ('اتختص',    'اختص'),
]

with open(INPUT, encoding='utf-8') as f:
    data = json.load(f)

articles = data['articles']
changed_count = 0
fix_tally = {bad: 0 for bad, _ in REPLACEMENTS}

fixed_articles = []
for article in articles:
    a = copy.deepcopy(article)
    original_content = a.get('content', '')
    new_content = original_content

    for bad, good in REPLACEMENTS:
        occurrences = new_content.count(bad)
        if occurrences:
            fix_tally[bad] += occurrences
            new_content = new_content.replace(bad, good)

    if new_content != original_content:
        a['content'] = new_content
        changed_count += 1

    fixed_articles.append(a)

print('=' * 55)
print('OCR ligature fix — law_159')
print('=' * 55)
print(f'Total articles  : {len(articles)}')
print(f'Articles changed: {changed_count}')
print()
print('Replacements made (per pattern):')
for bad, good in REPLACEMENTS:
    n = fix_tally[bad]
    if n:
        print(f'  {bad:15} → {good:15}  ×{n}')
    else:
        print(f'  {bad:15}   (not found)')

data['articles'] = fixed_articles

with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print()
print(f'Saved → {OUTPUT}')
print('=' * 55)
