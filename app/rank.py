ALPH = "0123456789abcdefghijklmnopqrstuvwxyz"
A2I = {ch: i for i, ch in enumerate(ALPH)}
I2A = {i: ch for i, ch in enumerate(ALPH)}
MIN = 0
MAX = 35


def midpoint(left: str | None, right: str | None) -> str:
    """Compute a LexoRank-like midpoint string between left and right.

    left or right may be None to indicate -inf or +inf respectively.
    Returns a lowercase base-36 string such that left < result < right.
    """
    L = left or ""
    R = right or ""
    i = 0
    out: list[str] = []
    while True:
        l = A2I[L[i]] if i < len(L) else MIN
        r = A2I[R[i]] if i < len(R) else MAX
        if l + 1 < r:
            mid = (l + r) // 2
            out.append(I2A[mid])
            return "".join(out)
        out.append(I2A[l])
        i += 1

