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
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const ymd = `${y}${m}${d}`;
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

function formatBillLabel(bill) {
    if (!bill.startTime) return bill.id;
    const pad = n => String(n).padStart(2, '0');
    const start = new Date(bill.startTime);
    const mmdd = `${pad(start.getMonth() + 1)}/${pad(start.getDate())}`;
    const startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const baseExit = new Date(bill.startTime + 90 * 60 * 1000);
    let exit = baseExit;
    let extended = false;
    if (Date.now() > baseExit.getTime()) {
        const extraHours = Math.ceil((Date.now() - baseExit.getTime()) / (60 * 60 * 1000));
        exit = new Date(baseExit.getTime() + extraHours * 60 * 60 * 1000);
        extended = extraHours > 0;
    }
    const exitStr = `${pad(exit.getHours())}:${pad(exit.getMinutes())}`;
    if (extended) {
        return `${mmdd} ${startStr} \u5ef6\u9577\u4e2d ${exitStr}`; // 延長中
    }
    const baseStr = `${pad(baseExit.getHours())}:${pad(baseExit.getMinutes())}`;
    return `${mmdd} ${startStr} ${baseStr}`;
}

// Initialize invoice creation page
function initNewBillPage(editId) {
    const bills = loadBills('bills');
    let bill;
    let isEdit = false;
    if (editId) {
        bill = bills.find(b => b.id === editId && b.status === 'active');
        if (!bill) {
            window.location.href = 'active.html';
            return;
        }
        if (!('discount' in bill)) bill.discount = 0;
        isEdit = true;
    } else {
        bill = {
            id: null,
            name: '',
            seat: '',
            male: 0,
            female: 0,
            plan2500: 0,
            plan3000: 0,
            optionalPlans: [],
            staffD: [],
            staffT: [],
            discount: 0,
            startTime: null,
            status: 'new',
            total: 0
        };
    }
    document.getElementById('bill-id').textContent = isEdit ? bill.id : '未発番';
    const startBtn = document.getElementById('start-btn');
    startBtn.textContent = '保存';
    const title = document.getElementById('page-title');
    if (title) {
        title.textContent = isEdit ? '伝票編集' : '新規伝票作成';
    }
    const timeInput = document.getElementById('start-time');
    const discountInput = document.getElementById('discount-input');
    const discountDisplay = document.getElementById('discount-display');

    function updateTotal() {
        let total = bill.plan2500 * 2500 + bill.plan3000 * 3000;
        bill.optionalPlans.forEach(p => { total += p.price * p.count; });
        bill.staffD.forEach(s => { total += s.price * s.count; });
        bill.staffT.forEach(s => { total += s.price * s.count; });
        total += calcExtension(bill.startTime, bill.male + bill.female);
        const discountVal = parseInt(discountInput.value || '0', 10);
        bill.discount = isNaN(discountVal) ? 0 : discountVal;
        total -= bill.discount;
        bill.total = total;
        discountDisplay.textContent = bill.discount;
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

    const pad = n => String(n).padStart(2, '0');
    if (isEdit) {
        const start = new Date(bill.startTime);
        timeInput.value = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
        discountInput.value = bill.discount;
    } else {
        const now = new Date();
        now.setSeconds(0,0);
        const m = Math.ceil(now.getMinutes() / 5) * 5;
        if (m === 60) { now.setHours(now.getHours()+1); now.setMinutes(0); } else { now.setMinutes(m); }
        timeInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        bill.startTime = now.getTime();
        discountInput.value = 0;
    }
    discountDisplay.textContent = bill.discount;
    timeInput.addEventListener('change', () => {
        if (timeInput.value) {
            const parts = timeInput.value.split(':');
            const d = new Date();
            d.setHours(parseInt(parts[0],10), parseInt(parts[1],10), 0, 0);
            bill.startTime = d.getTime();
            updateTotal();
        }
    });
    discountInput.addEventListener('input', updateTotal);
    updateTotal();

    if (isEdit) {
        document.getElementById('bill-name').value = bill.name;
        document.getElementById('male-count').textContent = bill.male;
        document.getElementById('female-count').textContent = bill.female;
        document.getElementById('plan2500-count').textContent = bill.plan2500;
        document.getElementById('plan3000-count').textContent = bill.plan3000;
        const seat = document.querySelector(`input[name="seat"][value="${bill.seat}"]`);
        if (seat) seat.checked = true;
    }

    document.getElementById('add-optional-plan').addEventListener('click', () => {
        const container = document.getElementById('optional-plans-container');
        const div = document.createElement('div');
        const nameInput = document.createElement('input');
        nameInput.placeholder = '項目';
        const priceInput = document.createElement('input');
        priceInput.type = 'text';
        priceInput.inputMode = 'numeric';
        priceInput.placeholder = '金額';
        const warning = document.createElement('span');
        warning.style.color = 'red';
        warning.style.marginLeft = '4px';
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
            if (/^\d+$/.test(priceInput.value)) {
                item.price = parseInt(priceInput.value, 10);
                warning.textContent = '';
            } else {
                item.price = 0;
                if (priceInput.value !== '') {
                    warning.textContent = '数字のみを入力してください';
                } else {
                    warning.textContent = '';
                }
            }
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
        div.appendChild(warning);
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
        const item = {name:'',count:0,price};
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
        const parts = timeInput.value.split(':');
        const d = new Date();
        d.setHours(parseInt(parts[0],10), parseInt(parts[1],10), 0, 0);
        bill.startTime = d.getTime();
        updateTotal();
        if (!isEdit) {
            bill.id = generateBillId();
            document.getElementById('bill-id').textContent = bill.id;
            bill.status = 'active';
            bills.push(bill);
        }
        saveBills('bills', bills);
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

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        const params = new URLSearchParams(location.search);
        initNewBillPage(params.get('id'));
    }

    const activeList = document.getElementById('active-list');
    if (activeList) {
        initActivePage();
    }

    const paidList = document.getElementById('paid-list');
    if (paidList) {
        initPaidPage();
    }
});

function renderBillRow(container, bill, opts = {}) {
    const div = document.createElement('div');
    div.textContent = `${formatBillLabel(bill)} ${bill.name} 合計${bill.total}円`;
    if (opts.onSettle) {
        const btn = document.createElement('button');
        btn.textContent = '清算';
        btn.addEventListener('click', () => opts.onSettle(bill));
        div.appendChild(btn);
    }
    if (opts.onEdit) {
        const btn = document.createElement('button');
        btn.textContent = '編集';
        btn.addEventListener('click', () => opts.onEdit(bill));
        div.appendChild(btn);
    }
    if (opts.onActivate) {
        const btn = document.createElement('button');
        btn.textContent = '戻す';
        btn.addEventListener('click', () => opts.onActivate(bill));
        div.appendChild(btn);
    }
    if (opts.onDelete) {
        const btn = document.createElement('button');
        btn.textContent = '削除';
        btn.addEventListener('click', () => opts.onDelete(bill));
        div.appendChild(btn);
    }
    container.appendChild(div);
}

function initActivePage() {
    const container = document.getElementById('active-list');
    const bills = loadBills('bills');
    container.innerHTML = '';
    bills.filter(b => b.status === 'active').forEach(bill => {
        renderBillRow(container, bill, {
            onSettle: billToSettle => {
                billToSettle.status = 'paid';
                saveBills('bills', bills);
                initActivePage();
            },
            onEdit: billToEdit => {
                window.location.href = 'new.html?id=' + encodeURIComponent(billToEdit.id);
            }
        });
    });
}

function initPaidPage() {
    const container = document.getElementById('paid-list');
    const bills = loadBills('bills');
    container.innerHTML = '';
    bills.filter(b => b.status === 'paid').forEach(bill => {
        renderBillRow(container, bill, {
            onActivate: b => {
                b.status = 'active';
                saveBills('bills', bills);
                initPaidPage();
            },
            onDelete: b => {
                if (confirm('本当に削除しますか?')) {
                    const pwd = prompt('パスワードを入力してください');
                    if (pwd === localStorage.getItem('password')) {
                        bills.splice(bills.indexOf(b), 1);
                        saveBills('bills', bills);
                        initPaidPage();
                    } else {
                        alert('パスワードが違います');
                    }
                }
            }
        });
    });
}

function initEditPage(id) {
    const bills = loadBills('bills');
    const bill = bills.find(b => b.id === id && b.status === 'active');
    if (!bill) {
        window.location.href = 'active.html';
        return;
    }
    document.getElementById('bill-id').textContent = bill.id;
    const nameInput = document.getElementById('bill-name');
    nameInput.value = bill.name;
    document.getElementById('save-btn').addEventListener('click', () => {
        bill.name = nameInput.value;
        saveBills('bills', bills);
        window.location.href = 'active.html';
    });
}
