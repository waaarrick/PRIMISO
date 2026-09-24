const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const db = require('./db');
const verifierToken = require('./auth-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Sert les photos uploadées comme fichiers statiques (accessibles via l'URL /uploads/nom-fichier.jpg)
app.use('/uploads', express.static('uploads'));

// Configure multer : où stocker les photos et comment les nommer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // Nom unique : timestamp + nom original, pour éviter les doublons
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.send('API PRIMISO en ligne');
});

app.get('/chantiers', (req, res) => {
  const chantiers = db.prepare('SELECT * FROM chantiers ORDER BY date_creation DESC').all();
  res.json(chantiers);
});

app.get('/chantiers/:id', (req, res) => {
  const chantier = db.prepare('SELECT * FROM chantiers WHERE id = ?').get(req.params.id);
  if (!chantier) {
    return res.status(404).json({ erreur: 'Chantier introuvable' });
  }
  // Récupère aussi les photos liées à ce chantier
  const photos = db.prepare('SELECT * FROM photos WHERE chantier_id = ?').all(req.params.id);
  res.json({ ...chantier, photos });
});

app.post('/auth/login', (req, res) => {
  const { email, motDePasse } = req.body;
  const admin = db.prepare('SELECT * FROM admin WHERE email = ?').get(email);
  if (!admin) {
    return res.status(401).json({ erreur: 'Identifiants invalides' });
  }
  const motDePasseValide = bcrypt.compareSync(motDePasse, admin.mot_de_passe);
  if (!motDePasseValide) {
    return res.status(401).json({ erreur: 'Identifiants invalides' });
  }
  const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
  res.json({ token });
});

// Construit une date ISO à partir d'une année saisie dans le formulaire admin.
// Si aucune année n'est fournie, on retombe sur la date/heure actuelle.
function construireDateCreation(annee) {
  const anneeValide = parseInt(annee, 10);
  if (!anneeValide || isNaN(anneeValide)) {
    return new Date().toISOString();
  }
  // 1er juillet de l'année choisie, pour éviter les décalages de fuseau horaire
  // qui feraient parfois basculer le 1er janvier sur l'année précédente à l'affichage.
  return new Date(Date.UTC(anneeValide, 6, 1)).toISOString();
}

// Route protégée : créer un nouveau chantier
// "verifierToken" s'exécute avant la fonction principale, bloque si pas de token valide
// "upload.array('photos', 10)" gère jusqu'à 10 photos envoyées sous le nom "photos"
app.post('/chantiers', verifierToken, upload.array('photos', 10), (req, res) => {
  const { titre, description, prestations, annee } = req.body;
  const dateCreation = construireDateCreation(annee);

  // Insère le nouveau chantier
  const resultat = db
    .prepare('INSERT INTO chantiers (titre, description, prestations, date_creation) VALUES (?, ?, ?, ?)')
    .run(titre, description, prestations, dateCreation);

  const chantierId = resultat.lastInsertRowid;

  // Si des photos ont été envoyées, les enregistre en base liées à ce chantier
  if (req.files) {
    const insererPhoto = db.prepare('INSERT INTO photos (chantier_id, chemin) VALUES (?, ?)');
    req.files.forEach((file) => {
      insererPhoto.run(chantierId, `/uploads/${file.filename}`);
    });
  }

  res.status(201).json({ id: chantierId, message: 'Chantier créé' });
});

// Route protégée : modifier un chantier existant
app.put('/chantiers/:id', verifierToken, upload.array('photos', 10), (req, res) => {
  const { titre, description, prestations, annee } = req.body;
  const dateCreation = construireDateCreation(annee);

  db.prepare('UPDATE chantiers SET titre = ?, description = ?, prestations = ?, date_creation = ? WHERE id = ?').run(
    titre,
    description,
    prestations,
    dateCreation,
    req.params.id
  );

  // Ajoute les nouvelles photos envoyées (les anciennes restent, sauf suppression explicite)
  if (req.files) {
    const insererPhoto = db.prepare('INSERT INTO photos (chantier_id, chemin) VALUES (?, ?)');
    req.files.forEach((file) => {
      insererPhoto.run(req.params.id, `/uploads/${file.filename}`);
    });
  }

  res.json({ message: 'Chantier modifié' });
});

// Route protégée : supprimer un chantier
app.delete('/chantiers/:id', verifierToken, (req, res) => {
  db.prepare('DELETE FROM chantiers WHERE id = ?').run(req.params.id);
  // Les photos liées sont supprimées automatiquement grâce à "ON DELETE CASCADE" dans db.js
  res.json({ message: 'Chantier supprimé' });
});

// Route protégée : supprimer une seule photo (sans toucher au reste du chantier)
app.delete('/photos/:id', verifierToken, (req, res) => {
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  res.json({ message: 'Photo supprimée' });
});

app.post('/contact', async (req, res) => {
  const { prenom, nom, email, sujet, message } = req.body;

  if (!prenom || !nom || !email || !sujet || !message) {
    return res.status(400).json({ succes: false, erreur: 'Tous les champs sont obligatoires.' });
  }

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValide) {
    return res.status(400).json({ succes: false, erreur: 'Email invalide.' });
  }

  try {
    const transporteur = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporteur.sendMail({
      from: `"${prenom} ${nom}" <${process.env.SMTP_USER}>`,
      to: 'contact@primiso.fr',
      replyTo: email,
      subject: `[Contact PRIMISO] ${sujet}`,
      text: `De : ${prenom} ${nom} (${email})\n\n${message}`,
    });

    res.json({ succes: true });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ succes: false, erreur: 'Erreur lors de l\'envoi.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});