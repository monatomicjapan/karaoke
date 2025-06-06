const DEFAULT_EMAIL = 'admin@karaoke.jp';
const DEFAULT_PASSWORD = '12345678';

// Utility to read/write bill arrays
function loadBills(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function saveBills(key, bills) {
    localStorage.setItem(key, JSON.stringify(bills));
}

function generateBillId() {
    const date = new Date();
    const ymd = date.toISOString().slice(0,10).replace(/-/g,'');
    const seqKey = 'bill-seq-' + ymd;
    let seq = parseInt(localStorage.getItem(seqKey) || '0', 10) + 1;
    localStorage.setItem(seqKey, seq);
    return ymd + '-' + seq;
}

function calcExtension(startTime, people) {
    if (!startTime) return 0;
    const base = 90 * 60 * 1000; // 90 minutes
    const diff = Date.now() - startTime;
    if (diff <= base) return 0;
    const extraHours = Math.ceil((diff - base) / (60 * 60 * 1000));
    return extraHours * people * 500;
}

function computeBillTotal(bill) {
    let total = (bill.plan2500 || 0) * 2500 + (bill.plan3000 || 0) * 3000;
    if (Array.isArray(bill.optionalPlans)) {
        bill.optionalPlans.forEach(p => { total += p.price * p.count; });
    }
    if (Array.isArray(bill.staffD)) {
        bill.staffD.forEach(s => { total += 600 * s.count; });
    }
    if (Array.isArray(bill.staffT)) {
        bill.staffT.forEach(s => { total += 1000 * s.count; });
    }
    total += calcExtension(bill.startTime, (bill.male || 0) + (bill.female || 0));
    return total;
}

function payBill(index) {
    const activeBills = loadBills('activeBills');
    const paidBills = loadBills('paidBills');
    const bill = activeBills[index];
    bill.total = computeBillTotal(bill);
    bill.status = 'paid';
    paidBills.push(bill);
    activeBills.splice(index, 1);
    saveBills('activeBills', activeBills);
    saveBills('paidBills', paidBills);
    renderActiveBills();
}

function renderActiveBills() {
    const container = document.getElementById('active-list');
    if (!container) return;
    let activeBills = loadBills('activeBills');
    activeBills.forEach(bill => {
        bill.total = computeBillTotal(bill);
    });
    saveBills('activeBills', activeBills);
    container.innerHTML = '';
    activeBills.forEach((bill, i) => {
        const div = document.createElement('div');
        div.textContent = `${bill.id} ${bill.name} - ${bill.total}円`;
        const btn = document.createElement('button');
        btn.textContent = '会計';
        btn.addEventListener('click', () => payBill(i));
        div.appendChild(btn);
        container.appendChild(div);
    });
}

function renderPaidBills() {
    const container = document.getElementById('paid-list');
    if (!container) return;
    const paidBills = loadBills('paidBills');
    container.innerHTML = '';
    paidBills.forEach(bill => {
        const div = document.createElement('div');
        div.textContent = `${bill.id} ${bill.name} - ${bill.total}円`;
        container.appendChild(div);
    });
}

// Initialize invoice creation page
function initNewBillPage() {
    const bill = {
        id: generateBillId(),
        name: '',
        seat: '',
        male: 0,
        female: 0,
        plan2500: 0,
        plan3000: 0,
        optionalPlans: [],
        staffD: [],
        staffT: [],
        startTime: null,
        status: 'new',
        total: 0
    };
    document.getElementById('bill-id').textContent = bill.id;

    function updateTotal() {
        let total = bill.plan2500 * 2500 + bill.plan3000 * 3000;
        bill.optionalPlans.forEach(p => { total += p.price * p.count; });
        bill.staffD.forEach(s => { total += 600 * s.count; });
        bill.staffT.forEach(s => { total += 1000 * s.count; });
        total += calcExtension(bill.startTime, bill.male + bill.female);
        bill.total = total;
        document.getElementById('total').textContent = total;
    }

    function setupCounter(decBtnId, incBtnId, prop) {
        const dec = document.getElementById(decBtnId);
        const inc = document.getElementById(incBtnId);
        const span = document.getElementById(prop + '-count');
        dec.addEventListener('click', () => {
            if (bill[prop] > 0) bill[prop]--;
            span.textContent = bill[prop];
            updateTotal();
        });
        inc.addEventListener('click', () => {
            bill[prop]++;
            span.textContent = bill[prop];
            updateTotal();
        });
    }

    setupCounter('male-dec','male-inc','male');
    setupCounter('female-dec','female-inc','female');
    setupCounter('plan2500-dec','plan2500-inc','plan2500');
    setupCounter('plan3000-dec','plan3000-inc','plan3000');

    document.getElementById('add-optional-plan').addEventListener('click', () => {
        const container = document.getElementById('optional-plans-container');
        const div = document.createElement('div');
        const nameInput = document.createElement('input');
        nameInput.placeholder = '項目';
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.placeholder = '金額';
        const dec = document.createElement('button');
        dec.textContent = '-';
        const span = document.createElement('span');
        span.textContent = '0';
        const inc = document.createElement('button');
        inc.textContent = '+';
        const remove = document.createElement('button');
        remove.textContent = '削除';
        const item = {name:'',price:0,count:0};
        bill.optionalPlans.push(item);
        function sync() {
            item.name = nameInput.value;
            item.price = parseInt(priceInput.value || '0',10);
            span.textContent = item.count;
            updateTotal();
        }
        dec.addEventListener("click", () => { if (item.count > 0) { item.count--; sync(); } });
        inc.addEventListener("click", () => { item.count++; sync(); });
        nameInput.addEventListener('input',sync);
        priceInput.addEventListener('input',sync);
        remove.addEventListener('click',()=>{
            bill.optionalPlans = bill.optionalPlans.filter(p=>p!==item);
            container.removeChild(div);
            updateTotal();
        });
        div.appendChild(nameInput);
        div.appendChild(priceInput);
        div.appendChild(dec);
        div.appendChild(span);
        div.appendChild(inc);
        div.appendChild(remove);
        container.appendChild(div);
    });


    function createStaffRow(container, price, array) {
        const div = document.createElement('div');
        const nameInput = document.createElement('input');
        nameInput.setAttribute('list', container.id + '-list');
        const dec = document.createElement('button');
        dec.textContent = '-';
        const span = document.createElement('span');
        span.textContent = '0';
        const inc = document.createElement('button');
        inc.textContent = '+';
        const remove = document.createElement('button');
        remove.textContent = '削除';
        const item = {name:'',count:0};
        array.push(item);
        function sync() {
            item.name = nameInput.value;
            span.textContent = item.count;
            updateTotal();
        }
        dec.addEventListener("click", () => { if (item.count > 0) { item.count--; sync(); } });
        inc.addEventListener("click", () => { item.count++; sync(); });
        nameInput.addEventListener('input',sync);
        remove.addEventListener('click',()=>{
            array.splice(array.indexOf(item),1);
            container.removeChild(div);
            updateTotal();
        });
        div.appendChild(nameInput);
        div.appendChild(dec);
        div.appendChild(span);
        div.appendChild(inc);
        div.appendChild(remove);
        container.appendChild(div);
    }

    document.getElementById('add-staff-d').addEventListener('click', () => {
        const container = document.getElementById('staff-d-container');
        createStaffRow(container, 600, bill.staffD);
    });

    document.getElementById('add-staff-t').addEventListener('click', () => {
        const container = document.getElementById('staff-t-container');
        createStaffRow(container, 1000, bill.staffT);
    });

    document.getElementById('start-btn').addEventListener('click', () => {
        bill.name = document.getElementById('bill-name').value;
        const seat = document.querySelector('input[name="seat"]:checked');
        bill.seat = seat ? seat.value : '';
        bill.startTime = Date.now();
        bill.status = 'active';
        updateTotal();
        const activeBills = loadBills('activeBills');
        activeBills.push(bill);
        saveBills('activeBills', activeBills);
        window.location.href = 'active.html';
    });
}

// main entry

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('email')) {
        localStorage.setItem('email', DEFAULT_EMAIL);
        localStorage.setItem('password', DEFAULT_PASSWORD);
    }

    const form = document.getElementById('login-form');
    if (form) {
        const errorMessage = document.getElementById('error-message');
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const storedEmail = localStorage.getItem('email');
            const storedPassword = localStorage.getItem('password');
            if (email === storedEmail && password === storedPassword) {
                window.location.href = "main.html";
            } else {
                errorMessage.textContent = "メールアドレスまたはパスワードが正しくありません";
            }
        });
    }

    const billsBtn = document.getElementById('bills-btn');
    if (billsBtn) {
        billsBtn.addEventListener('click', () => {
            window.location.href = 'bills.html';
        });
    }

    const newBillBtn = document.getElementById('new-bill');
    if (newBillBtn) {
        newBillBtn.addEventListener('click', () => {
            window.location.href = 'new.html';
        });
    }
    const inStoreBtn = document.getElementById('in-store');
    if (inStoreBtn) {
        inStoreBtn.addEventListener('click', () => {
            window.location.href = 'active.html';
        });
    }
    const paidBtn = document.getElementById('paid');
    if (paidBtn) {
        paidBtn.addEventListener('click', () => {
            window.location.href = 'paid.html';
        });
    }

    const paymentBtn = document.getElementById('payment-btn');
    if (paymentBtn) {
        paymentBtn.addEventListener('click', () => {
            window.location.href = 'payment.html';
        });
    }

    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        initNewBillPage();
    }

    const activeList = document.getElementById('active-list');
    if (activeList) {
        renderActiveBills();
        document.getElementById('back').addEventListener('click', () => {
            window.location.href = 'bills.html';
        });
    }

    const paidList = document.getElementById('paid-list');
    if (paidList) {
        renderPaidBills();
        document.getElementById('back').addEventListener('click', () => {
            window.location.href = 'bills.html';
        });
    }
});
