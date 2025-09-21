function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.includes(req.session.user.role)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}
module.exports = { isAuthenticated, hasRole };
