//nueva funcionalidad de categorias
//

let cats;
 try{ 
    cats=JSON.parse(localStorage.getItem('categorias')) || [];
}  catch {
    cats = [];
}

const findCat=(name) => cats.find((c) => c.name.toLowerCase() === name.toLowerCase());

const fillCats = (select, value) => {
    const options = cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    select.innerHTML = `<option value="">Sin categoria</option>${options}`;
    select.value = cats.some((c) => c.id === value) ? value : '';
};

//esto guardara y repintara la lista; las tareas de una categoria eliminada quedan sin categoria
const saveCats = (removedId) => {
    localStorage.setItem('categorias', JSON.stringify(cats));
    app.tasks.forEach((t) => {if (removedId && t.category === removedId) t.category = ''; });
    app.commit();
}

//crea la categoria y devuelve su id (si ya existe una con ese nombre, devuelve la existente)
const addCat = (name) => {
    const existing = findCat(name);
    if (existing) return existing.id;
    const id = `CAT-${Date.now().toString(36)}`.toUpperCase();
    cats.push({id,name});
    saveCats();
    return id;
};

//modal para gestionar las categorias
customElements.define('task-categories', class extends Base {
  constructor() {
    super(`
      <dialog aria-labelledby="cat-title">
        <h2 id="cat-title">categorias</h2>
        <form class="bar">
            <input name = "name" required maxlength="40" placeholder="Nueva categoria" aria-label="Nombre de la nueva categoria" autocomplete="off">
            <button class="primary">Agregar</button>
        </form>
        <ul class="list"></ul>
        <p class="muted empty"></p>
        <footer><button id="close">Cerrar</button></footer>
      </dialog>`);
      const {name} = this.$('form').elements;
      name.oninput = () => {
        const value = name.value.trim();
        name.setCustomValidity(!value ? 'Escribe un nombre.' : findCat(value) ? 'Ya existe una categoria con ese nombre.' : '');

      };
      this.$('#close').onclick = () => this.$('dialog').close();
      this.$('form').onsubmit = (e) => {
        e.preventDefault();
        addCat(name.value.trim());
        name.value = '';
        this.render();
      };
      //renombrar 
      this.$('ul').onchange = ({target}) => {
        const cat = cats.find((c) => c.id === target.dataset.id);
        const value = target.value.trim();
        if(value && (findCat(value) ?? cat) === cat) cat.name = value;
        saveCats();
        this.render();
      };  
      //eliminar
      this.$('ul').onclick = ({target}) => {
        const cat = cats.find((c) => c.id === target.dataset.del);
        if(!cat || !confirm(`¿Eliminar la categoria "${cat.name}"? Sus tareas quedaran sin categoria.`)) return;
        cats = cats.filter((c) => c !== cat);
        saveCats(cat.id);
        this.render();
      };
}

    open(){
        this.render();
        this.$('dialog').showModal();
    }

    render(){
        this.$('ul').innerHTML = cats.map((c) => `<li>
        <input style="flex:1" value="${esc(c.name)}" data-id="${c.id}" maxlength="40" aria-label="nombre de la categoria ${esc(c.name)}">
        <button class="icon danger" data-del="${c.id}" aria-label="Eliminar ${esc(c.name)}" title="Eliminar">X</button>
        </li>`).join('');
        this.$('.empty').textContent = cats.length ? '' : 'Aun no hay categorias';
    }
});

//integracion con los componented existentes de app.js
const app = document.querySelector('task-app');
const form = app.$('task-form');
const importer = app.$('task-import');
const {render, importTodos} =app;
const {open: formOpen, emit: formEmit} = form;
const {open: importOpen} =importer;

//boton y modal de gestion de categorias
app.shadowRoot.append(document.createElement('task-categories'));
app.$('[data-act=import]').insertAdjacentHTML('afterend', '<button id="cats">Categorias</button>');
app.$('#cats').onclick = () => app.$('task-categories').open();

//formulario de tareas: selector de categoria y boton para crear una nueva sin salir del formulario
form.$('label.check').insertAdjacentHTML('beforebegin', `<label for="category" style="margin-bottom:4px">Categorias</label>
    <div style="display:flex;gap:8px;margin-bottom:14px">
        <select id="category" style="flex:1"></select>
        <button type="button" id="new-cat">+ Nueva</button>
    </div>`);
form.open = (task) => {
    fillCats(form.$('select'), task?.category);
    formOpen.call(form, task);
};
form.$('#new-cat').onclick = () => {
    const name = prompt('nombre de la nueva categoria:')?.trim().slice(0, 40);
    if (name) fillCats(form.$('select'), addCat(name));
};
form.emit = (type, task) => formEmit.call(form, type, { ...task, category: form.$('select').value});

//importacion: categoria para todas las tareas importadas
importer.$('h2').insertAdjacentHTML('afterend', `<label>Categoria de las tareas importadas
    <select style="display:block;width:100%;margin-top:4px"></select></label>`);
importer.open = (ids) => {
    fillCats(importer.$('select'), importer.$('select').value);
    importOpen.call(importer, ids);
};
app.importTodos = (todos) => {
    importTodos.call(app, todos);
    const category = importer.$('select').value;
    app.tasks.slice(0, todos. length).forEach((t) => {t.category = category;});
    app.commit();
};

//Lista: muestra la categoria de cada tarea
app.render = () => {
    render.call(app);
    app.shadowRoot.querySelectorAll('.list li').forEach((li) => {
        const task = app.tasks.find((t) => t.id === li.querySelector('[data-id]').dataset.id);
        const cat = cats.find((c) => c.id === task.category);
        li.querySelector('small').append(` · ${cat?.name ?? 'sin categoria'}`);
    });
};
app.render();