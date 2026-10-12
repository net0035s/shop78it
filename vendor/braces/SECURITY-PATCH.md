# Local security fork of braces 3.0.3

Source: installed upstream braces 3.0.3, https://github.com/micromatch/braces/tree/3.0.3 (MIT; LICENSE preserved).
Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

This is a project-maintained fork, version 3.0.4-shop78it.1. It is NOT an upstream release or an upstream claim that the advisory is fixed. All source except the documented guards is retained.

The parser refuses a nesting stack greater than 64 before an internal recursive stringify can run. Compile, expand and stringify use an iterative AST check before recursive walks. It detects child cycles and limits depth to 64, including callers passing an AST directly or importing lib files. The bound cannot be disabled using options. Excess depth throws a controlled RangeError with code ERR_BRACES_DEPTH; it does not cause a stack exhaustion.

Normal shallow syntax retains upstream behavior. Deep patterns previously accepted are deliberately rejected. This patch addresses the reported recursive AST depth issue; it is not a general bound on expansion cardinality or every possible malicious custom JavaScript object. Upstream rangeLimit and maxLength remain in place.

`scripts/test-braces-patch.cjs` compares a normal pattern corpus against an unmodified copy and checks deep balanced/unclosed braces, parentheses, deep/cyclic ASTs, direct lib entry points, and that normal processing works after rejection. Lint and the real storefront build must also pass. CI audit stays enabled. Revisit this local fork when an upstream fix becomes available.
