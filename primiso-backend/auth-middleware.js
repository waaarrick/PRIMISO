const jwt = require('jsonwebtoken');

// Ce middleware vérifie que la requête contient un token JWT valide
// avant de laisser passer vers la route (ajout/modif/suppression de chantier)
function verifierToken(req, res, next) {
  // Le token est envoyé dans le header "Authorization", format: "Bearer <token>"
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ erreur: 'Token manquant' });
  }

  // Extrait le token en enlevant le mot "Bearer "
  const token = authHeader.split(' ')[1];

  try {
    // Vérifie le token avec la clé secrète — si invalide ou expiré, ça lève une erreur
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // Stocke les infos de l'admin dans la requête, utilisable après
    next(); // Autorise la suite (la route demandée)
  } catch (err) {
    return res.status(403).json({ erreur: 'Token invalide ou expiré' });
  }
}

module.exports = verifierToken;