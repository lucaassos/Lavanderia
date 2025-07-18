/*
  Arquivo de Scripts para o sistema Clean UP Shoes
  Responsável por toda a interatividade da página.
  Versão com Firebase (v9+ modular) e autenticação segura.
*/

// --- IMPORTAÇÕES DO FIREBASE (Sintaxe Moderna v9+) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    doc, 
    updateDoc, 
    getDoc, 
    deleteDoc, // Importação para exclusão
    Timestamp,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- INICIALIZAÇÃO E CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {

  apiKey: "AIzaSyBgIySTsWkoylC2WEUgF_EGzt3JVy3UHw0",

  authDomain: "lavanderia-clean-up.firebaseapp.com",

  projectId: "lavanderia-clean-up",

  storageBucket: "lavanderia-clean-up.firebasestorage.app",

  messagingSenderId: "6383817947",

  appId: "1:6383817947:web:9dca3543ad299afcd628fe",

};



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SELETORES DE ELEMENTOS ---
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const addOrderBtn = document.getElementById('add-order-btn');
const openOrdersList = document.getElementById('open-orders-list');
const finishedOrdersList = document.getElementById('finished-orders-list');
const printArea = document.getElementById('print-area');

// Modal de Nova Ordem
const newOrderModal = document.getElementById('new-order-modal');
const modalContent = document.getElementById('modal-content');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const newOrderForm = document.getElementById('new-order-form');

// Modal de Relatórios
const reportBtn = document.getElementById('report-btn');
const reportModal = document.getElementById('report-modal');
const reportModalContent = document.getElementById('report-modal-content');
const closeReportModalBtn = document.getElementById('close-report-modal-btn');
const generateReportBtn = document.getElementById('generate-report-btn');
const reportResultsArea = document.getElementById('report-results-area');


let unsubscribeFromOrders = null; 

