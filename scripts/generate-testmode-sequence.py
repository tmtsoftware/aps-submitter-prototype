#!/usr/bin/env python3
"""
Generates the APS software-only mode sequence template (testmode.json)
and writes it to apssubmitterprototype-backend/src/main/resources/sequences/testmode.json.

Run from the aps-submitter-prototype project root:
    python3 scripts/generate-testmode-sequence.py

The output file is committed to the repo and used by setup-config.sh
to populate the CSW Config Service.
"""

import json
import os


def is_scalar(x):
    return isinstance(x, (int, float, str, bool)) or x is None

def is_scalar_list(x):
    """Flat list of scalars — rendered on one line."""
    return isinstance(x, list) and all(is_scalar(el) for el in x)

def is_row(x):
    return isinstance(x, list) and all(isinstance(n, (int, float)) for n in x)

def is_matrix_wrapper(x):
    """[ <matrix> ] — the CSW FloatMatrixKey 'values' wrapper."""
    return (isinstance(x, list) and len(x) == 1
            and isinstance(x[0], list) and all(is_row(r) for r in x[0]))


class CompactMatrixEncoder(json.JSONEncoder):
    """
    Standard indented JSON encoding with two special cases:
    - Flat scalar lists (e.g. [11], [12.6], []) are kept on one line.
    - Matrix wrappers ([ [[r,g,b], ...] ]) render each row on one line,
      keeping the 492-row actuatorOffsets matrix readable without
      expanding to thousands of lines.
    """

    def iterencode(self, obj, _one_shot=False):
        return self._encode(obj, 0)

    def _encode(self, obj, level):
        ind  = ' ' * self.indent * level
        ind1 = ' ' * self.indent * (level + 1)
        ind2 = ' ' * self.indent * (level + 2)

        if isinstance(obj, dict):
            if not obj:
                yield '{}'
                return
            yield '{\n'
            items = list(obj.items())
            for i, (k, v) in enumerate(items):
                yield ind1 + json.dumps(k) + ': '
                yield from self._encode(v, level + 1)
                yield ',' if i < len(items) - 1 else ''
                yield '\n'
            yield ind + '}'

        elif is_matrix_wrapper(obj):
            mat = obj[0]
            yield '[\n'
            yield ind1 + '[\n'
            for i, row in enumerate(mat):
                yield ind2 + json.dumps(row)
                yield ',' if i < len(mat) - 1 else ''
                yield '\n'
            yield ind1 + ']\n'
            yield ind + ']'

        elif is_scalar_list(obj):
            yield json.dumps(obj)

        elif isinstance(obj, list):
            yield '[\n'
            for i, el in enumerate(obj):
                yield ind1
                yield from self._encode(el, level + 1)
                yield ',' if i < len(obj) - 1 else ''
                yield '\n'
            yield ind + ']'

        else:
            yield json.dumps(obj)


source = 'APS.sequenceSubmitter'

# 492 x 3 zero-initialised actuator offset matrix
matrix = [[0.0] * 3 for _ in range(492)]

# ESW-TS wire format: keyType is the top-level key, with keyName/values/units nested inside.
# maybeObsId is omitted (optional field — empty array is not valid, omission is).
sequence = [
    {
        '_type': 'Setup',
        'source': source,
        'commandName': 'calc-colorstep',
        'paramSet': [
            {'IntKey':   {'keyName': 'stepCount',  'values': [11],   'units': 'NoUnits'}},
            {'FloatKey': {'keyName': 'stepSizeNm', 'values': [12.6], 'units': 'NoUnits'}}
        ]
    },
    {
        '_type': 'Setup',
        'source': source,
        'commandName': 'cmd-m1cs-moves',
        'paramSet': [
            {
                'FloatMatrixKey': {
                    'keyName': 'actuatorOffsets',
                    'values': [matrix],
                    'units': 'millimeter'
                }
            }
        ]
    },
    {
        '_type': 'Setup',
        'source': source,
        'commandName': 'calc-tt-offsets-to-acts',
        'paramSet': []
    },
    {
        '_type': 'Setup',
        'source': source,
        'commandName': 'calc-decompose-acts',
        'paramSet': []
    }
]

out_dir = os.path.join(os.path.dirname(__file__),
                       'apssubmitterprototype-backend', 'src', 'main', 'resources', 'sequences')
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, 'testmode.json')

with open(out_path, 'w') as f:
    f.write(''.join(CompactMatrixEncoder(indent=2).iterencode(sequence)))
    f.write('\n')

print(f"Written: {os.path.normpath(out_path)}")
