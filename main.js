const DEFAULT_EMAIL = 'admin@karaoke.jp';
const DEFAULT_PASSWORD = '12345678';

function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
}

function setupThemeToggle() {
    applyTheme();
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const cur = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', cur);
            applyTheme();
        });
    }
}

function confirmModal(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'modal';
        const p = document.createElement('p');
        p.textContent = message;
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        ok.className = 'primary';
        const cancel = document.createElement('button');
        cancel.textContent = 'キャンセル';
        modal.appendChild(p);
        modal.appendChild(ok);
        modal.appendChild(cancel);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        ok.addEventListener('click', () => { document.body.removeChild(overlay); resolve(true); });
        cancel.addEventListener('click', () => { document.body.removeChild(overlay); resolve(false); });
    });
}

// Utility to read/write bill arrays
function loadBills(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
        console.error('localStorage load error', e);
        return [];
    }
}

function saveBills(key, bills) {
    try {
        localStorage.setItem(key, JSON.stringify(bills));
    } catch (e) {
        console.error('localStorage save error', e);
    }
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

function calcExtension(startTime, people, endTime = Date.now()) {
    if (!startTime) return 0;
    const base = 90 * 60 * 1000; // 90 minutes
    const diff = endTime - startTime;
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
        if (!('customerType' in bill)) bill.customerType = '';
        isEdit = true;
    } else {
        bill = {
            id: null,
            name: '',
            seat: '',
            customerType: '',
            people: [],
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
    const discountEnter = document.getElementById('discount-enter');
    const discountInputArea = document.getElementById('discount-input-area');
    const discountInput = document.getElementById('discount-input');
    const discountOk = document.getElementById('discount-ok');
    const discountDisplayArea = document.getElementById('discount-display-area');
    const discountDisplay = document.getElementById('discount-display');
    const discountDelete = document.getElementById('discount-delete');
    const peopleContainer = document.getElementById('people-container');
    const customerButtons = document.querySelectorAll('#customer-type-section button');
    customerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            customerButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            bill.customerType = btn.dataset.type;
        });
    });
    let discountAmount = bill.discount || 0;


    function updateTotal() {
        let total = 0;
        bill.people.forEach(p => { if (p.plan) total += p.plan; });
        bill.optionalPlans.forEach(p => { total += p.price * p.count; });
        bill.staffD.forEach(s => { total += s.price * s.count; });
        bill.staffT.forEach(s => { total += s.price * s.count; });
        let extension = 0;
        bill.people.forEach(p => {
            const exitTime = p.earlyExit ? p.earlyExitTime : Date.now();
            extension += calcExtension(bill.startTime, 1, exitTime);
        });
        total += extension;
        total -= discountAmount;
        bill.discount = discountAmount;
        bill.total = total;
        if (discountDisplay) {
            discountDisplay.textContent = `ディスカウント：${discountAmount}円`;
        }
        const elapsedEl = document.getElementById('elapsed-time');
        const extensionEl = document.getElementById('extension-fee');
        if (elapsedEl && extensionEl) {
            if (bill.startTime) {
                const diff = Date.now() - bill.startTime;
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                elapsedEl.textContent = `${h}:${String(m).padStart(2,'0')}`;
            } else {
                elapsedEl.textContent = '0:00';
            }
            extensionEl.textContent = extension;
        }
        document.getElementById('total').textContent = total;
    }

    function addPerson(gender, existing) {
        const person = existing || { name: '', gender, plan: null, earlyExit: false, earlyExitTime: null };
        if (!('earlyExit' in person)) person.earlyExit = false;
        if (!('earlyExitTime' in person)) person.earlyExitTime = null;
        bill.people.push(person);
        const div = document.createElement('div');
        div.classList.add('person-entry', gender);

        const nameInput = document.createElement('input');
        nameInput.placeholder = '名前を入力';
        nameInput.value = person.name || '';
        nameInput.addEventListener('input', () => { person.name = nameInput.value; });

        const planChoice = document.createElement('div');
        const btn2500 = document.createElement('button');
        btn2500.textContent = '2500円';
        const btn3000 = document.createElement('button');
        btn3000.textContent = '3000円';
        planChoice.appendChild(btn2500);
        planChoice.appendChild(btn3000);

        const planDisplay = document.createElement('div');
        const planSpan = document.createElement('span');
        const changeBtn = document.createElement('button');
        changeBtn.textContent = 'プラン変更';
        planDisplay.appendChild(planSpan);
        planDisplay.appendChild(changeBtn);
        planDisplay.style.display = 'none';

        function selectPlan(price) {
            person.plan = price;
            planSpan.textContent = price + '円';
            planChoice.style.display = 'none';
            planDisplay.style.display = '';
            updateTotal();
        }
        btn2500.addEventListener('click', () => selectPlan(2500));
        btn3000.addEventListener('click', () => selectPlan(3000));
        changeBtn.addEventListener('click', () => {
            planChoice.style.display = '';
            planDisplay.style.display = 'none';
        });

        if (person.plan) {
            planSpan.textContent = person.plan + '円';
            planChoice.style.display = 'none';
            planDisplay.style.display = '';
        }

        const earlyBtn = document.createElement('button');
        const earlyTimeInput = document.createElement('input');
        earlyTimeInput.type = 'time';
        earlyTimeInput.step = '300';
        earlyTimeInput.style.marginLeft = '4px';
        earlyTimeInput.style.display = 'none';
        const updateEarlyDisplay = () => {
            if (person.earlyExit) {
                earlyBtn.textContent = '早退中';
                earlyTimeInput.style.display = '';
                if (person.earlyExitTime) {
                    const d = new Date(person.earlyExitTime);
                    earlyTimeInput.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
            } else {
                earlyBtn.textContent = '早退';
                earlyTimeInput.style.display = 'none';
            }
        };
        updateEarlyDisplay();
        earlyBtn.addEventListener('click', () => {
            if (!person.earlyExit) {
                person.earlyExit = true;
                person.earlyExitTime = Date.now();
            } else {
                person.earlyExit = false;
                person.earlyExitTime = null;
            }
            updateEarlyDisplay();
            updateTotal();
            saveBills('bills', bills);
        });
        earlyTimeInput.addEventListener('change', () => {
            if (earlyTimeInput.value) {
                const parts = earlyTimeInput.value.split(':');
                const d = new Date();
                d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
                person.earlyExitTime = d.getTime();
                updateTotal();
                saveBills('bills', bills);
            }
        });

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '削除';
        removeBtn.addEventListener('click', async () => {
            if (await confirmModal('本当に削除しますか?')) {
                bill.people.splice(bill.people.indexOf(person), 1);
                peopleContainer.removeChild(div);
                updateTotal();
            }
        });

        div.appendChild(nameInput);
        div.appendChild(planChoice);
        div.appendChild(planDisplay);
        div.appendChild(earlyBtn);
        div.appendChild(earlyTimeInput);
        div.appendChild(removeBtn);
        peopleContainer.appendChild(div);
        updateTotal();
    }



    const pad = n => String(n).padStart(2, '0');
    if (isEdit) {
        const start = new Date(bill.startTime);
        timeInput.value = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    } else {
        const now = new Date();
        now.setSeconds(0,0);
        const m = Math.ceil(now.getMinutes() / 5) * 5;
        if (m === 60) { now.setHours(now.getHours()+1); now.setMinutes(0); } else { now.setMinutes(m); }
        timeInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        bill.startTime = now.getTime();
    }
    function syncDiscountUI() {
        if (discountAmount > 0) {
            discountEnter.style.display = 'none';
            discountInputArea.style.display = 'none';
            discountDisplayArea.style.display = '';
            discountDisplay.textContent = `ディスカウント：${discountAmount}円`;
        } else {
            discountDisplayArea.style.display = 'none';
            discountInputArea.style.display = 'none';
            discountEnter.style.display = '';
        }
    }
    syncDiscountUI();
    timeInput.addEventListener('change', () => {
        if (timeInput.value) {
            const parts = timeInput.value.split(':');
            const d = new Date();
            d.setHours(parseInt(parts[0],10), parseInt(parts[1],10), 0, 0);
            bill.startTime = d.getTime();
            updateTotal();
        }
    });
    discountEnter.addEventListener('click', () => {
        discountEnter.style.display = 'none';
        discountInputArea.style.display = '';
        discountInput.value = discountAmount || 0;
    });
    discountOk.addEventListener('click', () => {
        const val = parseInt(discountInput.value || '0', 10);
        discountAmount = isNaN(val) ? 0 : val;
        syncDiscountUI();
        updateTotal();
    });
    discountDelete.addEventListener('click', async () => {
        if (await confirmModal('ディスカウントを削除しますか?')) {
            discountAmount = 0;
            syncDiscountUI();
            updateTotal();
        }
    });

    document.getElementById('add-male').addEventListener('click', () => addPerson('male'));
    document.getElementById('add-female').addEventListener('click', () => addPerson('female'));

    updateTotal();
    setInterval(updateTotal, 60000);

    if (isEdit) {
        document.getElementById('bill-name').value = bill.name;
        const seat = document.querySelector(`input[name="seat"][value="${bill.seat}"]`);
        if (seat) seat.checked = true;
        if (bill.customerType) {
            const btn = document.querySelector(`#customer-type-section button[data-type="${bill.customerType}"]`);
            if (btn) {
                btn.classList.add('selected');
            }
        }
        if (Array.isArray(bill.people)) {
            bill.people.forEach(p => addPerson(p.gender, p));
        }
    }

    document.getElementById('add-optional-plan').addEventListener('click', () => {
        const container = document.getElementById('optional-plans-container');
        const div = document.createElement('div');
        div.classList.add('flex-row');
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
        remove.addEventListener('click', async ()=>{
            if (await confirmModal('本当に削除しますか?')) {
                bill.optionalPlans = bill.optionalPlans.filter(p=>p!==item);
                container.removeChild(div);
                updateTotal();
            }
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
        div.classList.add('flex-row');
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
        remove.addEventListener('click', async ()=>{
            if (await confirmModal('本当に削除しますか?')) {
                array.splice(array.indexOf(item),1);
                container.removeChild(div);
                updateTotal();
            }
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
        const selectedCustomer = document.querySelector('#customer-type-section button.selected');
        bill.customerType = selectedCustomer ? selectedCustomer.dataset.type : '';
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
    setupThemeToggle();
    try {
        if (!localStorage.getItem('email')) {
            localStorage.setItem('email', DEFAULT_EMAIL);
            localStorage.setItem('password', DEFAULT_PASSWORD);
        }
    } catch (e) {
        console.error('localStorage access error', e);
    }

    const form = document.getElementById('login-form');
    if (form) {
        const errorMessage = document.getElementById('error-message');
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            let storedEmail = null;
            let storedPassword = null;
            try {
                storedEmail = localStorage.getItem('email');
                storedPassword = localStorage.getItem('password');
            } catch (e) {
                console.error('localStorage access error', e);
            }
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
            onDelete: async b => {
                if (await confirmModal('本当に削除しますか?')) {
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
