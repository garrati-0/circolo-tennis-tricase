// File: .github/scripts/cleanup.js

// Usiamo la sintassi 'require' per compatibilità con l'esecuzione Node.js su GitHub Actions
const admin = require('firebase-admin');

// --- Configurazione ---
// Recupera la chiave del service account dal segreto di GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// Trova questo URL nella tua console Firebase (Realtime Database)
const DATABASE_URL = 'https://ct-tricase-default-rtdb.europe-west1.firebasedatabase.app'; 
const MINUTES_TO_EXPIRE = 5; // Minuti prima che una prenotazione "pending" scada
const EXPIRATION_MS = MINUTES_TO_EXPIRE * 60 * 1000;

// --- Inizializzazione di Firebase ---
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL,
});

const db = admin.database();
const now = Date.now();

async function cleanupPendingBookings() {
    console.log(`Script avviato. Ricerca delle prenotazioni in sospeso più vecchie di ${MINUTES_TO_EXPIRE} minuti...`);
    const indexRef = db.ref('indicePrenotazioni');

    // Cerca tutte le prenotazioni con stato "pending"
    const snapshot = await indexRef.orderByChild('status').equalTo('pending').once('value');

    if (!snapshot.exists()) {
        console.log("Nessuna prenotazione in sospeso trovata. Termino.");
        return;
    }

    const updates = {}; // Raccogliamo qui tutte le eliminazioni per un'unica operazione atomica
    let expiredCount = 0;

    snapshot.forEach(childSnapshot => {
        const bookingId = childSnapshot.key;
        const booking = childSnapshot.val();
        const bookingTimestamp = booking.prenotatoIl;

        // Controlla se la prenotazione è scaduta
        if (now - bookingTimestamp > EXPIRATION_MS) {
            expiredCount++;
            console.log(`Trovata prenotazione scaduta ${bookingId}, creata il ${new Date(bookingTimestamp).toISOString()}`);

            // 1. Marca la voce nell'indice per l'eliminazione
            updates[`/indicePrenotazioni/${bookingId}`] = null;

            // 2. Marca gli slot orari effettivi in 'prenotazioni' per l'eliminazione
            const { data, campo, orari } = booking;
            orari.forEach(orario => {
                const timeSlotKey = orario.replace(':', '-');
                const slotPath = `/prenotazioni/${data}/campo-${campo}/${timeSlotKey}`;
                updates[slotPath] = null;
                console.log(` - Marco per l'eliminazione: ${slotPath}`);
            });
        }
    });

    if (expiredCount > 0) {
        console.log(`Eliminazione di ${expiredCount} prenotazioni scadute...`);
        // Esegui un unico aggiornamento multi-path per cancellare tutti i dati in modo atomico
        await db.ref().update(updates);
        console.log("Pulizia completata con successo!");
    } else {
        console.log("Nessuna prenotazione in sospeso da eliminare.");
    }
}

cleanupPendingBookings()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Errore durante la pulizia:", error);
        process.exit(1);
    });