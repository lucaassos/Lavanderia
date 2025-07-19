/*
  Arquivo de Scripts para o sistema Clean UP Shoes
  Responsável pela interatividade da página de Ordens de Serviço.
*/

// --- IMPORTAÇÕES DO FIREBASE ---
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

// --- ID DA CONTA DA LOJA (COMPARTILHADO) ---
const companyId = "oNor7X6GwkcgWtsvyL0Dg4tamwI3";

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
    const customerSearchInput = document.getElementById('customer-search-input');
    const customerSearchResults = document.getElementById('customer-search-results');
    const selectedCustomerIdInput = document.getElementById('selected-customer-id');
    const clientPhoneInput = document.getElementById('client-phone');
    const serviceItemsContainer = document.getElementById('service-items-container');
    const addServiceBtn = document.getElementById('add-service-btn');
    const totalValueDisplay = document.getElementById('total-value-display');
    
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
    let currentOrderItems = [];

    // --- LÓGICA DE AUTENTICAÇÃO ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            if(addOrderBtn) {
                addOrderBtn.disabled = true;
                addOrderBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            listenToOrders();
            listenToCustomers();
        } else {
            dashboardSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            if (unsubscribeFromOrders) unsubscribeFromOrders();
            if (unsubscribeFromCustomers) unsubscribeFromCustomers();
        }
    });

    if(loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, loginForm.email.value, loginForm.password.value);
        } catch (error) {
            console.error("Erro de login:", error.code);
            alert('E-mail ou senha inválidos.');
        }
    });

    if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));

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

    if(addOrderBtn) addOrderBtn.addEventListener('click', () => {
        resetNewOrderForm();
        openModal(newOrderModal, modalContent);
    });
    if(closeModalBtn) closeModalBtn.addEventListener('click', () => closeModal(newOrderModal, modalContent));
    if(cancelModalBtn) cancelModalBtn.addEventListener('click', () => closeModal(newOrderModal, modalContent));

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
        if (unsubscribeFromCustomers) unsubscribeFromCustomers();
        const q = query(collection(db, "customers"), where("ownerId", "==", companyId), orderBy("name"));
        unsubscribeFromCustomers = onSnapshot(q, (snapshot) => {
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if(addOrderBtn) {
                addOrderBtn.disabled = false;
                addOrderBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    if(customerSearchInput) customerSearchInput.addEventListener('input', () => {
        const searchTerm = customerSearchInput.value.toLowerCase();
        customerSearchResults.innerHTML = '';
        if (searchTerm.length === 0) {
            customerSearchResults.classList.add('hidden');
            return;
        }
        const filtered = allCustomersCache.filter(c => c.name.toLowerCase().includes(searchTerm));
        if (filtered.length > 0) {
            filtered.forEach(customer => {
                const item = document.createElement('div');
                item.className = 'p-2 hover:bg-gray-700 cursor-pointer';
                item.textContent = customer.name;
                item.dataset.id = customer.id;
                item.dataset.phone = customer.phone;
                customerSearchResults.appendChild(item);
            });
            customerSearchResults.classList.remove('hidden');
        } else {
            customerSearchResults.classList.add('hidden');
        }
    });

    if(customerSearchResults) customerSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'DIV') {
            customerSearchInput.value = e.target.textContent;
            selectedCustomerIdInput.value = e.target.dataset.id;
            clientPhoneInput.value = e.target.dataset.phone;
            customerSearchResults.classList.add('hidden');
        }
    });

    // --- LÓGICA DE ORDENS DE SERVIÇO ---
    function resetNewOrderForm() {
        if(newOrderForm) newOrderForm.reset();
        if(customerSearchInput) customerSearchInput.value = '';
        if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
        if(clientPhoneInput) clientPhoneInput.value = '';
        currentOrderItems = [];
        addServiceItem(); // Adiciona o primeiro item em branco
    }
    
    function addServiceItem() {
        currentOrderItems.push({ service: '', item: '', price: 0 });
        renderServiceItems();
    }

    function removeServiceItem(index) {
        currentOrderItems.splice(index, 1);
        renderServiceItems();
    }

    function updateServiceItem(index, field, value) {
        currentOrderItems[index][field] = value;
        if (field === 'price') {
            calculateTotal();
        }
    }
    
    function calculateTotal() {
        const total = currentOrderItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
        if(totalValueDisplay) totalValueDisplay.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
    }

    function renderServiceItems() {
        if(!serviceItemsContainer) return;
        serviceItemsContainer.innerHTML = '';
        currentOrderItems.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-700/50 rounded-lg relative';
            itemEl.innerHTML = `
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-400">Tipo de Serviço</label>
                    <select data-index="${index}" class="service-type-select w-full px-4 py-2 mt-1 text-gray-200 bg-gray-700 border border-gray-600 rounded-lg">
                        <option value="" data-price="0">Selecione um serviço</option>
                        <option value="Higienização Completa" data-price="60">Higienização Completa</option>
                        <option value="Higienização Premium" data-price="80">Higienização Premium</option>
                        <option value="Higienização de Boné" data-price="40">Higienização de Boné</option>
                        <option value="Higienização de Bolsa" data-price="70">Higienização de Bolsa</option>
                        <option value="Reparo de Pintura ou Tecido" data-price="150">Reparo de Pintura ou Tecido</option>
                        <option value="Pintura de Midsole" data-price="100">Pintura de Midsole</option>
                        <option value="Impermeabilização" data-price="35">Impermeabilização</option>
                        <option value="Outro" data-price="0">Outro Valor</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-400">Valor (R$)</label>
                    <input type="number" data-index="${index}" class="service-value-input w-full px-4 py-2 mt-1 text-gray-200 bg-gray-700 border border-gray-600 rounded-lg" step="0.01" value="${item.price}" required>
                </div>
                <div class="md:col-span-3">
                    <label class="block text-sm font-medium text-gray-400">Modelo do Tênis / Item</label>
                    <input type="text" data-index="${index}" class="service-item-input w-full px-4 py-2 mt-1 text-gray-200 bg-gray-700 border border-gray-600 rounded-lg" value="${item.item}" required>
                </div>
                ${currentOrderItems.length > 1 ? `<button type="button" data-index="${index}" class="remove-service-btn absolute top-2 right-2 text-red-400 hover:text-red-300">&times;</button>` : ''}
            `;
            serviceItemsContainer.appendChild(itemEl);
            itemEl.querySelector('.service-type-select').value = item.service;
        });
        calculateTotal();
    }

    if(addServiceBtn) addServiceBtn.addEventListener('click', addServiceItem);

    if(serviceItemsContainer) {
        serviceItemsContainer.addEventListener('change', (e) => {
            const index = e.target.dataset.index;
            if (e.target.classList.contains('service-type-select')) {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const price = selectedOption.dataset.price;
                const valueInput = serviceItemsContainer.querySelector(`.service-value-input[data-index="${index}"]`);
                
                updateServiceItem(index, 'service', e.target.value);
                
                if (e.target.value === 'Outro') {
                    valueInput.value = '';
                    valueInput.readOnly = false;
                    valueInput.focus();
                } else {
                    valueInput.value = price;
                    valueInput.readOnly = true;
                    updateServiceItem(index, 'price', price);
                }
            }
            if (e.target.classList.contains('service-value-input')) {
                updateServiceItem(index, 'price', e.target.value);
            }
        });

        serviceItemsContainer.addEventListener('input', (e) => {
            const index = e.target.dataset.index;
            if (e.target.classList.contains('service-item-input')) {
                updateServiceItem(index, 'item', e.target.value);
            }
        });

        serviceItemsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-service-btn')) {
                removeServiceItem(e.target.dataset.index);
            }
        });
    }

    if(newOrderForm) newOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customerId = selectedCustomerIdInput.value;
        if (!customerId) return alert("Por favor, selecione um cliente da lista.");
        if (currentOrderItems.some(item => !item.service || !item.item)) {
            return alert("Por favor, preencha todos os campos de serviço e item.");
        }

        const totalValue = currentOrderItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

        const newOrderData = {
            customerId: customerId,
            nomeCliente: customerSearchInput.value,
            telefoneCliente: clientPhoneInput.value,
            items: currentOrderItems,
            valorTotal: totalValue,
            observacoes: document.getElementById('observations').value,
            dataEntrada: Timestamp.fromDate(new Date()),
            dataFinalizacao: null,
            status: 'em_aberto',
            ownerId: companyId
        };

        try {
            await addDoc(collection(db, "orders"), newOrderData);
            closeModal(newOrderModal, modalContent);
        } catch (error) {
            console.error("Erro ao salvar ordem: ", error);
            alert("Ocorreu um erro ao salvar a ordem.");
        }
    });

    // --- LISTENER, BUSCA E RENDERIZAÇÃO DE ORDENS ---
    function listenToOrders() {
        if (unsubscribeFromOrders) unsubscribeFromOrders();

        const q = query(collection(db, "orders"), where("ownerId", "==", companyId), orderBy("dataEntrada", "desc"));
        unsubscribeFromOrders = onSnapshot(q, (querySnapshot) => {
            allOrdersCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderFilteredOrders();
        }, (error) => console.error("Erro ao ouvir as ordens:", error));
    }

    if(searchInput) searchInput.addEventListener('input', renderFilteredOrders);

    function renderFilteredOrders() {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = allOrdersCache.filter(order => {
            const clientName = order.nomeCliente.toLowerCase();
            let itemsMatch = false;
            if (order.items && Array.isArray(order.items)) {
                itemsMatch = order.items.some(item => item.item && item.item.toLowerCase().includes(searchTerm));
            } else if (order.modeloTenis) {
                itemsMatch = order.modeloTenis.toLowerCase().includes(searchTerm);
            }
            return clientName.includes(searchTerm) || itemsMatch;
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
        const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valorTotal || order.valor);

        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
            itemsHtml = order.items.map(item => `
                <div class="flex justify-between text-sm">
                    <p class="text-gray-300">${item.service} (<span class="text-gray-400">${item.item}</span>)</p>
                    <p class="text-gray-300">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                </div>
            `).join('');
        } else if (order.modeloTenis) {
            itemsHtml = `
                <div class="flex justify-between text-sm">
                    <p class="text-gray-300">${order.tipoServico || 'Serviço'} (<span class="text-gray-400">${order.modeloTenis}</span>)</p>
                </div>`;
        }

        let finishButtonHtml = '';
        if (order.status === 'em_aberto') {
            finishButtonHtml = `<button data-id="${order.id}" class="finish-btn flex items-center gap-1 bg-green-800/50 text-green-300 px-3 py-1 rounded-full hover:bg-green-700/50 text-sm font-semibold transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.35 2.35 4.493-6.74a.75.75 0 0 1 1.04-.208Z" clip-rule="evenodd" /></svg>Finalizar</button>`;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div><p class="font-bold text-lg text-gray-200">${order.nomeCliente}</p></div>
                <p class="font-bold text-lg text-lime-400">${formattedValue}</p>
            </div>
            <div class="mt-2 space-y-1 border-t border-b border-gray-700 py-2">${itemsHtml}</div>
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

    function prepareAndPrintReceipt(order) {
        const entradaFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(order.dataEntrada.toDate());
        const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.valorTotal || order.valor);

        const itemsHtml = (order.items && Array.isArray(order.items)) ? order.items.map(item => 
            `<p><strong>Serviço:</strong> ${item.service}<br><strong>Item:</strong> ${item.item}<br><strong>Valor:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>`
        ).join('<hr style="border: 0; border-top: 1px dashed #ccc; margin: 5px 0;">') : `<p><strong>Item:</strong> ${order.modeloTenis}</p>`;

        const receiptHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; width: 280px; padding: 10px; font-size: 12px; color: #000; line-height: 1.4;">
                <div style="text-align: center; margin-bottom: 10px;"><h2 style="font-family: 'Arial Black', Gadget, sans-serif; font-size: 16px; font-weight: bold; margin: 0;">Clean UP Shoes</h2><p style="margin: 0;">Comprovante de Serviço</p></div>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;">
                <p><strong>OS:</strong> ${order.id.substring(0, 6).toUpperCase()}</p>
                <p><strong>Cliente:</strong> ${order.nomeCliente}</p>
                <p><strong>Telefone:</strong> ${order.telefoneCliente || 'Não informado'}</p>
                <p><strong>Entrada:</strong> ${entradaFmt}</p>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;">
                ${itemsHtml}
                ${order.observacoes ? `<hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;"><p><strong>Obs:</strong> ${order.observacoes}</p>` : ''}
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;">
                <p style="font-size: 16px; text-align: right; font-weight: bold;">TOTAL: ${valorFmt}</p>
                <hr style="border: 0; border-top: 1px dashed #000; margin: 10px 0;">
                <p style="text-align: center; font-size: 10px;">Obrigado pela preferência!</p>
            </div>`;
        
        printArea.innerHTML = receiptHTML;
        window.print();
    }
});
