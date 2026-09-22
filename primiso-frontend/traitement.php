<?php
// Inclure PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';

// Config SMTP : à déplacer hors du dossier public (ex: config.php non versionné)
require 'config.php'; // doit définir SMTP_USER et SMTP_PASSWORD

header('Content-Type: application/json');

// Champs attendus
$prenom = trim($_POST['prenom'] ?? '');
$nom    = trim($_POST['nom'] ?? '');
$email  = trim($_POST['email'] ?? '');
$sujet  = trim($_POST['sujet'] ?? '');
$messageTexte = trim($_POST['message'] ?? '');

// Validation basique côté serveur (ne jamais se fier uniquement au JS)
if ($prenom === '' || $nom === '' || $email === '' || $sujet === '' || $messageTexte === '') {
    http_response_code(400);
    echo json_encode(['succes' => false, 'erreur' => 'Tous les champs sont obligatoires.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['succes' => false, 'erreur' => 'Email invalide.']);
    exit;
}

// Échappement pour éviter l'injection dans le corps HTML de l'email
$prenomSafe = htmlspecialchars($prenom, ENT_QUOTES, 'UTF-8');
$nomSafe    = htmlspecialchars($nom, ENT_QUOTES, 'UTF-8');
$sujetSafe  = htmlspecialchars($sujet, ENT_QUOTES, 'UTF-8');
$messageSafe = nl2br(htmlspecialchars($messageTexte, ENT_QUOTES, 'UTF-8'));

$corpsMail = "<p><strong>Nom :</strong> {$prenomSafe} {$nomSafe}</p>"
           . "<p><strong>Email :</strong> {$email}</p>"
           . "<p><strong>Sujet :</strong> {$sujetSafe}</p>"
           . "<p><strong>Message :</strong><br>{$messageSafe}</p>";

$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASSWORD;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';

    // Recipients
    // Le "From" doit être le compte Gmail authentifié, sinon Gmail peut rejeter/spammer l'envoi
    $mail->setFrom(SMTP_USER, 'Site PRIMISO');
    $mail->addAddress('contact@primiso.fr');
    // Permet à PRIMISO de répondre directement au visiteur depuis sa boîte mail
    $mail->addReplyTo($email, "{$prenom} {$nom}");

    // Content
    $mail->isHTML(true);
    $mail->Subject = "[Contact site] {$sujetSafe}";
    $mail->Body    = $corpsMail;
    $mail->AltBody = "Nom : {$prenom} {$nom}\nEmail : {$email}\nSujet : {$sujet}\nMessage : {$messageTexte}";

    $mail->send();
    echo json_encode(['succes' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['succes' => false, 'erreur' => "L'envoi a échoué."]);
}