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
    deleteDoc, 
    Timestamp,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- INICIALIZAÇÃO E CONFIGURAÇÃO DO FIREBASE ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Adicionamos um listener que espera o DOM (a página HTML) estar completamente carregado
document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DE ELEMENTOS ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const addOrderBtn = document.getElementById('add-order-btn');
    const openOrdersList = document.getElementById('open-orders-list');
    const finishedOrdersList = document.getElementById('finished-orders-list');
    const printArea = document.getElementById('print-area');
    const searchInput = document.getElementById('search-input');

    // Modal de Nova Ordem
    const newOrderModal = document.getElementById('new-order-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const newOrderForm = document.getElementById('new-order-form');
    const customerSelect = document.getElementById('customer-select');
    const clientPhoneInput = document.getElementById('client-phone');
    const addNewCustomerFromOrderBtn = document.getElementById('add-new-customer-from-order-btn');

    // Seção de Relatórios
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const reportSummary = document.getElementById('report-summary');
    const reportDetailsList = document.getElementById('report-details-list');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const downloadReportBtn = document.getElementById('download-report-btn');

    // Modal de Clientes
    const customersBtn = document.getElementById('customers-btn');
    const customersModal = document.getElementById('customers-modal');
    const customersModalContent = document.getElementById('customers-modal-content');
    const closeCustomersModalBtn = document.getElementById('close-customers-modal-btn');
    const newCustomerForm = document.getElementById('new-customer-form');
    const customersList = document.getElementById('customers-list');

    // Modal de Confirmação
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalContent = document.getElementById('confirm-modal-content');
    const confirmModalText = document.getElementById('confirm-modal-text');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');

    let unsubscribeFromOrders = null; 
    let unsubscribeFromCustomers = null;
    let confirmCallback = null;
    let allOrdersCache = [];
    let allCustomersCache = [];
    let currentReportData = [];

    // --- LÓGICA DE AUTENTICAÇÃO ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            listenToOrders();
            listenToCustomers();
        } else {
            dashboardSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            if (unsubscribeFromOrders) unsubscribeFromOrders();
            if (unsubscribeFromCustomers) unsubscribeFromCustomers();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, loginForm.email.value, loginForm.password.value);
        } catch (error) {
            console.error("Erro de login:", error.code);
            alert('E-mail ou senha inválidos.');
        }
    });

    logoutBtn.addEventListener('click', () => signOut(auth));

    // --- LÓGICA DOS MODAIS ---
    function openModal(modal, content) {
        if (!modal || !content) return;
        modal.classList.remove('hidden');
        setTimeout(() => content.classList.add('scale-100', 'opacity-100'), 10);
    }

    function closeModal(modal, content) {
        if (!modal || !content) return;
        content.classList.remove('scale-100', 'opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }

    if(addOrderBtn) addOrderBtn.addEventListener('click', () => openModal(newOrderModal, modalContent));
    if(closeModalBtn) closeModalBtn.addEventListener('click', () => closeModal(newOrderModal, modalContent));
    if(cancelModalBtn) cancelModalBtn.addEventListener('click', () => closeModal(newOrderModal, modalContent));
    
    if(customersBtn) customersBtn.addEventListener('click', () => openModal(customersModal, customersModalContent));
    if(closeCustomersModalBtn) closeCustomersModalBtn.addEventListener('click', () => closeModal(customersModal, customersModalContent));
    
    if(addNewCustomerFromOrderBtn) addNewCustomerFromOrderBtn.addEventListener('click', () => openModal(customersModal, customersModalContent));

    function showConfirm(message, callback) {
        if(confirmModalText) confirmModalText.textContent = message;
        confirmCallback = callback;
        openModal(confirmModal, confirmModalContent);
    }
    if(confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => closeModal(confirmModal, confirmModalContent));
    if(confirmOkBtn) confirmOkBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeModal(confirmModal, confirmModalContent);
    });
    
    // --- LÓGICA DE CLIENTES ---
    function listenToCustomers() {
        const user = auth.currentUser;
        if (!user) return;
        if (unsubscribeFromCustomers) unsubscribeFromCustomers();

        const q = query(collection(db, "customers"), where("ownerId", "==", user.uid), orderBy("name"));
        unsubscribeFromCustomers = onSnapshot(q, (snapshot) => {
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCustomersList();
            populateCustomersDropdown();
        });
    }

    function renderCustomersList() {
        if(!customersList) return;
        customersList.innerHTML = '';
        if (allCustomersCache.length === 0) {
            customersList.innerHTML = '<p class="text-gray-400">Nenhum cliente cadastrado.</p>';
            return;
        }
        allCustomersCache.forEach(customer => {
            const item = document.createElement('div');
            item.className = 'bg-gray-700/50 p-3 rounded-lg flex justify-between items-center';
            item.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-200">${customer.name}</p>
                    <p class="text-sm text-gray-400">${customer.phone}</p>
                </div>
            `;
            customersList.appendChild(item);
        });
    }

    function populateCustomersDropdown() {
        if(!customerSelect) return;
        const currentVal = customerSelect.value;
        customerSelect.innerHTML = '<option value="">Selecione um cliente</option>';
        allCustomersCache.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            option.dataset.phone = customer.phone;
            customerSelect.appendChild(option);
        });
        customerSelect.value = currentVal;
    }

    if(customerSelect) customerSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if(clientPhoneInput) clientPhoneInput.value = selectedOption.dataset.phone || '';
    });

    if(newCustomerForm) newCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const newCustomerData = {
            name: document.getElementById('new-customer-name').value,
            phone: document.getElementById('new-customer-phone').value,
            ownerId: user.uid
        };

        try {
            const docRef = await addDoc(collection(db, "customers"), newCustomerData);
            newCustomerForm.reset();
            closeModal(customersModal, customersModalContent);
            
            setTimeout(() => {
                if(customerSelect) {
                    customerSelect.value = docRef.id;
                    customerSelect.dispatchEvent(new Event('change'));
                }
            }, 500);

        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            alert("Erro ao salvar cliente.");
        }
    });

    // --- LÓGICA DE ORDENS DE SERVIÇO ---
    if(newOrderForm) newOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert("Você precisa estar logado.");

        const selectedOption = customerSelect.options[customerSelect.selectedIndex];
        if (!selectedOption || !selectedOption.value) return alert("Por favor, selecione um cliente.");

        const newOrderData = {
            customerId: selectedOption.value,
            nomeCliente: selectedOption.textContent,
            telefoneCliente: clientPhoneInput.value,
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

    // --- LISTENER, BUSCA E RENDERIZAÇÃO DE ORDENS ---
    function listenToOrders() {
        const user = auth.currentUser;
        if (!user) return;
        if (unsubscribeFromOrders) unsubscribeFromOrders();

        const q = query(collection(db, "orders"), where("ownerId", "==", user.uid), orderBy("dataEntrada", "desc"));
        unsubscribeFromOrders = onSnapshot(q, (querySnapshot) => {
            allOrdersCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderFilteredOrders();
            setInitialDateRangeAndReport();
        }, (error) => console.error("Erro ao ouvir as ordens:", error));
    }

    if(searchInput) searchInput.addEventListener('input', renderFilteredOrders);

    function renderFilteredOrders() {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = allOrdersCache.filter(order => {
            const clientName = order.nomeCliente.toLowerCase();
            const sneakerModel = order.modeloTenis.toLowerCase();
            return clientName.includes(searchTerm) || sneakerModel.includes(searchTerm);
        });
        renderOrderLists(filtered);
    }

    function renderOrderLists(orders) {
        if(!openOrdersList || !finishedOrdersList) return;
        openOrdersList.innerHTML = '';
        finishedOrdersList.innerHTML = '';
        let hasOpen = false, hasFinished = false;

        orders.forEach((order) => {
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
                <button data-id="${order.id}" class="print-btn flex items-center gap-1 bg-gray-700 text-gray-300 px-3 py-1 rounded-full hover:bg-gray-600 text-sm font-semibold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M5 2.5a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5H5Z" /><path d="M2 5.5A1.5 1.5 0 0 0 .5 7v3.5A1.5 1.5 0 0 0 2 12h1.5a.5.5 0 0 0 0-1H2a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5-.5h-1.5a.5.5 0 0 0 0 1H14a1.5 1.5 0 0 0 1.5-1.5V7A1.5 1.5 0 0 0 14 5.5H2Z" /><path d="M5 10a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5H5Z" /></svg>Imprimir</button>
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
            showConfirm("Tem certeza que deseja excluir esta ordem de serviço?", async () => {
                try {
                    await deleteDoc(doc(db, 'orders', orderId));
                } catch (error) { console.error("Erro ao excluir ordem:", error); alert("Erro ao excluir a ordem."); }
            });
        }
    });

    // --- LÓGICA DE RELATÓRIOS ---
    if(generateReportBtn) generateReportBtn.addEventListener('click', updateReportView);
    if(downloadReportBtn) downloadReportBtn.addEventListener('click', downloadReport);

    function updateReportView() {
        const startVal = startDateInput.value;
        const endVal = endDateInput.value;
        
        const startDate = startVal ? new Date(startVal + 'T00:00:00') : null;
        const endDate = endVal ? new Date(endVal + 'T23:59:59') : null;

        currentReportData = allOrdersCache.filter(order => {
            if (order.status !== 'finalizado' || !order.dataFinalizacao) return false;
            const finalizationDate = order.dataFinalizacao.toDate();
            const afterStart = startDate ? finalizationDate >= startDate : true;
            const beforeEnd = endDate ? finalizationDate <= endDate : true;
            return afterStart && beforeEnd;
        });

        let totalRevenue = 0;
        currentReportData.forEach(order => totalRevenue += order.valor);

        reportSummary.innerHTML = `
            <h3 class="text-lg font-bold text-gray-200 mb-4">Resumo do Período</h3>
            <div class="space-y-3 text-gray-300">
                <p class="flex justify-between"><span>Serviços Finalizados:</span> <span class="font-semibold">${currentReportData.length}</span></p>
                <p class="flex justify-between text-xl"><span>Faturamento Total:</span> <span class="font-bold text-lime-400">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}</span></p>
            </div>
        `;

        reportDetailsList.innerHTML = '';
        if (currentReportData.length > 0) {
            currentReportData.forEach(order => {
                const detailItem = document.createElement('div');
                detailItem.className = 'bg-gray-700/50 p-3 rounded-lg flex justify-between items-center';
                const finalizationDate = new Intl.DateTimeFormat('pt-BR').format(order.dataFinalizacao.toDate());
                detailItem.innerHTML = `
                    <div>
                        <p class="font-semibold text-gray-200">${order.nomeCliente}</p>
                        <p class="text-sm text-gray-400">${order.modeloTenis} - Finalizado em ${finalizationDate}</p>
                    </div>
                    <p class="font-bold text-lime-400">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valor)}</p>
                `;
                reportDetailsList.appendChild(detailItem);
            });
        } else {
            reportDetailsList.innerHTML = '<p class="text-gray-400">Nenhuma venda finalizada no período selecionado.</p>';
        }
    }

    function setInitialDateRangeAndReport() {
        const today = new Date().toISOString().split('T')[0];
        startDateInput.value = today;
        endDateInput.value = today;
        updateReportView();
    }

    function downloadReport() {
        if (currentReportData.length === 0) {
            return alert("Não há dados no relatório atual para baixar.");
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Data Finalizacao,Cliente,Modelo Tenis,Valor,Observacoes\r\n";

        currentReportData.forEach(order => {
            const finalizationDate = new Intl.DateTimeFormat('pt-BR').format(order.dataFinalizacao.toDate());
            const clientName = `"${order.nomeCliente.replace(/"/g, '""')}"`;
            const sneakerModel = `"${order.modeloTenis.replace(/"/g, '""')}"`;
            const value = order.valor.toString().replace('.', ',');
            const observations = `"${(order.observacoes || '').replace(/"/g, '""')}"`;
            
            let row = [finalizationDate, clientName, sneakerModel, value, observations].join(",");
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_vendas_${startDateInput.value}_a_${endDateInput.value}.csv`);
        document.body.appendChild(link); 
        link.click();
        document.body.removeChild(link);
    }

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
