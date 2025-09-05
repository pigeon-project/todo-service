ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
CHAR_TO_INT = {ch: i for i, ch in enumerate(ALPHABET)}
INT_TO_CHAR = {i: ch for i, ch in enumerate(ALPHABET)}
MIN = 0
MAX = len(ALPHABET) - 1


def midpoint(left: str | None, right: str | None) -> str:
    """Compute a LexoRank-like midpoint key between left and right.

    left or right may be None, which is treated as infinite min/max.
    Guarantees: result is strictly between left and right (if both given).
    """
    L = left or ""
    R = right or ""
    i = 0
    out: list[str] = []
    while True:
        l = CHAR_TO_INT[L[i]] if i < len(L) else MIN
        r = CHAR_TO_INT[R[i]] if i < len(R) else MAX
        if l + 1 < r:
            mid = (l + r) // 2
            out.append(INT_TO_CHAR[mid])
            return "".join(out)
        out.append(INT_TO_CHAR[l])
        i += 1

