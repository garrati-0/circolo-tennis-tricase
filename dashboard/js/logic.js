document.addEventListener('DOMContentLoaded', () => {
        const firebaseConfig = {
            apiKey: "AIzaSyCxetNrmEOQJYwunOo-OQddzCMfP7DEtIU",
            authDomain: "ct-tricase.firebaseapp.com",
            databaseURL: "https://ct-tricase-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "ct-tricase",
            storageBucket: "ct-tricase.appspot.com",
            messagingSenderId: "931504527474",
            appId: "1:931504527474:web:165880ec30f3785ff54aeb",
            measurementId: "G-7M4D22L352"
        };

        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        
        // --- DOM Elements ---
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');
        const prevDayBtn = document.getElementById('prev-day');
        const nextDayBtn = document.getElementById('next-day');
        const todayBtn = document.getElementById('today-btn');
        const datepickerBtn = document.getElementById('datepicker-btn');
        const unpaidBtn = document.getElementById('unpaid-btn');
        const currentDateElem = document.getElementById('current-date');
        const calendarGrid = document.getElementById('calendar-grid');
        const noBookingsMsg = document.getElementById('no-bookings');
        
        const recurringForm = document.getElementById('recurring-form');
        const recurringListDiv = document.getElementById('recurring-list');
        const recurringFieldSelect = document.getElementById('recurring-field');
        const recurringTimeStartSelect = document.getElementById('recurring-time-start');
        const recurringTimeEndSelect = document.getElementById('recurring-time-end');
        
        // MOBILE ONLY
        const mobileFieldSelector = document.querySelector('.mobile-field-selector');

        // Modals
        const bookingModal = document.getElementById('booking-modal');
        const editBookingModal = document.getElementById('edit-booking-modal');
        const cancellationModal = document.getElementById('cancellation-modal');
        const confirmModal = document.getElementById('confirm-modal');
        const unpaidModal = document.getElementById('unpaid-modal');
        const searchResultsModal = document.getElementById('search-results-modal');
        const unpaidSearchInput = document.getElementById('unpaid-search-input');
        const unpaidSearchForm = document.getElementById('unpaid-search-form');
        
        const manualBookingForm = document.getElementById('manual-booking-form');
        const editBookingForm = document.getElementById('edit-booking-form');
        const cancellationForm = document.getElementById('cancellation-form');

        // --- State ---
        let currentDate = new Date();
        let currentBookingsListener = null;
        let recurringBookings = {};

        // --- FIX: Timezone-safe date formatting helper ---
        const toLocalISOString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 because getMonth() is 0-indexed
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // --- Initialization ---
        const fp = flatpickr(datepickerBtn, {
            locale: "it",
            dateFormat: "Y-m-d",
            defaultDate: "today",
            onChange: function(selectedDates, dateStr, instance) {
                currentDate = selectedDates[0];
                listenToBookingsForDate();
            },
        });

        // --- Toast Notification Function ---
        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            
            let iconClass = 'fa-solid fa-circle-info';
            if (type === 'success') iconClass = 'fa-solid fa-circle-check';
            if (type === 'error') iconClass = 'fa-solid fa-circle-xmark';

            toast.innerHTML = `
                <div class="toast-icon"><i class="${iconClass}"></i></div>
                <div class="toast-message">${message}</div>
            `;
            container.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 100);
            setTimeout(() => {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove());
            }, 4000);
        }
        
        // --- Skeleton Loader ---
        function showSkeletonLoader() {
            calendarGrid.innerHTML = '';
            const skeletonContainer = document.createElement('div');
            skeletonContainer.className = 'skeleton-loader';
            skeletonContainer.id = 'skeleton-loader';

            let skeletonHTML = '';
            for (let i = 0; i < 17; i++) { // 17 hours from 7 to 23
                skeletonHTML += '<div class="skeleton-item time-label-skeleton"></div>';
                for (let j = 0; j < 3; j++) {
                    skeletonHTML += '<div class="skeleton-item"></div>';
                }
            }
            skeletonContainer.innerHTML = skeletonHTML;
            calendarGrid.appendChild(skeletonContainer);
        }

        function hideSkeletonLoader() {
            const loader = document.getElementById('skeleton-loader');
            if (loader) loader.remove();
        }

        // --- Calendar Rendering ---
        const renderCalendar = (dayBookings = {}) => {
            hideSkeletonLoader();
            calendarGrid.innerHTML = '';
            
            const currentDayOfWeek = currentDate.getDay();
            for (const id in recurringBookings) {
                const rb = recurringBookings[id];
                if (parseInt(rb.giornoSettimana) === currentDayOfWeek) {
                    const fieldId = `campo-${rb.campo}`;
                    const timeKey = rb.orario.replace(':', '-');
                    if (!dayBookings[fieldId]) dayBookings[fieldId] = {};
                    if (!dayBookings[fieldId][timeKey]) {
                        dayBookings[fieldId][timeKey] = {
                            nome: rb.nome, cognome: '(Ricorrente)', telefono: 'N/A',
                            email: 'N/A', isRecurring: true,
                        };
                    }
                }
            }
            
            let totalBookings = 0;
            Object.values(dayBookings).forEach(field => {
                totalBookings += Object.values(field).filter(Boolean).length;
            });

            noBookingsMsg.style.display = totalBookings === 0 ? 'block' : 'none';
            
            const fragment = document.createDocumentFragment();
            const slots = {}; 

            for (let hour = 7; hour < 24; hour++) {
                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-label';
                timeLabel.textContent = `${String(hour).padStart(2, '0')}:00`;
                fragment.appendChild(timeLabel);
                for (let field = 1; field <= 3; field++) {
                    const slotId = `slot-${hour}-${field}`;
                    const slotDiv = document.createElement('div');
                    slotDiv.className = `time-slot field-${field}`; // MOD: Added field-X class
                    slotDiv.id = slotId;
                    slots[slotId] = slotDiv; 
                    fragment.appendChild(slotDiv);
                }
            }

            for (const fieldId in dayBookings) {
                const fieldBookings = dayBookings[fieldId];
                const fieldNumber = fieldId.split('-')[1];

                for (const time in fieldBookings) {
                    const booking = fieldBookings[time];
                    if (!booking) continue;
                    const [startHour] = time.replace('-',':').split(':').map(Number);
                    const targetSlotId = `slot-${startHour}-${fieldNumber}`;
                    const targetSlot = slots[targetSlotId];
                    
                    if (targetSlot) {
                        const card = document.createElement('div');
                        card.className = 'booking-card';
                        card.dataset.bookingIdentifier = `${fieldId}-${time}`;
                        
                        if (booking.isRecurring) {
                            card.classList.add('recurring');
                        } else {
                            card.classList.add(booking.pagato ? 'paid' : 'unpaid');
                        }
                        
                        let deleteButtonHTML = '';
                        if (!booking.isRecurring) {
                            deleteButtonHTML = `<button class="delete-btn" data-field="${fieldId}" data-time="${time.replace(':', '-')}" data-booking-id="${booking.bookingId || ''}" title="Cancella prenotazione"><i class="fa-solid fa-trash-can"></i></button>`;
                        }

                        card.innerHTML = `
                            ${deleteButtonHTML}
                            <div class="booking-card-content" data-field="${fieldId}" data-time="${time}">
                                <strong>${booking.nome || 'N/A'} ${booking.cognome || ''}</strong>
                                <p><i class="fa-solid fa-clock fa-fw"></i> ${time.replace('-',':')} ${booking.isRecurring ? '<i class="fa-solid fa-sync recurring-icon" title="Ricorrente"></i>' : ''}</p>
                                <p><i class="fa-solid fa-phone fa-fw"></i> ${booking.telefono || '-'}</p>
                                <p><i class="fa-solid fa-envelope fa-fw"></i> ${booking.email || '-'}</p>
                                ${booking.note ? `<p class="booking-notes"><i class="fa-solid fa-note-sticky fa-fw"></i> ${booking.note}</p>` : ''}
                            </div>`;
                        
                        targetSlot.appendChild(card);
                    }
                }
            }

            Object.values(slots).forEach(slot => {
                if (slot.childElementCount === 0) {
                    slot.classList.add('empty');
                    const [, hour, field] = slot.id.split('-');
                    let minutes = '00';
                    if (field === '2') minutes = '15';
                    else if (field === '3') minutes = '30';
                    const timeString = `${String(hour).padStart(2, '0')}:${minutes}`;
                    
                    slot.dataset.time = timeString;
                    slot.dataset.field = field;
                }
            });

            calendarGrid.appendChild(fragment);
        };

        const listenToBookingsForDate = () => {
            if (currentBookingsListener) { currentBookingsListener.off(); }
            showSkeletonLoader();
            noBookingsMsg.style.display = 'none';
            currentDateElem.textContent = new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(currentDate);
            fp.setDate(currentDate, false);
            
            // --- FIX APPLIED HERE ---
            const dateString = toLocalISOString(currentDate);
            // --- END OF FIX ---

            const bookingsRef = database.ref('prenotazioni/' + dateString);
            currentBookingsListener = bookingsRef;
            
            bookingsRef.on('value', (snapshot) => {
                const bookings = snapshot.val() || {};
                renderCalendar(bookings);
            }, (error) => {
                console.error("Errore di Firebase:", error);
                showToast("Errore nel caricamento dei dati.", 'error');
                hideSkeletonLoader();
            });
        };
        
        const renderRecurringList = () => {
            recurringListDiv.innerHTML = '';
            if (Object.keys(recurringBookings).length === 0) {
                recurringListDiv.innerHTML = '<p>Nessuna prenotazione ricorrente impostata.</p>';
                return;
            }

            const bookingsByDay = {};
            for (const id in recurringBookings) {
                const booking = { ...recurringBookings[id], id }; 
                const day = booking.giornoSettimana;
                if (!bookingsByDay[day]) bookingsByDay[day] = [];
                bookingsByDay[day].push(booking);
            }

            const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
            const dayOrder = [1, 2, 3, 4, 5, 6, 0]; 

            dayOrder.forEach(dayIndex => {
                if (bookingsByDay[dayIndex]) {
                    const dayName = days[dayIndex];
                    const dayBookings = bookingsByDay[dayIndex];
                    dayBookings.sort((a, b) => a.orario.localeCompare(b.orario));

                    const header = document.createElement('button');
                    header.className = 'recurring-day-header';
                    header.innerHTML = `<span>${dayName}</span> <span style="font-weight:normal; color: var(--colore-testo-secondario); font-size: 0.9rem;">${dayBookings.length} prenotazioni</span>`;
                    
                    const content = document.createElement('div');
                    content.className = 'recurring-day-content';
                    const ul = document.createElement('ul');
                    
                    dayBookings.forEach(rb => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <span><strong>${rb.nome}</strong> - ore ${rb.orario}, Campo ${rb.campo}</span>
                            <button class="delete-recurring-btn" data-id="${rb.id}" title="Cancella ricorrente"><i class="fa-solid fa-trash-can"></i></button>
                        `;
                        ul.appendChild(li);
                    });
                    
                    content.appendChild(ul);
                    recurringListDiv.appendChild(header);
                    recurringListDiv.appendChild(content);
                }
            });
        };

        calendarGrid.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            const emptySlot = e.target.closest('.time-slot.empty');
            const editTrigger = e.target.closest('.booking-card-content');

            if (deleteBtn) {
                const { field, time, bookingId } = deleteBtn.dataset;
                
                // --- FIX APPLIED HERE ---
                const dateString = toLocalISOString(currentDate);
                // --- END OF FIX ---
                const bookingPath = `prenotazioni/${dateString}/${field}/${time}`;

                database.ref(bookingPath).once('value', (snapshot) => {
                    const bookingData = snapshot.val();
                    if (!bookingData) {
                        showToast('Impossibile trovare i dati della prenotazione.', 'error');
                        return;
                    }
                    
                    cancellationForm.reset();
                    Object.assign(cancellationForm.dataset, {
                        bookingPath,
                        indexPath: `indicePrenotazioni/${bookingId}`,
                        bookingId,
                        userEmail: bookingData.email,
                        userName: bookingData.nome,
                        bookingDate: new Date(dateString + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        bookingTime: time.replace('-',':')
                    });
                    document.getElementById('cancellation-info').textContent = `Stai per cancellare la prenotazione di ${bookingData.nome} ${bookingData.cognome} per le ore ${time.replace('-',':')}.`;
                    cancellationModal.style.display = 'flex';
                });

            } else if (emptySlot) {
                const { time, field } = emptySlot.dataset;
                document.getElementById('modal-title').textContent = `Aggiungi Prenotazione - Campo ${field} ore ${time}`;
                manualBookingForm.reset();
                document.getElementById('manual-field').value = field;
                document.getElementById('manual-time').value = time;
                bookingModal.style.display = 'flex';
            
            } else if (editTrigger && !editTrigger.closest('.booking-card.recurring')) {
                const { field, time } = editTrigger.dataset;
                
                // --- FIX APPLIED HERE ---
                const dateString = toLocalISOString(currentDate);
                // --- END OF FIX ---
                const bookingPath = `prenotazioni/${dateString}/${field}/${time}`;

                database.ref(bookingPath).once('value', (snapshot) => {
                    const bookingData = snapshot.val();
                    if (!bookingData) return;

                    const fieldNumber = field.split('-')[1];
                    const timeFormatted = time.replace('-', ':');
                    
                    document.getElementById('edit-modal-subtitle').textContent = `${bookingData.nome} ${bookingData.cognome} - Campo ${fieldNumber} ore ${timeFormatted}`;
                    
                    // MODIFICATION START: Populate the new edit fields
                    document.getElementById('edit-name').value = bookingData.nome || '';
                    document.getElementById('edit-surname').value = bookingData.cognome || '';
                    document.getElementById('edit-email').value = bookingData.email || '';
                    document.getElementById('edit-phone').value = bookingData.telefono || '';
                    // MODIFICATION END
                    
                    document.getElementById('edit-payment-status').value = bookingData.pagato ? 'paid' : 'unpaid';
                    document.getElementById('edit-notes').value = bookingData.note || '';
                    editBookingForm.dataset.bookingPath = bookingPath;
                    
                    // MODIFICATION START: Store booking ID for updating the index
                    editBookingForm.dataset.bookingId = bookingData.bookingId;
                    // MODIFICATION END

                    editBookingModal.style.display = 'flex';
                });
            }
        });
        
        prevDayBtn.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 1); listenToBookingsForDate(); });
        nextDayBtn.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 1); listenToBookingsForDate(); });
        todayBtn.addEventListener('click', () => { currentDate = new Date(); listenToBookingsForDate(); });
        
        // MOBILE ONLY: Event listener for field tabs
        mobileFieldSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('field-tab')) {
                const field = e.target.dataset.field;
                mobileFieldSelector.querySelectorAll('.field-tab').forEach(tab => tab.classList.remove('active'));
                e.target.classList.add('active');

                calendarGrid.className = 'calendar-container'; // Reset all classes
                calendarGrid.classList.add(`show-field-${field}`);
            }
        });

        function populateRecurringTimes() {
            recurringTimeStartSelect.innerHTML = '';
            recurringTimeEndSelect.innerHTML = '<option value="">Singola Ora</option>';
            const field = recurringFieldSelect.value;
            let minutes = '00';
            if (field === '2') minutes = '15';
            else if (field === '3') minutes = '30';

            for (let hour = 7; hour < 24; hour++) {
                const timeString = `${String(hour).padStart(2, '0')}:${minutes}`;
                recurringTimeStartSelect.add(new Option(timeString, timeString));
                recurringTimeEndSelect.add(new Option(timeString, timeString));
            }
        }
        recurringFieldSelect.addEventListener('change', populateRecurringTimes);

        recurringForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = recurringForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            const name = document.getElementById('recurring-name').value.trim();
            const dayOfWeek = document.getElementById('recurring-day').value;
            const field = document.getElementById('recurring-field').value;
            const startTime = document.getElementById('recurring-time-start').value;
            const endTime = document.getElementById('recurring-time-end').value;

            const updates = {};
            const startHour = parseInt(startTime.split(':')[0]);
            const minutes = startTime.split(':')[1];
            const endHour = endTime ? parseInt(endTime.split(':')[0]) : startHour + 1;

            if (endTime && startHour >= endHour) {
                showToast("L'orario di fine deve essere successivo a quello di inizio.", 'error');
                submitBtn.disabled = false;
                return;
            }

            for (let hour = startHour; hour < endHour; hour++) {
                const time = `${String(hour).padStart(2, '0')}:${minutes}`;
                const newRecurringBooking = {
                    giornoSettimana: dayOfWeek, orario: time, campo: field, nome: name,
                    email: 'ricorrente@cttricase.it', telefono: 'N/A'
                };
                const newKey = database.ref('prenotazioniRicorrenti').push().key;
                updates[`/prenotazioniRicorrenti/${newKey}`] = newRecurringBooking;
            }
            
            database.ref().update(updates)
                .then(() => {
                    recurringForm.reset();
                    populateRecurringTimes();
                    showToast('Prenotazione/i ricorrente aggiunta!', 'success');
                })
                .catch(err => showToast('Errore: ' + err.message, 'error'))
                .finally(() => submitBtn.disabled = false);
        });

        recurringListDiv.addEventListener('click', (e) => {
            const header = e.target.closest('.recurring-day-header');
            if (header) {
                header.classList.toggle('active');
                const content = header.nextElementSibling;
                content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
                return;
            }

            const deleteBtn = e.target.closest('.delete-recurring-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                document.getElementById('confirm-title').textContent = 'Cancella Ricorrenza';
                document.getElementById('confirm-message').textContent = 'Sei sicuro di voler cancellare questa prenotazione ricorrente? L\'azione è irreversibile.';
                
                const confirmActionBtn = document.getElementById('confirm-action-btn');
                const newConfirmActionBtn = confirmActionBtn.cloneNode(true);
                confirmActionBtn.parentNode.replaceChild(newConfirmActionBtn, confirmActionBtn);

                newConfirmActionBtn.addEventListener('click', () => {
                    database.ref(`prenotazioniRicorrenti/${id}`).remove()
                        .then(() => showToast('Ricorrenza cancellata.', 'info'))
                        .catch(err => showToast('Errore: ' + err.message, 'error'));
                    confirmModal.style.display = 'none';
                }, { once: true });
                
                confirmModal.style.display = 'flex';
            }
        });


        // Modal Management
        [bookingModal, editBookingModal, cancellationModal, confirmModal, unpaidModal, searchResultsModal].forEach(modal => {
            modal.querySelector('.close-btn').addEventListener('click', () => modal.style.display = 'none');
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
        
        document.getElementById('confirm-cancel-btn').addEventListener('click', () => confirmModal.style.display = 'none');
        
        document.getElementById('fill-placeholder-data').addEventListener('click', () => {
            document.getElementById('manual-email').value = 'cliente@interno.it';
            document.getElementById('manual-phone').value = '0000000000';
        });
        
        manualBookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = manualBookingForm.querySelector('.submit-btn');
            submitBtn.disabled = true;

            const field = document.getElementById('manual-field').value;
            const time = document.getElementById('manual-time').value;
            
            // --- FIX APPLIED HERE ---
            const dateString = toLocalISOString(currentDate);
            // --- END OF FIX ---
            
            const bookingRef = database.ref(`prenotazioni/${dateString}/campo-${field}`);
            const bookingId = bookingRef.push().key;

            const bookingData = {
                bookingId: bookingId,
                nome: document.getElementById('manual-name').value.trim(),
                cognome: document.getElementById('manual-surname').value.trim(),
                email: document.getElementById('manual-email').value.trim(),
                telefono: document.getElementById('manual-phone').value.trim(),
                prenotatoIl: firebase.database.ServerValue.TIMESTAMP,
                pagato: false, 
                note: ''
            };

            const timeKey = time.replace(':', '-');
            const bookingPath = `prenotazioni/${dateString}/campo-${field}/${timeKey}`;
            const indexPath = `indicePrenotazioni/${bookingId}`;
            
            const updates = {};
            updates[bookingPath] = bookingData;
            updates[indexPath] = {
                data: dateString, campo: field, orari: [time],
                nome: bookingData.nome, cognome: bookingData.cognome,
                email: bookingData.email, prenotatoIl: bookingData.prenotatoIl
            };

            try {
                await database.ref().update(updates);
                
                const CANCELLATION_PAGE_URL = "cancella.html"; 
                const cancellationLink = `https://www.circolotennistricase.it/${CANCELLATION_PAGE_URL}?id=${bookingId}`;
                const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJAXEg-M5Y_wZS37n-avMvoWGQdrmWqrK4-K8212n4WcYziuOUiMR-b8ItFFyKC11ymg/exec";
                const emailData = {
                    type: 'confirmation',
                    nome: bookingData.nome, email: bookingData.email,
                    data: new Date(dateString + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                    campo: field, orari: time, id: bookingId, linkCancellazione: cancellationLink
                };
                
                fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(emailData), headers: { 'Content-Type': 'application/json' } })
                    .then(() => console.log("Richiesta di invio email di conferma partita."))
                    .catch(error => console.error("Errore script:", error));

                showToast('Prenotazione salvata e email inviata!', 'success');
                bookingModal.style.display = 'none';

            } catch (error) {
                showToast('Errore nel salvataggio: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });

        editBookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = editBookingForm.querySelector('.submit-btn');
            submitBtn.disabled = true;

            const bookingPath = editBookingForm.dataset.bookingPath;
            // MODIFICATION START: Get bookingId from dataset
            const bookingId = editBookingForm.dataset.bookingId;
            // MODIFICATION END

            if (!bookingPath) {
                showToast('Errore: percorso del booking non trovato.', 'error');
                submitBtn.disabled = false; return;
            }

            // MODIFICATION START: Create an object with all updated data and perform a multi-path update
            const updatedData = {
                nome: document.getElementById('edit-name').value.trim(),
                cognome: document.getElementById('edit-surname').value.trim(),
                email: document.getElementById('edit-email').value.trim(),
                telefono: document.getElementById('edit-phone').value.trim(),
                pagato: document.getElementById('edit-payment-status').value === 'paid',
                note: document.getElementById('edit-notes').value.trim()
            };

            const updates = {};
            // Update the main booking object fields individually
            updates[`${bookingPath}/nome`] = updatedData.nome;
            updates[`${bookingPath}/cognome`] = updatedData.cognome;
            updates[`${bookingPath}/email`] = updatedData.email;
            updates[`${bookingPath}/telefono`] = updatedData.telefono;
            updates[`${bookingPath}/pagato`] = updatedData.pagato;
            updates[`${bookingPath}/note`] = updatedData.note;

            // Also update the search index if bookingId is present
            if (bookingId) {
                const indexPath = `indicePrenotazioni/${bookingId}`;
                updates[`${indexPath}/nome`] = updatedData.nome;
                updates[`${indexPath}/cognome`] = updatedData.cognome;
                updates[`${indexPath}/email`] = updatedData.email;
            }
            // MODIFICATION END

            try {
                // MODIFICATION START: Use the multi-path updates object
                await database.ref().update(updates);
                // MODIFICATION END
                showToast('Modifiche salvate!', 'success');
                editBookingModal.style.display = 'none';
            } catch (error) {
                showToast('Errore salvataggio: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });

        cancellationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = cancellationForm.querySelector('.submit-btn');
            submitBtn.disabled = true;

            const { bookingPath, indexPath, bookingId, userEmail, userName, bookingDate, bookingTime } = e.target.dataset;
            const reason = document.getElementById('cancellation-reason').value.trim();

            try {
                const indexSnapshot = await database.ref(indexPath).once('value');
                const indexData = indexSnapshot.val();
                
                const updates = { [bookingPath]: null };
                if (indexData && indexData.orari && indexData.orari.length > 1) {
                    updates[`${indexPath}/orari`] = indexData.orari.filter(t => t !== bookingTime.replace('-', ':'));
                } else {
                    updates[indexPath] = null;
                }
                await database.ref().update(updates);
                
                const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJAXEg-M5Y_wZS37n-avMvoWGQdrmWqrK4-K8212n4WcYziuOUiMR-b8ItFFyKC11ymg/exec";
                const emailData = {
                    type: 'cancellation',
                    nome: userName,
                    email: userEmail,
                    data: bookingDate,
                    orari: bookingTime,
                    causale: reason
                };

                fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(emailData), headers: { 'Content-Type': 'application/json' } })
                    .then(() => console.log("Richiesta di invio email di cancellazione partita."))
                    .catch(error => console.error("Errore script:", error));
                
                showToast('Prenotazione cancellata e notifica inviata.', 'info');
                cancellationModal.style.display = 'none';

            } catch (error) {
                showToast(`Errore cancellazione: ${error.message}`, 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });

        const showUnpaidBookings = async (searchTerm = '') => {
            const unpaidListContainer = document.getElementById('unpaid-list-container');
            unpaidListContainer.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Caricamento...';
            unpaidModal.style.display = 'flex';

            try {
                const snapshot = await database.ref('prenotazioni').once('value');
                const bookingsByDate = snapshot.val() || {};
                const unpaidByPerson = {};

                for (const date in bookingsByDate) {
                    for (const fieldId in bookingsByDate[date]) {
                        for (const time in bookingsByDate[date][fieldId]) {
                            const booking = bookingsByDate[date][fieldId][time];
                            if (booking && !booking.pagato && !booking.isRecurring) {
                                const personKey = `${booking.nome} ${booking.cognome}`.trim().toLowerCase();
                                if (searchTerm && !personKey.includes(searchTerm)) {
                                    continue; // Salta se non corrisponde alla ricerca
                                }
                                if (!unpaidByPerson[personKey]) {
                                    unpaidByPerson[personKey] = { name: `${booking.nome} ${booking.cognome}`.trim(), bookings: [] };
                                }
                                unpaidByPerson[personKey].bookings.push({
                                    ...booking, date, field: fieldId, time,
                                    path: `prenotazioni/${date}/${fieldId}/${time}`
                                });
                            }
                        }
                    }
                }
                
                unpaidListContainer.innerHTML = '';
                if (Object.keys(unpaidByPerson).length === 0) {
                    unpaidListContainer.innerHTML = `<p>Nessun pagamento in sospeso trovato${searchTerm ? ' per "' + searchTerm + '"' : ''}.</p>`;
                    return;
                }

                for (const personKey in unpaidByPerson) {
                    const personData = unpaidByPerson[personKey];
                    const card = document.createElement('div');
                    card.className = 'unpaid-person-card';
                    const header = document.createElement('button');
                    header.className = 'unpaid-person-header';
                    header.innerHTML = `<span>${personData.name}</span> <span class="booking-count">${personData.bookings.length} prenotazioni non pagate</span>`;
                    const content = document.createElement('div');
                    content.className = 'unpaid-person-content';
                    const ul = document.createElement('ul');

                    personData.bookings.forEach(b => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <span>${new Date(b.date + 'T12:00:00').toLocaleDateString('it-IT')} ore ${b.time.replace('-',':')} (Campo ${b.field.split('-')[1]})</span>
                            <button class="mark-as-paid-btn" data-path="${b.path}">Segna Pagato</button>
                        `;
                        ul.appendChild(li);
                    });

                    content.appendChild(ul);
                    card.appendChild(header);
                    card.appendChild(content);
                    unpaidListContainer.appendChild(card);
                    header.addEventListener('click', () => {
                        content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
                    });
                }
            } catch (error) {
                unpaidListContainer.innerHTML = '<p>Errore nel caricamento dei dati.</p>';
            }
        };
        
        unpaidBtn.addEventListener('click', () => {
            unpaidSearchInput.value = '';
            showUnpaidBookings();
        });

        unpaidSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showUnpaidBookings(unpaidSearchInput.value.trim().toLowerCase());
        });


        document.getElementById('unpaid-list-container').addEventListener('click', (e) => {
            if (e.target.classList.contains('mark-as-paid-btn')) {
                const path = e.target.dataset.path;
                database.ref(path).update({ pagato: true })
                    .then(() => {
                        showToast('Stato pagamento aggiornato!', 'success');
                        showUnpaidBookings(unpaidSearchInput.value.trim().toLowerCase()); // Ricarica la lista mantenendo la ricerca
                        // --- FIX APPLIED HERE ---
                        if (path.split('/')[1] === toLocalISOString(currentDate)) {
                        // --- END OF FIX ---
                            listenToBookingsForDate();
                        }
                    })
                    .catch(err => showToast('Errore: ' + err.message, 'error'));
            }
        });

        // --- Search Functionality ---
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = searchInput.value.trim().toLowerCase();
            if (query.length < 3) {
                showToast("Inserisci almeno 3 caratteri per la ricerca.", "error");
                return;
            }

            const resultsList = document.getElementById('search-results-list');
            resultsList.innerHTML = '<li><i class="fa-solid fa-spinner fa-spin"></i> Ricerca in corso...</li>';
            searchResultsModal.style.display = 'flex';

            const bookingsRef = database.ref('prenotazioni');
            const snapshot = await bookingsRef.once('value');
            const allBookings = snapshot.val();
            const results = [];

            if (allBookings) {
                for (const date in allBookings) {
                    for (const fieldId in allBookings[date]) {
                        for (const time in allBookings[date][fieldId]) {
                            const booking = allBookings[date][fieldId][time];
                            if (booking && !booking.isRecurring) {
                                const fullName = `${booking.nome || ''} ${booking.cognome || ''}`.toLowerCase();
                                const email = (booking.email || '').toLowerCase();
                                const phone = (booking.telefono || '').toLowerCase();

                                if (fullName.includes(query) || email.includes(query) || phone.includes(query)) {
                                    results.push({ ...booking, date, fieldId, time });
                                }
                            }
                        }
                    }
                }
            }

            renderSearchResults(results, query);
        });

        function renderSearchResults(results, query) {
            const resultsList = document.getElementById('search-results-list');
            document.getElementById('search-results-title').textContent = `Risultati per "${query}"`;
            resultsList.innerHTML = '';

            if (results.length === 0) {
                resultsList.innerHTML = '<li>Nessun risultato trovato.</li>';
                return;
            }
            
            results.sort((a,b) => new Date(b.date) - new Date(a.date));

            results.forEach(res => {
                const li = document.createElement('li');
                li.dataset.date = res.date;
                li.dataset.field = res.fieldId;
                li.dataset.time = res.time;
                
                li.innerHTML = `
                    <strong>${res.nome} ${res.cognome}</strong>
                    <span>
                        <i class="fa-solid fa-calendar-day"></i> ${new Date(res.date + 'T12:00:00').toLocaleDateString('it-IT')} 
                        <i class="fa-solid fa-clock"></i> ${res.time.replace('-',':')} 
                        <i class="fa-solid fa-person-shelter"></i> Campo ${res.fieldId.split('-')[1]}
                    </span>
                `;
                resultsList.appendChild(li);
            });
        }

        document.getElementById('search-results-list').addEventListener('click', (e) => {
            const targetLi = e.target.closest('li');
            if (!targetLi || !targetLi.dataset.date) return;

            const { date, field, time } = targetLi.dataset;
            
            currentDate = new Date(date + 'T12:00:00'); // Use noon to avoid timezone shifts
            listenToBookingsForDate();

            setTimeout(() => {
                const identifier = `${field}-${time}`;
                const cardToHighlight = document.querySelector(`.booking-card[data-booking-identifier="${identifier}"]`);
                if (cardToHighlight) {
                    cardToHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    cardToHighlight.classList.add('highlight');
                    setTimeout(() => cardToHighlight.classList.remove('highlight'), 2000);
                }
            }, 500);

            searchResultsModal.style.display = 'none';
        });

        // --- Final Initialization Call ---
        populateRecurringTimes();
        
        function listenToRecurringBookings() {
            const recurringRef = database.ref('prenotazioniRicorrenti');
            recurringRef.on('value', (snapshot) => {
                recurringBookings = snapshot.val() || {};
                renderRecurringList();
                // Re-render the current day's calendar to reflect any changes
                listenToBookingsForDate(); 
            });
        }

        listenToRecurringBookings();
    });