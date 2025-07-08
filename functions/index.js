const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Configura le variabili d'ambiente per le credenziali email
// NON SCRIVERE LA PASSWORD DIRETTAMENTE NEL CODICE!
// Esegui questo comando nel terminale:
// firebase functions:config:set gmail.email="tua.email@gmail.com" gmail.password="tua-password-per-app"
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;

// Configura il "transporter" di Nodemailer
// Per Gmail, devi abilitare l'autenticazione a 2 fattori e generare una "Password per le app"
// https://support.google.com/accounts/answer/185833
const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

// La nostra funzione che si attiva alla creazione di una nuova richiesta email
exports.sendBookingConfirmationEmail = functions.region("europe-west1")
    .database.ref("/richieste-email/{pushId}")
    .onCreate(async (snapshot, context) => {
      const bookingDetails = snapshot.val();
      const pushId = context.params.pushId; // Questo è l'ID della prenotazione

      console.log(`Nuova richiesta di prenotazione ${pushId}, invio email a ${bookingDetails.email}`);

      const mailOptions = {
        from: `"C.T. Tricase" <${gmailEmail}>`,
        to: bookingDetails.email,
        subject: `Conferma Prenotazione Campo - ID: ${pushId}`,
        html: `
            <h1>Grazie per la tua prenotazione, ${bookingDetails.nome}!</h1>
            <p>Ciao ${bookingDetails.nome},</p>
            <p>La tua prenotazione presso il C.T. Tricase è stata confermata. Ecco i dettagli:</p>
            <ul>
                <li><strong>ID Prenotazione:</strong> ${pushId}</li>
                <li><strong>Data:</strong> ${new Date(bookingDetails.data).toLocaleDateString("it-IT", {weekday: "long", year: "numeric", month: "long", day: "numeric"})}</li>
                <li><strong>Campo:</strong> Campo ${bookingDetails.campo}</li>
                <li><strong>Orari:</strong> ${bookingDetails.orari}</li>
            </ul>
            <p>Ti aspettiamo!</p>
            <p><em>Staff C.T. Tricase</em></p>
        `,
      };

      try {
        await mailTransport.sendMail(mailOptions);
        console.log(`Email di conferma inviata con successo a ${bookingDetails.email}`);
        // Opzionale: Rimuovi la richiesta dal database dopo l'invio per non inviarla di nuovo
        return snapshot.ref.remove();
      } catch (error) {
        console.error("Errore nell'invio dell'email:", error);
        // Potresti voler gestire l'errore in modo più robusto, ad esempio impostando un flag di errore
        return null;
      }
    });