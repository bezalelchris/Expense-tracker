const STORAGE_KEY = 'transactions';

const CATEGORY_COLORS = {
  Food: 'var(--c-food)',
  Housing: 'var(--c-housing)',
  Transport: 'var(--c-transport)',
  Fun: 'var(--c-fun)',
  School: 'var(--c-school)',
  Other: 'var(--c-other)',
  Income: 'var(--income)',
};

const $ = (id) => document.getElementById(id);
const form = $('form');
const textInput = $('text');
const amountInput = $('amount');
const dateInput = $('date');
const categoryInput = $('category');
const categoryField = $('category-field');
const errorEl = $('error');

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Load saved data. Older versions stored signed amounts with no type/date/category,
// so convert those on the way in.
function load() {
  let raw = [];
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    raw = [];
  }
  return raw.map((t) => ({
    id: t.id,
    text: t.text,
    type: t.type || (t.amount < 0 ? 'expense' : 'income'),
    amount: Math.abs(t.amount),
    category: t.category || (t.amount < 0 ? 'Other' : 'Income'),
    date: t.date || today(),
  }));
}

let transactions = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch {
    // Storage can be unavailable (private mode); the app still works for this session.
  }
}

function selectedType() {
  return document.querySelector('input[name="type"]:checked').value;
}

function renderTotals() {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const spent = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - spent;
  $('balance').textContent = money.format(balance);
  $('balance').classList.toggle('negative', balance < 0);
  $('income').textContent = money.format(income);
  $('expense').textContent = money.format(spent);
}

function renderBreakdown() {
  const totals = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  const wrap = $('breakdown');
  wrap.hidden = sum === 0;
  if (!sum) return;

  const bar = $('breakdown-bar');
  const legend = $('breakdown-legend');
  bar.innerHTML = '';
  legend.innerHTML = '';
  bar.setAttribute('aria-label', 'Spending by category: ' +
    entries.map(([c, v]) => `${c} ${Math.round((v / sum) * 100)}%`).join(', '));

  entries.forEach(([cat, value]) => {
    const seg = document.createElement('span');
    seg.style.width = `${(value / sum) * 100}%`;
    seg.style.background = CATEGORY_COLORS[cat];
    bar.appendChild(seg);

    const li = document.createElement('li');
    const dot = document.createElement('i');
    dot.style.background = CATEGORY_COLORS[cat];
    li.append(dot, `${cat} ${Math.round((value / sum) * 100)}%`);
    legend.appendChild(li);
  });
}

function renderList() {
  const list = $('list');
  list.innerHTML = '';
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  let lastDay = null;
  sorted.forEach((t) => {
    if (t.date !== lastDay) {
      lastDay = t.date;
      const day = document.createElement('li');
      day.className = 'day';
      day.textContent = t.date === today() ? 'Today' : dayFmt.format(new Date(t.date + 'T12:00'));
      list.appendChild(day);
    }

    const item = document.createElement('li');
    item.className = 'item';

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = CATEGORY_COLORS[t.category];

    const desc = document.createElement('div');
    desc.className = 'desc';
    const name = document.createElement('strong');
    name.textContent = t.text; // textContent, never innerHTML, for user input
    const cat = document.createElement('span');
    cat.textContent = t.category;
    desc.append(name, cat);

    const amt = document.createElement('span');
    amt.className = `amt ${t.type}`;
    amt.textContent = (t.type === 'income' ? '+' : '−') + money.format(t.amount);

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('aria-label', `Delete ${t.text}`);
    del.addEventListener('click', () => removeTransaction(t.id));

    item.append(dot, desc, amt, del);
    list.appendChild(item);
  });

  const n = transactions.length;
  $('count').textContent = n ? `${n} transaction${n === 1 ? '' : 's'}` : '';
  $('empty').hidden = n > 0;
}

function render() {
  renderTotals();
  renderBreakdown();
  renderList();
}

function addTransaction(e) {
  e.preventDefault();
  const text = textInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!text) {
    errorEl.textContent = 'Add a description.';
    textInput.focus();
    return;
  }
  if (!(amount > 0)) {
    errorEl.textContent = 'Enter an amount greater than 0.';
    amountInput.focus();
    return;
  }
  errorEl.textContent = '';

  const type = selectedType();
  transactions.push({
    id: Date.now(),
    text,
    type,
    amount: Math.round(amount * 100) / 100,
    category: type === 'income' ? 'Income' : categoryInput.value,
    date: dateInput.value || today(),
  });
  save();
  render();

  textInput.value = '';
  amountInput.value = '';
  textInput.focus();
}

function removeTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  save();
  render();
}

document.querySelectorAll('input[name="type"]').forEach((input) => {
  input.addEventListener('change', () => {
    categoryField.hidden = selectedType() === 'income';
  });
});

form.addEventListener('submit', addTransaction);
dateInput.value = today();
render();
