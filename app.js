const API_URL = 'https://jsonplaceholder.typicode.com/todos';
const STORAGE_KEY = 'tareas';

const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
const formatDate = (d) => new Date(`${d}T00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function newId(origin, used) {
  let id;
  do {
    const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
    id = `TSK-${origin}-${Date.now().toString(36)}-${rand}`.toUpperCase();
  } while (used.has(id));
  used.add(id);
  return id;
}

class Base extends HTMLElement {
  constructor(html) {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `<link rel="stylesheet" href="styles.css">${html}`;
  }
  $(selector) { return this.shadowRoot.querySelector(selector); }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
}

customElements.define('task-form', class extends Base {
  constructor() {
    super(`
      <dialog aria-labelledby="form-title">
        <form method="dialog">
          <h2 id="form-title"></h2>
          <label>Título <input name="title" required maxlength="120" autocomplete="off"></label>
          <label>Fecha de registro <input name="date" type="date" required></label>
          <label class="check"><input name="completed" type="checkbox"> Completada</label>
          <footer>
            <button type="button" id="cancel">Cancelar</button>
            <button class="primary">Guardar</button>
          </footer>
        </form>
      </dialog>`);
    const { title, date, completed } = this.$('form').elements;
    title.oninput = () => title.setCustomValidity(title.value.trim().length < 3 ? 'Escribe al menos 3 caracteres.' : '');
    this.$('#cancel').onclick = () => this.$('dialog').close();

    this.$('form').onsubmit = () => this.emit('save', {
      id: this.editingId, title: title.value.trim(), date: date.value, completed: completed.checked,
    });
  }

  open(task) {
    const { title, date, completed } = this.$('form').elements;
    this.editingId = task?.id;
    this.$('#form-title').textContent = task ? 'Editar tarea' : 'Nueva tarea';
    title.value = task?.title ?? '';
    title.setCustomValidity('');
    date.value = task?.date ?? today();
    date.max = today();
    completed.checked = task?.completed ?? false;
    this.$('dialog').showModal();
  }
});


customElements.define('task-import', class extends Base {
  constructor() {
    super(`
      <dialog aria-labelledby="import-title">
        <h2 id="import-title">Importar tareas</h2>
        <p class="muted" role="status"></p>
        <button id="retry" hidden>Reintentar</button>
        <label class="check" id="all-wrap" hidden><input type="checkbox" id="all"> Seleccionar todas</label>
        <ul class="pick"></ul>
        <footer>
          <button id="close">Cancelar</button>
          <button class="primary" id="ok" disabled>Importar</button>
        </footer>
      </dialog>`);
    this.$('#close').onclick = () => this.$('dialog').close();
    this.$('#retry').onclick = () => this.load();
    this.$('#all').onchange = (e) => { this.boxes().forEach((b) => { b.checked = e.target.checked; }); this.count(); };
    this.$('ul').onchange = () => this.count();
    this.$('#ok').onclick = () => {
      const selected = new Set(this.boxes().filter((b) => b.checked).map((b) => Number(b.value)));
      this.emit('import', this.todos.filter((t) => selected.has(t.id)));
      this.$('dialog').close();
    };
  }

  open(importedIds) {
    this.imported = importedIds;
    this.$('dialog').showModal();
    this.todos ? this.render() : this.load();
  }

  async load() {
    this.status('Cargando tareas…');
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`el servidor respondió con el error ${res.status}`);
      const data = await res.json().catch(() => null);
      if (!Array.isArray(data)) throw new Error('la respuesta no es válida');
      this.todos = data;
      this.render();
    } catch (err) {
      const reason = err.name === 'TimeoutError' ? 'el servidor tardó demasiado'
        : err instanceof TypeError ? 'no hay conexión con el servidor' : err.message;
      this.status(`No se pudieron cargar las tareas: ${reason}.`, true);
    }
  }

  status(message, isError = false) {
    this.$('[role=status]').textContent = message;
    this.$('#retry').hidden = !isError;
    this.$('#all-wrap').hidden = true;
    this.$('ul').innerHTML = '';
    this.count();
  }

  render() {
    this.status(`${this.todos.length} tareas disponibles. Las ya importadas aparecen deshabilitadas.`);
    this.$('#all-wrap').hidden = false;
    this.$('ul').innerHTML = this.todos.map((t) => {
      const imported = this.imported.has(t.id);
      return `<li><label class="check">
        <input type="checkbox" value="${t.id}" ${imported ? 'disabled' : ''}>
        <span>${esc(t.title)}<small>#${t.id} · ${t.completed ? 'Completada' : 'Pendiente'}${imported ? ' · Ya importada' : ''}</small></span>
      </label></li>`;
    }).join('');
    this.count();
  }

  boxes() { return [...this.shadowRoot.querySelectorAll('ul input:not(:disabled)')]; }

  count() {
    const total = this.boxes().length;
    const n = this.boxes().filter((b) => b.checked).length;
    this.$('#ok').disabled = n === 0;
    this.$('#ok').textContent = n ? `Importar (${n})` : 'Importar';
    this.$('#all').checked = n > 0 && n === total;
    this.$('#all').indeterminate = n > 0 && n < total;
  }
});


customElements.define('task-app', class extends Base {
  constructor() {
    super(`
      <header>
        <h1>Gestión de tareas</h1>
        <p class="muted" id="summary" aria-live="polite"></p>
      </header>
      <nav class="bar" aria-label="Acciones">
        <button class="primary" data-act="new">+ Nueva tarea</button>
        <button data-act="import">Importar</button>
        <button data-act="complete">Marcar terminadas</button>
        <button class="danger" data-act="clear">Vaciar lista</button>
      </nav>
      <div class="bar">
        <input type="search" id="search" placeholder="Buscar tareas…" aria-label="Buscar tareas">
        <select id="filter" aria-label="Filtrar por estado">
          <option value="all">Todas</option>
          <option value="pending">Pendientes</option>
          <option value="done">Completadas</option>
        </select>
      </div>
      <ul class="list"></ul>
      <p class="muted empty"></p>
      <task-form></task-form>
      <task-import></task-import>`);
    try { this.tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { this.tasks = []; }

    this.$('#search').oninput = this.$('#filter').onchange = () => this.render();
    this.shadowRoot.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (el) this.action(el.dataset.act, el.dataset.id);
    });
    this.shadowRoot.addEventListener('save', (e) => this.saveTask(e.detail));
    this.shadowRoot.addEventListener('import', (e) => this.importTodos(e.detail));
    this.render();
  }

  action(act, id) {
    const task = this.tasks.find((t) => t.id === id);
    const editable = task?.origin === 'local'; // las importadas solo se pueden eliminar
    if (act === 'new') this.$('task-form').open();
    if (act === 'edit' && editable) this.$('task-form').open(task);
    if (act === 'import') this.$('task-import').open(new Set(this.tasks.map((t) => t.apiId)));
    if (act === 'toggle' && editable) task.completed = !task.completed;
    if (act === 'delete' && confirm(`¿Eliminar "${task.title}"?`)) this.tasks = this.tasks.filter((t) => t !== task);
    if (act === 'complete') this.visible().forEach((t) => { if (t.origin === 'local') t.completed = true; });
    if (act === 'clear' && confirm('¿Vaciar toda la lista de tareas?')) this.tasks = [];
    this.commit();
  }

  saveTask({ id, ...data }) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) Object.assign(task, data);
    else this.tasks.unshift({ id: newId('L', this.ids()), ...data, origin: 'local' });
    this.commit();
  }

  importTodos(todos) {
    const ids = this.ids();
    this.tasks.unshift(...todos.map((t) => ({
      id: newId('A', ids), title: t.title, date: today(), completed: t.completed, origin: 'api', apiId: t.id,
    })));
    this.commit();
  }

  ids() { return new Set(this.tasks.map((t) => t.id)); }

  visible() {
    const q = this.$('#search').value.trim().toLowerCase();
    const f = this.$('#filter').value;
    return this.tasks.filter((t) => t.title.toLowerCase().includes(q) && (f === 'all' || (f === 'done') === t.completed));
  }

  commit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    this.render();
  }

  render() {
    const focused = this.shadowRoot.activeElement?.dataset ?? {}; // para conservar el foco tras re-renderizar
    const list = this.visible();
    this.$('.list').innerHTML = list.map((t) => {
      const api = t.origin === 'api';
      const title = esc(t.title);
      return `<li class="${t.completed ? 'done' : ''}">
        <input type="checkbox" data-act="toggle" data-id="${t.id}" ${t.completed ? 'checked' : ''} ${api ? 'disabled' : ''} aria-label="Completada: ${title}">
        <div class="info">
          <span class="title">${title}</span>
          <small>${formatDate(t.date)} · ${t.completed ? 'Completada' : 'Pendiente'} · ${api ? 'Importada (solo lectura)' : 'Creada por ti'} · ${t.id}</small>
        </div>
        <button class="icon" data-act="edit" data-id="${t.id}" ${api ? 'disabled' : ''} aria-label="Editar ${title}" title="Editar">✎</button>
        <button class="icon danger" data-act="delete" data-id="${t.id}" aria-label="Eliminar ${title}" title="Eliminar">✕</button>
      </li>`;
    }).join('');

    const done = this.tasks.filter((t) => t.completed).length;
    this.$('#summary').textContent = `${done} de ${this.tasks.length} tareas completadas`;
    this.$('.empty').textContent = list.length ? ''
      : this.tasks.length ? 'Ninguna tarea coincide con la búsqueda o el filtro.'
      : 'No hay tareas. Crea una nueva o impórtalas desde la API.';
    this.$('[data-act=complete]').disabled = !list.some((t) => !t.completed && t.origin === 'local');
    this.$('[data-act=clear]').disabled = !this.tasks.length;
    this.$(`[data-act="${focused.act}"][data-id="${focused.id}"]`)?.focus();
  }
});
