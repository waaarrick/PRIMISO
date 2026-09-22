// Importe bcrypt pour hasher le mot de passe (jamais stocké en clair)
const bcrypt = require('bcrypt');
const db = require('./db');

// Remplace ces valeurs par ton propre email et mot de passe admin
const email = 'contact@primiso.fr';
const motDePasse = 'pRIMISO26';

// Hash le mot de passe avec 10 "rounds" (niveau de sécurité standard)
const hash = bcrypt.hashSync(motDePasse, 10);

// Insère le compte admin dans la base
db.prepare('INSERT INTO admin (email, mot_de_passe) VALUES (?, ?)').run(email, hash);

console.log('Compte admin créé avec succès !');