// --- LÓGICA DE AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        listenToOrders();
    } else {
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        if (unsubscribeFromOrders) {
            unsubscribeFromOrders();
        }
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Erro de login:", error.code);
        alert('E-mail ou senha inválidos. Acesso não permitido.');
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- LÓGICA DOS MODAIS ---
function openModal(modal, content) {
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeModal(modal, content) {
    content.classList.add('scale-95', 'opacity-0');
    content.classList.remove('scale-100', 'opacity-100');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Eventos do Modal de Nova Ordem
addOrderBtn.addEventListener('click', () => openModal(newOrderModal, modalContent));
closeModalBtn.addEventListener('click', () => closeModal(newOrderModal, modalContent));
cancelModalBtn.addEventListener('click', () => closeModal(newOrderModal, modalContent));

// Eventos do Modal de Relatórios
reportBtn.addEventListener('click', () => openModal(reportModal, reportModalContent));
closeReportModalBtn.addEventListener('click', () => {
    closeModal(reportModal, reportModalContent)
    reportResultsArea.classList.add('hidden'); // Esconde resultados ao fechar
});


// --- LÓGICA DE ORDENS DE SERVIÇO ---
newOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert("Você precisa estar logado para criar uma ordem.");

    const newOrderData = {
        nomeCliente: document.getElementById('client-name').value,
        telefoneCliente: document.getElementById('client-phone').value,
        modeloTenis: document.getElementById('sneaker-model').value,
        valor: parseFloat(document.getElementById('service-value').value) || 0,
        observacoes: document.getElementById('observations').value,
        dataEntrada: Timestamp.fromDate(new Date()),
        dataFinalizacao: null,
        status: 'em_aberto',
        ownerId: user.uid
    };

    try {
        await addDoc(collection(db, "orders"), newOrderData);
        closeModal(newOrderModal, modalContent);
        newOrderForm.reset();
    } catch (error) {
        console.error("Erro ao salvar ordem: ", error);
        alert("Ocorreu um erro ao salvar a ordem.");
    }
});

// --- LISTENER E RENDERIZAÇÃO DE ORDENS ---
function listenToOrders() {
    const user = auth.currentUser;
    if (!user) return;
    if (unsubscribeFromOrders) unsubscribeFromOrders();

    const q = query(collection(db, "orders"), where("ownerId", "==", user.uid), orderBy("dataEntrada", "desc"));
    unsubscribeFromOrders = onSnapshot(q, (querySnapshot) => {
        renderOrders(querySnapshot.docs);
    }, (error) => console.error("Erro ao ouvir as ordens:", error));
}

function renderOrders(docs) {
    openOrdersList.innerHTML = '';
    finishedOrdersList.innerHTML = '';
    let hasOpen = false, hasFinished = false;

    docs.forEach((doc) => {
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

function createOrderCard(order) {
    const card = document.createElement('div');
    const statusClass = order.status === 'em_aberto' ? 'border-l-4 border-yellow-400' : 'border-l-4 border-lime-500';
    card.className = `bg-gray-900/70 p-4 rounded-lg shadow-lg transition-all duration-300 hover:shadow-lime-500/10 hover:border-lime-400 ${statusClass}`;
    
    const dateObject = order.dataEntrada.toDate();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(dateObject);
    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor);

    let finishButtonHtml = '';
    if (order.status === 'em_aberto') {
        finishButtonHtml = `<button data-id="${order.id}" class="finish-btn flex items-center gap-1 bg-green-800/50 text-green-300 px-3 py-1 rounded-full hover:bg-green-700/50 text-sm font-semibold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.35 2.35 4.493-6.74a.75.75 0 0 1 1.04-.208Z" clip-rule="evenodd" /></svg>Finalizar</button>`;
    }

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div><p class="font-bold text-lg text-gray-200">${order.nomeCliente}</p><p class="text-sm text-gray-400">${order.modeloTenis}</p></div>
            <p class="font-bold text-lg text-lime-400">${formattedValue}</p>
        </div>
        <div class="text-sm text-gray-500 mt-2"><span>OS: ${order.id.substring(0, 6).toUpperCase()}</span> &bull; <span>Entrada: ${formattedDate}</span></div>
        ${order.observacoes ? `<p class="text-sm mt-3 pt-3 border-t border-gray-700 text-gray-400">${order.observacoes}</p>` : ''}
        <div class="flex justify-end items-center mt-4 space-x-2">
            ${finishButtonHtml}
            <button data-id="${order.id}" class="print-btn flex items-center gap-1 bg-gray-700 text-gray-300 px-3 py-1 rounded-full hover:bg-gray-600 text-sm font-semibold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M5 2.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5H5Z" /><path d="M2 5.5A1.5 1.5 0 0 0 .5 7v3.5A1.5 1.5 0 0 0 2 12h1.5a.5.5 0 0 0 0-1H2a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5h-1.5a.5.5 0 0 0 0 1H14a1.5 1.5 0 0 0 1.5-1.5V7A1.5 1.5 0 0 0 14 5.5H2Z" /><path d="M5 10a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5H5Z" /></svg>Imprimir</button>
            <button data-id="${order.id}" class="delete-btn text-red-400 hover:text-red-300" title="Excluir Ordem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3V3.25a.75.75 0 0 0-.75-.75h-1.5Z" clip-rule="evenodd" /></svg></button>
        </div>`;
    return card;
}

// --- DELEGAÇÃO DE EVENTOS GERAL ---
document.body.addEventListener('click', async (e) => {
    const user = auth.currentUser;
    if (!user) return;

    const finishBtn = e.target.closest('.finish-btn');
    const printBtn = e.target.closest('.print-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (finishBtn) {
        const orderId = finishBtn.dataset.id;
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'finalizado', dataFinalizacao: Timestamp.fromDate(new Date()) });
        } catch (error) { console.error("Erro ao finalizar ordem:", error); alert("Erro ao finalizar a ordem."); }
    }

    if (printBtn) {
        const orderId = printBtn.dataset.id;
        try {
            const docSnap = await getDoc(doc(db, 'orders', orderId));
            if (docSnap.exists()) prepareAndPrintReceipt({ id: docSnap.id, ...docSnap.data() });
        } catch (error) { console.error("Erro ao buscar ordem para impressão:", error); alert("Erro ao buscar dados para impressão."); }
    }

    if (deleteBtn) {
        const orderId = deleteBtn.dataset.id;
        if (confirm("Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.")) {
            try {
                await deleteDoc(doc(db, 'orders', orderId));
            } catch (error) { console.error("Erro ao excluir ordem:", error); alert("Erro ao excluir a ordem."); }
        }
    }
});

// --- LÓGICA DE RELATÓRIOS ---
generateReportBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        return alert("Por favor, selecione a data de início e de fim.");
    }

    // Adiciona a hora final do dia para incluir todos os registros do dia final.
    const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
    const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

    const q = query(
        collection(db, "orders"),
        where("ownerId", "==", user.uid),
        where("status", "==", "finalizado"),
        where("dataFinalizacao", ">=", startTimestamp),
        where("dataFinalizacao", "<=", endTimestamp)
    );

    try {
        const querySnapshot = await getDocs(q);
        let totalRevenue = 0;
        const servicesCount = querySnapshot.size;

        querySnapshot.forEach(doc => {
            totalRevenue += doc.data().valor;
        });
        
        displayReportResults(totalRevenue, servicesCount);

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert("Ocorreu um erro ao gerar o relatório. Verifique o console para mais detalhes. Pode ser necessário criar um índice no Firebase.");
    }
});

function displayReportResults(totalRevenue, servicesCount) {
    reportResultsArea.innerHTML = `
        <h4 class="text-lg font-bold text-gray-200">Resultados do Período</h4>
        <div class="mt-4 space-y-2 text-gray-300">
            <p class="flex justify-between"><span>Serviços Finalizados:</span> <span class="font-semibold">${servicesCount}</span></p>
            <p class="flex justify-between text-xl"><span>Faturamento Total:</span> <span class="font-bold text-lime-400">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}</span></p>
        </div>
    `;
    reportResultsArea.classList.remove('hidden');
}


// --- LÓGICA DE IMPRESSÃO ---
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
