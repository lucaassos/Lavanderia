/*
  Arquivo de Scripts para o sistema Clean UP Shoes
  Integrado com Firebase para autenticação e banco de dados.
*/
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO DO FIREBASE ---
    // !!! IMPORTANTE !!!
    // Cole aqui o objeto firebaseConfig que você copiou do console do Firebase.
    const firebaseConfig = {
        apiKey: "COLE_SUA_API_KEY_AQUI",
        authDomain: "COLE_SEU_AUTH_DOMAIN_AQUI",
        projectId: "COLE_SEU_PROJECT_ID_AQUI",
        storageBucket: "COLE_SEU_STORAGE_BUCKET_AQUI",
        messagingSenderId: "COLE_SEU_MESSAGING_SENDER_ID_AQUI",
        appId: "COLE_SEU_APP_ID_AQUI"
    };

    // --- INICIALIZAÇÃO DO FIREBASE ---
    // Verificamos se o Firebase já foi inicializado para evitar erros
    let app;
    if (!firebase.getApps().length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.getApp();
    }
    const auth = firebase.getAuth(app);
    const db = firebase.getFirestore(app);

    // --- SELETORES DE ELEMENTOS ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    const addOrderBtn = document.getElementById('add-order-btn');
    const newOrderModal = document.getElementById('new-order-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const newOrderForm = document.getElementById('new-order-form');
    
    const openOrdersList = document.getElementById('open-orders-list');
    const finishedOrdersList = document.getElementById('finished-orders-list');
    const printArea = document.getElementById('print-area');

    // --- LÓGICA DE AUTENTICAÇÃO RESTRITA (REAL com Firebase) ---
    firebase.onAuthStateChanged(auth, (user) => {
        if (user) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            loadOrders(user.uid);
        } else {
            dashboardSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.email.value;
        const password = loginForm.password.value;

        try {
            await firebase.signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Erro de login:", error.code);
            alert('E-mail ou senha inválidos. Acesso não permitido.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        firebase.signOut(auth);
    });

    // --- LÓGICA DO MODAL (Permanece igual) ---
    function openModal() {
        newOrderModal.classList.remove('hidden');
        setTimeout(() => {
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function closeModal() {
        modalContent.classList.add('scale-95', 'opacity-0');
        modalContent.classList.remove('scale-100', 'opacity-100');
        setTimeout(() => {
            newOrderModal.classList.add('hidden');
            newOrderForm.reset();
        }, 200);
    }
    
    addOrderBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);

    // --- LÓGICA DE ORDENS DE SERVIÇO (com Firestore) ---
    newOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const newOrderData = {
            nomeCliente: document.getElementById('client-name').value,
            telefoneCliente: document.getElementById('client-phone').value,
            modeloTenis: document.getElementById('sneaker-model').value,
            valor: parseFloat(document.getElementById('service-value').value) || 0,
            observacoes: document.getElementById('observations').value,
            dataEntrada: firebase.Timestamp.fromDate(new Date()),
            dataFinalizacao: null,
            status: 'em_aberto',
            ownerId: user.uid
        };

        try {
            const ordersCollection = firebase.collection(db, "orders");
            await firebase.addDoc(ordersCollection, newOrderData);
            closeModal();
            loadOrders(user.uid);
        } catch (error) {
            console.error("Erro ao salvar ordem: ", error);
            alert("Ocorreu um erro ao salvar a ordem.");
        }
    });

    // --- FUNÇÃO PARA CARREGAR AS ORDENS DO FIRESTORE ---
    async function loadOrders(userId) {
        openOrdersList.innerHTML = '<p class="text-gray-400 p-4 bg-gray-900/50 rounded-lg shadow-sm">Carregando...</p>';
        finishedOrdersList.innerHTML = '<p class="text-gray-400 p-4 bg-gray-900/50 rounded-lg shadow-sm">Carregando...</p>';

        const q = firebase.query(
            firebase.collection(db, "orders"),
            firebase.where("ownerId", "==", userId),
            firebase.orderBy("dataEntrada", "desc")
        );
        
        const querySnapshot = await firebase.getDocs(q);
        
        openOrdersList.innerHTML = '';
        finishedOrdersList.innerHTML = '';
        
        let hasOpen = false;
        let hasFinished = false;

        querySnapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data() };
            const orderCard = createOrderCard(order);
            
            if (order.status === 'em_aberto') {
                openOrdersList.appendChild(orderCard);
                hasOpen = true;
            } else {
                finishedOrdersList.appendChild(orderCard);
                hasFinished = true;
            }
        });

        if (!hasOpen) openOrdersList.innerHTML = '<p class="text-gray-400 p-4 bg-gray-900/50 rounded-lg shadow-sm">Nenhuma ordem de serviço em aberto.</p>';
        if (!hasFinished) finishedOrdersList.innerHTML = '<p class="text-gray-400 p-4 bg-gray-900/50 rounded-lg shadow-sm">Nenhuma ordem de serviço finalizada.</p>';
    }

    // --- FUNÇÃO PARA CRIAR O CARD DE UMA ORDEM (Adaptada para Firestore) ---
    function createOrderCard(order) {
        const card = document.createElement('div');
        const statusClass = order.status === 'em_aberto' ? 'border-l-4 border-yellow-400' : 'border-l-4 border-lime-500';
        card.className = `bg-gray-900/70 p-4 rounded-lg shadow-lg transition-all duration-300 hover:shadow-lime-500/10 hover:border-lime-400 ${statusClass}`;
        
        const dateObject = order.dataEntrada.toDate();
        const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(dateObject);
        const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor);

        let buttonsHtml = '';
        if (order.status === 'em_aberto') {
            buttonsHtml = `<button data-id="${order.id}" class="finish-btn flex items-center gap-1 bg-green-800/50 text-green-300 px-3 py-1 rounded-full hover:bg-green-700/50 text-sm font-semibold transition-colors">Finalizar</button>`;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start"><div><p class="font-bold text-lg text-gray-200">${order.nomeCliente}</p><p class="text-sm text-gray-400">${order.modeloTenis}</p></div><p class="font-bold text-lg text-lime-400">${formattedValue}</p></div>
            <div class="text-sm text-gray-500 mt-2"><span>OS: ${order.id.substring(0, 6).toUpperCase()}</span> • <span>Entrada: ${formattedDate}</span></div>
            ${order.observacoes ? `<p class="text-sm mt-3 pt-3 border-t border-gray-700 text-gray-400">${order.observacoes}</p>` : ''}
            <div class="flex justify-end items-center mt-4 space-x-2">${buttonsHtml}<button data-id="${order.id}" class="print-btn flex items-center gap-1 bg-gray-700 text-gray-300 px-3 py-1 rounded-full hover:bg-gray-600 text-sm font-semibold transition-colors">Imprimir</button></div>`;
        return card;
    }

    // --- DELEGAÇÃO DE EVENTOS (com Firebase) ---
    document.body.addEventListener('click', async (e) => {
        const user = auth.currentUser;
        if (!user) return;

        const finishBtn = e.target.closest('.finish-btn');
        if (finishBtn) {
            const orderId = finishBtn.dataset.id;
            const orderRef = firebase.doc(db, 'orders', orderId);
            try {
                await firebase.updateDoc(orderRef, {
                    status: 'finalizado',
                    dataFinalizacao: firebase.Timestamp.fromDate(new Date())
                });
                loadOrders(user.uid);
            } catch (error) { console.error("Erro ao finalizar ordem:", error); }
        }

        const printBtn = e.target.closest('.print-btn');
        if (printBtn) {
            const orderId = printBtn.dataset.id;
            const orderRef = firebase.doc(db, 'orders', orderId);
            const docSnap = await firebase.getDoc(orderRef);
            if (docSnap.exists()) {
                prepareAndPrintReceipt({ id: docSnap.id, ...docSnap.data() });
            }
        }
    });
    
    // --- LÓGICA DE IMPRESSÃO (Adaptada para Firestore) ---
    function prepareAndPrintReceipt(order) {
        const entradaFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(order.dataEntrada.toDate());
        const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor);

        const receiptHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; width: 280px; padding: 10px; font-size: 12px; color: #000; line-height: 1.4;">
                <div style="text-align: center; margin-bottom: 10px;"><h2 style="font-family: 'Arial Black', Gadget, sans-serif; font-size: 16px; font-weight: bold; margin: 0;">Clean UP Shoes</h2><p style="margin: 0;">Comprovante de Serviço</p></div>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;"><p><strong>OS:</strong> ${order.id.substring(0, 6).toUpperCase()}</p><p><strong>Cliente:</strong> ${order.nomeCliente}</p><p><strong>Telefone:</strong> ${order.telefoneCliente || 'Não informado'}</p><p><strong>Entrada:</strong> ${entradaFmt}</p>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;"><p><strong>Item:</strong> ${order.modeloTenis}</p><p><strong>Obs:</strong> ${order.observacoes || 'Nenhuma'}</p>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;"><p style="font-size: 16px; text-align: right; font-weight: bold;">TOTAL: ${valorFmt}</p>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;"><p style="text-align: center; font-size: 10px;">Obrigado pela preferência!</p>
            </div>`;
        
        printArea.innerHTML = receiptHTML;
        window.print();
    }
});