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
    Timestamp
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
    const netProfitEl = document.getElementById('net-profit');
    const newExpenseForm = document.getElementById('new-expense-form');
    const salesDetailsList = document.getElementById('sales-details-list');
    const expensesDetailsList = document.getElementById('expenses-details-list');

    let allOrdersCache = [];
    let allExpensesCache = [];
    let unsubscribeFromOrders = null;
    let unsubscribeFromExpenses = null;

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
    startDateInput.addEventListener('change', updateDashboard);
    endDateInput.addEventListener('change', updateDashboard);

    function setInitialDateRange() {
        const today = new Date().toISOString().split('T')[0];
        startDateInput.value = today;
        endDateInput.value = today;
    }

    function updateDashboard() {
        const startDate = new Date(startDateInput.value + 'T00:00:00');
        const endDate = new Date(endDateInput.value + 'T23:59:59');

        // Filtra Vendas
        const filteredSales = allOrdersCache.filter(order => {
            if (order.status !== 'finalizado' || !order.dataFinalizacao) return false;
            const finalizationDate = order.dataFinalizacao.toDate();
            return finalizationDate >= startDate && finalizationDate <= endDate;
        });

        // Filtra Despesas
        const filteredExpenses = allExpensesCache.filter(expense => {
            const expenseDate = expense.date.toDate();
            return expenseDate >= startDate && expenseDate <= endDate;
        });

        // Calcula KPIs
        const grossRevenue = filteredSales.reduce((sum, order) => sum + (order.valorTotal || order.valor), 0);
        const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.value, 0);
        const netProfit = grossRevenue - totalExpenses;

        // Atualiza a UI
        grossRevenueEl.textContent = formatCurrency(grossRevenue);
        totalExpensesEl.textContent = formatCurrency(totalExpenses);
        netProfitEl.textContent = formatCurrency(netProfit);
        
        renderDetailsLists(filteredSales, filteredExpenses);
    }

    function renderDetailsLists(sales, expenses) {
        // Renderiza lista de vendas
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

        // Renderiza lista de despesas
        expensesDetailsList.innerHTML = '';
        if (expenses.length > 0) {
            expenses.forEach(expense => {
                const item = document.createElement('div');
                item.className = 'text-sm flex justify-between items-center';
                item.innerHTML = `
                    <p class="text-gray-300">${expense.description}</p>
                    <p class="font-semibold text-gray-200">${formatCurrency(expense.value)}</p>
                `;
                expensesDetailsList.appendChild(item);
            });
        } else {
            expensesDetailsList.innerHTML = '<p class="text-sm text-gray-400">Nenhuma despesa no período.</p>';
        }
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
});
