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


const firebaseConfig = {
  apiKey: "AIzaSyBgIySTsWkoylC2WEUgF_EGzt3JVy3UHw0",
  authDomain: "lavanderia-clean-up.firebaseapp.com",
  projectId: "lavanderia-clean-up",
  storageBucket: "lavanderia-clean-up.firebasestorage.app",
  messagingSenderId: "6383817947",
  appId: "1:6383817947:web:9dca3543ad299afcd628fe",
  measurementId: "G-QDB5FNBDWE"
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
    let selectedCustomerData = null;

    // --- LÓGICA DE AUTENTICAÇÃO ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (loginSection) loginSection.classList.add('hidden');
            if (dashboardSection) dashboardSection.classList.remove('hidden');
            if(addOrderBtn) {
                addOrderBtn.disabled = true;
                addOrderBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            listenToOrders();
            listenToCustomers();
        } else {
            if (dashboardSection) dashboardSection.classList.add('hidden');
            if (loginSection) loginSection.classList.remove('hidden');
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
        openModal(newOrderModal, modalContent);
        resetNewOrderForm();
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
                item.dataset.cpf = customer.cpf || '';
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
            selectedCustomerData = {
                id: e.target.dataset.id,
                name: e.target.textContent,
                phone: e.target.dataset.phone,
                cpf: e.target.dataset.cpf
            };
            customerSearchResults.classList.add('hidden');
        }
    });

    // --- LÓGICA DE ORDENS DE SERVIÇO ---
    function resetNewOrderForm() {
        if(newOrderForm) newOrderForm.reset();
        if(customerSearchInput) customerSearchInput.value = '';
        if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
        if(clientPhoneInput) clientPhoneInput.value = '';
        selectedCustomerData = null;
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
        if (!selectedCustomerData) return alert("Por favor, selecione um cliente da lista.");
        if (currentOrderItems.some(item => !item.service || !item.item)) {
            return alert("Por favor, preencha todos os campos de serviço e item.");
        }

        const totalValue = currentOrderItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

        const newOrderData = {
            customerId: selectedCustomerData.id,
            nomeCliente: selectedCustomerData.name,
            telefoneCliente: selectedCustomerData.phone,
            cpfCliente: selectedCustomerData.cpf || '',
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
        if (!searchInput) return;
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
        const today = new Date();
        const day = today.getDate();
        const month = today.toLocaleString('pt-BR', { month: 'long' });
        const year = today.getFullYear();
        const fullDate = `Florianópolis, ${day} de ${month} de ${year}.`;

        const termHTML = `
            <div style="font-family: Arial, sans-serif; width: 21cm; padding: 1.5cm; font-size: 10pt; color: #000; line-height: 1.4;">
                <h2 style="text-align: center; font-weight: bold; font-size: 14pt;">TERMO DE RESPONSABILIDADE – CLEAN UP SHOES</h2>
                <p style="text-align: center; font-size: 9pt; margin-bottom: 1.5em;">
                    CNPJ: 51.192.646/0001-59<br>
                    Endereço: Av. Gramal, 1521, sala 6 – Bairro Campeche, Florianópolis/SC<br>
                    CEP: 88063-080
                </p>
                <p>Pelo presente instrumento, o(a) CLIENTE declara estar ciente e de acordo com os termos e condições abaixo ao contratar os serviços de limpeza e higienização de calçados da CLEAN UP SHOES.</p>
                
                <h3 style="font-weight: bold; margin-top: 1em; font-size: 11pt;">1. Avaliação Prévia</h3>
                <p>Todos os calçados recebidos são submetidos a uma avaliação técnica inicial. Nesta análise, são verificados o estado geral do item, os materiais de sua composição, costuras, colas, solado e a existência de eventuais avarias ou desgastes pré-existentes.</p>
                
                <h3 style="font-weight: bold; margin-top: 1em; font-size: 11pt;">2. Riscos Inerentes ao Processo de Limpeza</h3>
                <p>O(A) CLIENTE compreende que, em virtude da grande diversidade de materiais, corantes e técnicas de fabricação de calçados, alguns riscos são inerentes ao processo de limpeza. Podem ocorrer alterações de cor, textura, desbotamento, descolamento ou a aceleração de um desgaste natural, especialmente em artigos delicados, antigos, com customizações ou que já apresentem danos.</p>
                
                <h3 style="font-weight: bold; margin-top: 1em; font-size: 11pt;">3. Garantia e Limitação de Responsabilidade</h3>
                <p>A CLEAN UP SHOES compromete-se a empregar as melhores técnicas profissionais e produtos adequados para a execução dos serviços. Contudo, não se responsabiliza por danos decorrentes de fragilidades, vícios ocultos ou problemas pré-existentes no calçado, que não sejam passíveis de identificação na avaliação prévia.</p>
                
                <h3 style="font-weight: bold; margin-top: 1em; font-size: 11pt;">4. Prazos e Retirada do Item</h3>
                <p>O prazo estimado para a conclusão do serviço será informado no momento do recebimento do calçado. Após a notificação de término, o(a) CLIENTE terá o prazo de 30 (trinta) dias corridos para realizar a retirada do item. Findo este período, a CLEAN UP SHOES isenta-se de qualquer responsabilidade sobre a guarda e conservação do calçado.</p>
                
                <h3 style="font-weight: bold; margin-top: 1em; font-size: 11pt;">5. Objetos Pessoais</h3>
                <p>A CLEAN UP SHOES não se responsabiliza por quaisquer objetos ou acessórios deixados nos calçados, tais como palmilhas ortopédicas ou especiais, cadarços personalizados, pingentes, etiquetas, entre outros. Recomenda-se a remoção de todos os itens pessoais antes da entrega do calçado.</p>
                
                <h3 style="font-weight: bold; margin-top: 1em; font-size: 11pt;">6. Autorização e Aceite</h3>
                <p>Ao contratar o serviço e assinar este termo, o(a) CLIENTE autoriza a execução dos procedimentos de limpeza solicitados e confirma que leu, compreendeu e concorda integralmente com todas as cláusulas aqui descritas.</p>
                
                <p style="text-align: right; margin-top: 2em;">${fullDate}</p>

                <div style="margin-top: 3em;">
                    <p style="text-align: center;">_________________________________________</p>
                    <p style="text-align: center;">Assinatura do Cliente</p>
                    <p style="margin-top: 1.5em;"><strong>Nome Completo:</strong> ${order.nomeCliente}</p>
                    <p><strong>CPF/RG:</strong> ${order.cpfCliente || 'Não informado'}</p>
                </div>
            </div>
        `;
        
        printArea.innerHTML = termHTML;
        window.print();
    }
});
