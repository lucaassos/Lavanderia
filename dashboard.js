/*
  Arquivo de Scripts para a página de dashboard financeiro.
*/

// --- IMPORTAÇÕES DO FIREBASE (Sintaxe Moderna v9+) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot,
    orderBy,
    Timestamp,
    doc,
    deleteDoc
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
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const grossRevenueEl = document.getElementById('gross-revenue');
    const totalExpensesEl = document.getElementById('total-expenses');
    const totalCommissionEl = document.getElementById('total-commission');
    const netProfitEl = document.getElementById('net-profit');
    const newExpenseForm = document.getElementById('new-expense-form');
    const salesDetailsList = document.getElementById('sales-details-list');
    const expensesDetailsList = document.getElementById('expenses-details-list');
    const downloadReportBtn = document.getElementById('download-dashboard-report-btn');
    const commissionToggleBtn = document.getElementById('commission-toggle-btn');
    
    // Modal de Confirmação
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalContent = document.getElementById('confirm-modal-content');
    const confirmModalText = document.getElementById('confirm-modal-text');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');

    let allOrdersCache = [];
    let allExpensesCache = [];
    let currentFilteredSales = [];
    let currentFilteredExpenses = [];
    let unsubscribeFromOrders = null;
    let unsubscribeFromExpenses = null;
    let confirmCallback = null;
    let commissionEnabled = false;

    // --- AUTENTICAÇÃO E CARREGAMENTO INICIAL ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            setInitialDateRange();
            listenToData();
        } else {
            window.location.href = 'index.html';
        }
    });

    // --- LISTENERS DO FIREBASE ---
    function listenToData() {
        if (unsubscribeFromOrders) unsubscribeFromOrders();
        if (unsubscribeFromExpenses) unsubscribeFromExpenses();

        const ordersQuery = query(collection(db, "orders"), where("ownerId", "==", companyId));
        unsubscribeFromOrders = onSnapshot(ordersQuery, (snapshot) => {
            allOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboard();
        });

        const expensesQuery = query(collection(db, "expenses"), where("ownerId", "==", companyId), orderBy("date", "desc"));
        unsubscribeFromExpenses = onSnapshot(expensesQuery, (snapshot) => {
            allExpensesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboard();
        });
    }
    
    // --- LÓGICA DE DESPESAS ---
    if(newExpenseForm) newExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('expense-description').value;
        const value = parseFloat(document.getElementById('expense-value').value);

        if (!description || !value) {
            return alert("Por favor, preencha a descrição e o valor da despesa.");
        }

        const newExpenseData = {
            description,
            value,
            date: Timestamp.fromDate(new Date()),
            ownerId: companyId
        };

        try {
            await addDoc(collection(db, "expenses"), newExpenseData);
            newExpenseForm.reset();
        } catch (error) {
            console.error("Erro ao salvar despesa:", error);
            alert("Erro ao salvar despesa.");
        }
    });

    // --- LÓGICA DO DASHBOARD ---
    if(startDateInput) startDateInput.addEventListener('change', updateDashboard);
    if(endDateInput) endDateInput.addEventListener('change', updateDashboard);
    if(downloadReportBtn) downloadReportBtn.addEventListener('click', downloadDashboardReport);
    if(commissionToggleBtn) commissionToggleBtn.addEventListener('click', () => {
        commissionEnabled = !commissionEnabled;
        commissionToggleBtn.classList.toggle('btn-gradient');
        commissionToggleBtn.classList.toggle('bg-gray-600');
        updateDashboard();
    });

    function setInitialDateRange() {
        const today = new Date().toISOString().split('T')[0];
        startDateInput.value = today;
        endDateInput.value = today;
    }

    function updateDashboard() {
        const startDate = new Date(startDateInput.value + 'T00:00:00');
        const endDate = new Date(endDateInput.value + 'T23:59:59');

        currentFilteredSales = allOrdersCache.filter(order => {
            if (order.status !== 'finalizado' || !order.dataFinalizacao) return false;
            const finalizationDate = order.dataFinalizacao.toDate();
            return finalizationDate >= startDate && finalizationDate <= endDate;
        });

        currentFilteredExpenses = allExpensesCache.filter(expense => {
            const expenseDate = expense.date.toDate();
            return expenseDate >= startDate && expenseDate <= endDate;
        });

        const grossRevenue = currentFilteredSales.reduce((sum, order) => sum + (order.valorTotal || order.valor), 0);
        const totalExpenses = currentFilteredExpenses.reduce((sum, expense) => sum + expense.value, 0);
        const totalCommission = commissionEnabled ? currentFilteredSales.length * 10 : 0;
        const netProfit = grossRevenue - totalExpenses - totalCommission;

        grossRevenueEl.textContent = formatCurrency(grossRevenue);
        totalExpensesEl.textContent = formatCurrency(totalExpenses);
        totalCommissionEl.textContent = formatCurrency(totalCommission);
        netProfitEl.textContent = formatCurrency(netProfit);
        
        renderDetailsLists(currentFilteredSales, currentFilteredExpenses);
    }

    function renderDetailsLists(sales, expenses) {
        salesDetailsList.innerHTML = '';
        if (sales.length > 0) {
            sales.forEach(order => {
                const item = document.createElement('div');
                item.className = 'text-sm flex justify-between items-center';
                item.innerHTML = `
                    <p class="text-gray-300">${order.nomeCliente}</p>
                    <p class="font-semibold text-gray-200">${formatCurrency(order.valorTotal || order.valor)}</p>
                `;
                salesDetailsList.appendChild(item);
            });
        } else {
            salesDetailsList.innerHTML = '<p class="text-sm text-gray-400">Nenhuma venda no período.</p>';
        }

        expensesDetailsList.innerHTML = '';
        if (expenses.length > 0) {
            expenses.forEach(expense => {
                const item = document.createElement('div');
                item.className = 'text-sm flex justify-between items-center group';
                item.innerHTML = `
                    <p class="text-gray-300">${expense.description}</p>
                    <div class="flex items-center gap-2">
                        <p class="font-semibold text-gray-200">${formatCurrency(expense.value)}</p>
                        <button data-id="${expense.id}" class="delete-expense-btn text-red-500/50 group-hover:text-red-500 transition-colors" title="Excluir Despesa">&times;</button>
                    </div>
                `;
                expensesDetailsList.appendChild(item);
            });
        } else {
            expensesDetailsList.innerHTML = '<p class="text-sm text-gray-400">Nenhuma despesa no período.</p>';
        }
    }
    
    // --- LÓGICA DE EXCLUSÃO DE DESPESA ---
    document.body.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-expense-btn');
        if (deleteBtn) {
            const expenseId = deleteBtn.dataset.id;
            showConfirm("Tem certeza que deseja excluir esta despesa?", async () => {
                try {
                    await deleteDoc(doc(db, 'expenses', expenseId));
                } catch (error) {
                    console.error("Erro ao excluir despesa:", error);
                    alert("Erro ao excluir a despesa.");
                }
            });
        }
    });

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
    
    function downloadDashboardReport() {
        if (currentFilteredSales.length === 0 && currentFilteredExpenses.length === 0) {
            return alert("Não há dados para baixar no período selecionado.");
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Data,Tipo,Descricao,Valor\r\n";

        currentFilteredSales.forEach(order => {
            const date = new Intl.DateTimeFormat('pt-BR').format(order.dataFinalizacao.toDate());
            const type = "Venda";
            const description = `"${order.nomeCliente} - ${order.items ? order.items.map(i => i.item).join(', ') : order.modeloTenis}"`;
            const value = (order.valorTotal || order.valor).toString().replace('.', ',');
            csvContent += `${date},${type},${description},${value}\r\n`;
        });
        
        currentFilteredExpenses.forEach(expense => {
            const date = new Intl.DateTimeFormat('pt-BR').format(expense.date.toDate());
            const type = "Despesa";
            const description = `"${expense.description}"`;
            const value = `-${expense.value.toString().replace('.', ',')}`;
            csvContent += `${date},${type},${description},${value}\r\n`;
        });
        
        if (commissionEnabled && currentFilteredSales.length > 0) {
            const totalCommission = currentFilteredSales.length * 10;
            const date = new Intl.DateTimeFormat('pt-BR').format(new Date());
            const type = "Comissao";
            const description = `"${currentFilteredSales.length} vendas"`;
            const value = `-${totalCommission.toString().replace('.', ',')}`;
            csvContent += `${date},${type},${description},${value}\r\n`;
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_financeiro_${startDateInput.value}_a_${endDateInput.value}.csv`);
        document.body.appendChild(link); 
        link.click();
        document.body.removeChild(link);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
});
