/*
  Arquivo de Scripts para o sistema Clean UP Shoes
  Responsável por toda a interatividade da página.
  Versão com Firebase (v9+ modular) e autenticação segura.
*/

// --- IMPORTAÇÕES DO FIREBASE (Sintaxe Moderna v9+) ---
// Importamos apenas as funções que vamos usar dos SDKs do Firebase.
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
    Timestamp,
    onSnapshot, // Usaremos para atualizações em tempo real
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- INICIALIZAÇÃO E CONFIGURAÇÃO DO FIREBASE ---
// !!! IMPORTANTE !!!
// Cole aqui o objeto de configuração do seu projeto Firebase.
// Você pode encontrar isso nas configurações do seu projeto no console do Firebase.
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
const newOrderModal = document.getElementById('new-order-modal');
const modalContent = document.getElementById('modal-content');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const newOrderForm = document.getElementById('new-order-form');
const openOrdersList = document.getElementById('open-orders-list');
const finishedOrdersList = document.getElementById('finished-orders-list');
const printArea = document.getElementById('print-area');

let unsubscribeFromOrders = null; // Variável para guardar a função de 'unsubscribe' do listener

// --- LÓGICA DE AUTENTICAÇÃO (Real com Firebase) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        // Inicia o listener em tempo real para as ordens
        listenToOrders();
    } else {
        // Usuário não está logado
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        // Se houver um listener ativo, ele é desativado
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
    if (!user) {
        alert("Você precisa estar logado para criar uma ordem.");
        return;
    }

    const newOrderData = {
        nomeCliente: document.getElementById('client-name').value,
        telefoneCliente: document.getElementById('client-phone').value,
        modeloTenis: document.getElementById('sneaker-model').value,
        valor: parseFloat(document.getElementById('service-value').value) || 0,
        observacoes: document.getElementById('observations').value,
        dataEntrada: Timestamp.fromDate(new Date()),
        dataFinalizacao: null,
        status: 'em_aberto',
        ownerId: user.uid // Salva o ID do usuário que criou a ordem
    };

    try {
        const ordersCollectionRef = collection(db, "orders");
        await addDoc(ordersCollectionRef, newOrderData);
        closeModal();
    } catch (error) {
        console.error("Erro ao salvar ordem: ", error);
        alert("Ocorreu um erro ao salvar a ordem.");
    }
});

// --- FUNÇÃO PARA OUVIR MUDANÇAS NAS ORDENS EM TEMPO REAL ---
function listenToOrders() {
    const user = auth.currentUser;
    if (!user) return;

    // Se já existir um listener, desativa antes de criar um novo
    if (unsubscribeFromOrders) {
        unsubscribeFromOrders();
    }

    const q = query(
        collection(db, "orders"), 
        where("ownerId", "==", user.uid),
        orderBy("dataEntrada", "desc")
    );

    // onSnapshot cria um listener que atualiza a tela sempre que os dados mudam no Firestore
    unsubscribeFromOrders = onSnapshot(q, (querySnapshot) => {
        renderOrders(querySnapshot.docs);
    }, (error) => {
        console.error("Erro ao ouvir as ordens:", error);
    });
}

// --- FUNÇÃO PARA RENDERIZAR AS ORDENS NA TELA ---
function renderOrders(docs) {
    openOrdersList.innerHTML = '';
    finishedOrdersList.innerHTML = '';
    
    let hasOpen = false;
    let hasFinished = false;

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

// --- FUNÇÃO PARA CRIAR O CARD DE UMA ORDEM ---
function createOrderCard(order) {
    const card = document.createElement('div');
    const statusClass = order.status === 'em_aberto' ? 'border-l-4 border-yellow-400' : 'border-l-4 border-lime-500';
    card.className = `bg-gray-900/70 p-4 rounded-lg shadow-lg transition-all duration-300 hover:shadow-lime-500/10 hover:border-lime-400 ${statusClass}`;
    
    // O objeto de data do Firestore precisa ser convertido para um Date do JS
    const dateObject = order.dataEntrada.toDate();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(dateObject);
    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor);

    let buttonsHtml = '';
    if (order.status === 'em_aberto') {
        buttonsHtml = `<button data-id="${order.id}" class="finish-btn flex items-center gap-1 bg-green-800/50 text-green-300 px-3 py-1 rounded-full hover:bg-green-700/50 text-sm font-semibold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.35 2.35 4.493-6.74a.75.75 0 0 1 1.04-.208Z" clip-rule="evenodd" /></svg>Finalizar</button>`;
    }

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <p class="font-bold text-lg text-gray-200">${order.nomeCliente}</p>
                <p class="text-sm text-gray-400">${order.modeloTenis}</p>
            </div>
            <p class="font-bold text-lg text-lime-400">${formattedValue}</p>
        </div>
        <div class="text-sm text-gray-500 mt-2">
            <span>OS: ${order.id.substring(0, 6).toUpperCase()}</span> &bull;
            <span>Entrada: ${formattedDate}</span>
        </div>
        ${order.observacoes ? `<p class="text-sm mt-3 pt-3 border-t border-gray-700 text-gray-400">${order.observacoes}</p>` : ''}
        <div class="flex justify-end items-center mt-4 space-x-2">
            ${buttonsHtml}
            <button data-id="${order.id}" class="print-btn flex items-center gap-1 bg-gray-700 text-gray-300 px-3 py-1 rounded-full hover:bg-gray-600 text-sm font-semibold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M5 2.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5H5Z" /><path d="M2 5.5A1.5 1.5 0 0 0 .5 7v3.5A1.5 1.5 0 0 0 2 12h1.5a.5.5 0 0 0 0-1H2a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5h-1.5a.5.5 0 0 0 0 1H14a1.5 1.5 0 0 0 1.5-1.5V7A1.5 1.5 0 0 0 14 5.5H2Z" /><path d="M5 10a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5H5Z" /></svg>Imprimir</button>
        </div>
    `;
    return card;
}

// --- DELEGAÇÃO DE EVENTOS (com Firebase) ---
document.body.addEventListener('click', async (e) => {
    const user = auth.currentUser;
    if (!user) return;

    // Finalizar Ordem
    const finishBtn = e.target.closest('.finish-btn');
    if (finishBtn) {
        const orderId = finishBtn.dataset.id;
        const orderRef = doc(db, 'orders', orderId);
        try {
            await updateDoc(orderRef, {
                status: 'finalizado',
                dataFinalizacao: Timestamp.fromDate(new Date())
            });
            // Não precisa chamar loadOrders(), o onSnapshot faz isso automaticamente!
        } catch (error) { 
            console.error("Erro ao finalizar ordem:", error); 
            alert("Erro ao finalizar a ordem.");
        }
    }

    // Imprimir Ordem
    const printBtn = e.target.closest('.print-btn');
    if (printBtn) {
        const orderId = printBtn.dataset.id;
        const orderRef = doc(db, 'orders', orderId);
        try {
            const docSnap = await getDoc(orderRef);
            if (docSnap.exists()) {
                prepareAndPrintReceipt({ id: docSnap.id, ...docSnap.data() });
            }
        } catch (error) {
            console.error("Erro ao buscar ordem para impressão:", error);
            alert("Erro ao buscar dados para impressão.");
        }
    }
});

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
