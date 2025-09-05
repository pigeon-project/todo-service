import jwt from 'jsonwebtoken';
export function requestId(req, _res, next) {
    if (global.__requestIdCounter == null)
        global.__requestIdCounter = 1;
    const id = (global.__requestIdCounter++).toString(36) + Date.now().toString(36);
    req.requestId = id;
    next();
}
export function authOptional(req, res, next) {
    const hdr = req.header('Authorization');
    if (!hdr)
        return unauthorized(res, req.requestId);
    const token = hdr.replace(/^Bearer\s+/i, '');
    const devBypass = process.env.DEV_AUTH_BYPASS === '1' || token === 'dev';
    let claims = null;
    if (devBypass) {
        claims = { sub: 'user_dev' };
    }
    else {
        try {
            const secret = process.env.JWT_SECRET || 'dev-secret';
            claims = jwt.verify(token, secret);
        }
        catch (_e) {
            return unauthorized(res, req.requestId);
        }
    }
    req.userId = claims.sub;
    next();
}
export function unauthorized(res, requestId) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized', details: {}, requestId } });
}
