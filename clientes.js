/*
  Arquivo de Scripts para a página de gerenciamento de clientes.
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
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
    const newCustomerForm = document.getElementById('new-customer-form');
    const customerSearchInput = document.getElementById('customer-search-input');
    const customersTableBody = document.getElementById('customers-table-body');
    
    let allCustomersCache = [];
    let unsubscribeFromCustomers = null;

    // --- AUTENTICAÇÃO E CARREGAMENTO INICIAL ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado, pode ver a página
            listenToCustomers();
        } else {
            // Usuário não está logado, redireciona para a página de login
            window.location.href = 'index.html';
        }
    });

    // --- LÓGICA DE CLIENTES ---
    function listenToCustomers() {
        if (unsubscribeFromCustomers) unsubscribeFromCustomers();

        const q = query(collection(db, "customers"), where("ownerId", "==", companyId), orderBy("name"));
        unsubscribeFromCustomers = onSnapshot(q, (snapshot) => {
            allCustomersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderFilteredCustomers();
        });
    }

    if(newCustomerForm) newCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newCustomerData = {
            name: document.getElementById('new-customer-name').value,
            phone: document.getElementById('new-customer-phone').value,
            cpf: document.getElementById('new-customer-cpf').value || "", // Adiciona o CPF
            ownerId: companyId
        };

        try {
            await addDoc(collection(db, "customers"), newCustomerData);
            newCustomerForm.reset();
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            alert("Erro ao salvar cliente.");
        }
    });

    if(customerSearchInput) customerSearchInput.addEventListener('input', renderFilteredCustomers);

    function renderFilteredCustomers() {
        const searchTerm = customerSearchInput.value.toLowerCase();
        const filtered = allCustomersCache.filter(customer => 
            customer.name.toLowerCase().includes(searchTerm) || 
            customer.phone.includes(searchTerm) ||
            (customer.cpf && customer.cpf.includes(searchTerm))
        );
        renderCustomersTable(filtered);
    }

    function renderCustomersTable(customers) {
        if(!customersTableBody) return;
        customersTableBody.innerHTML = '';
        if (customers.length === 0) {
            customersTableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            row.innerHTML = `
                <td class="p-4 text-gray-200">${customer.name}</td>
                <td class="p-4 text-gray-400">${customer.phone}</td>
                <td class="p-4 text-gray-400">${customer.cpf || 'Não informado'}</td>
            `;
            customersTableBody.appendChild(row);
        });
    }
});
