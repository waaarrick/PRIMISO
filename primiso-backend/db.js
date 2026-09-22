// Importe better-sqlite3, qui permet de créer/manipuler une base de données SQLite (un simple fichier)
const Database = require('better-sqlite3');

// Crée (ou ouvre si elle existe déjà) le fichier de base de données "primiso.db"
const db = new Database('primiso.db');

// Crée la table "chantiers" si elle n'existe pas déjà
db.exec(`
  CREATE TABLE IF NOT EXISTS chantiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    description TEXT,
    prestations TEXT,
    date_creation TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Crée la table "photos", liée à un chantier via chantier_id
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chantier_id INTEGER NOT NULL,
    chemin TEXT NOT NULL,
    FOREIGN KEY (chantier_id) REFERENCES chantiers(id) ON DELETE CASCADE
  )
`);

// Crée la table "admin" pour stocker le compte de connexion (email + mot de passe hashé)
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL
  )
`);

// Exporte l'objet db pour pouvoir l'utiliser dans d'autres fichiers (les routes)
module.exports = db;