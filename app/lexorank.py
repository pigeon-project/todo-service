ALPH = "0123456789abcdefghijklmnopqrstuvwxyz"
A2I = {ch: i for i, ch in enumerate(ALPH)}
I2A = {i: ch for i, ch in enumerate(ALPH)}
MIN = 0
MAX = 35

def normalize_key(key: str | None) -> str | None:
    if key is None:
        return None
    s = key.strip().lower()
    if not s:
        return None
    # Validate characters
    for ch in s:
        if ch not in A2I:
            raise ValueError("sortKey must be base-36 lowercase [0-9a-z]")
    return s

def midpoint(left: str | None, right: str | None) -> str:
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

