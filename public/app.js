// FileHub app.js - header + hero search + filter riêng, bỏ thống kê
const API = '/api/files';
let files = [];
let filter = 'all';
let extFilter = 'all'; // filter theo đuôi: pdf, fla, png ...
let searchQ = '';
let sortBy = 'newest';
let view = 'grid';

// Cờ demo: tự ẩn khi deploy (production), hiện khi localhost
const KEEP_DEMO = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === ''); // đổi thành false để ép ẩn

const els = {
  grid: document.getElementById('file-grid'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  sort: document.getElementById('sort'),
  extFilterEl: document.getElementById('ext-filter'),
  typeFiltersEl: document.getElementById('type-filters'),
  info: document.getElementById('result-info'),
  modal: document.getElementById('modal'),
  form: document.getElementById('form-add'),
  toast: document.getElementById('toast'),
  searchContainer: document.getElementById('search-container'),
  main: document.getElementById('main'),
};

function authHeaders(){
  const t = localStorage.getItem('fh_token');
  return t ? { 'Authorization':'Bearer '+t } : {};
}
function updateUserDisplay(){
  const u = localStorage.getItem('fh_user') || 'admin';
  const headerName = document.getElementById('header-user-name');
  if(headerName) headerName.textContent = u;
  const accName = document.getElementById('account-username');
  if(accName) accName.value = u;
  // compat cũ
  const el = document.getElementById('user-display');
  if(el) el.textContent = `👤 ${u}`;
  const sideEl = document.getElementById('sidebar-user-name');
  if(sideEl) sideEl.textContent = u;
}
async function doLogout(){
  try{ await fetch('/api/logout', { method:'POST', credentials:'include', headers: authHeaders() }); }catch{}
  localStorage.removeItem('fh_token');
  localStorage.removeItem('fh_user');
  location.href = '/login.html';
}

function toast(msg, type='success'){
  els.toast.textContent = msg;
  els.toast.className = `toast ${type}`;
  els.toast.classList.remove('hidden');
  setTimeout(()=> els.toast.classList.add('hidden'), 2500);
}

const LS_KEY = 'filehub_files';
function saveLS(){ localStorage.setItem(LS_KEY, JSON.stringify(files)); }
function loadLS(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch{ return null; }
}

async function fetchFiles(){
  updateUserDisplay();
  try{
    const r = await fetch(API, { credentials:'include', headers: authHeaders() });
    if(r.status===401){ location.href='/login.html'; return; }
    if(!r.ok) throw new Error('API error');
    let data = await r.json();
    // nếu KEEP_DEMO = false thì lọc bỏ file demo (id 3 là demo ô số 4)
    if(!KEEP_DEMO){
      data = data.filter(f => f.id !== '3');
    }
    files = data;
    localStorage.setItem(LS_KEY, JSON.stringify(files));
  }catch(e){
    console.warn('API fail, dùng localStorage', e);
    const ls = loadLS();
    if(ls) {
      files = KEEP_DEMO ? ls : ls.filter(f=> f.id!=='3');
    } else files = [];
    toast('Đang chạy chế độ offline (localStorage)', 'error');
  }
  render();
}

async function createFile(data){
  try{
    const r = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, credentials:'include', body: JSON.stringify(data)});
    if(!r.ok) throw new Error((await r.json()).error || 'Lỗi');
    const created = await r.json();
    files.unshift(created);
    saveLS();
    return true;
  }catch(e){
    const newFile = { id: Date.now().toString(), date: new Date().toISOString().slice(0,10), ...data, tags: data.tags ? data.tags.split(',').map(s=>s.trim()).filter(Boolean) : [] };
    files.unshift(newFile);
    saveLS();
    toast('Đã lưu offline (không có server)', 'success');
    return true;
  }
}

async function deleteFile(id){
  try{
    const r = await fetch(`${API}/${id}`, { method:'DELETE', credentials:'include', headers: authHeaders() });
    if(!r.ok) throw new Error('Xóa thất bại');
  }catch(e){
    console.warn('delete offline', e);
  }
  files = files.filter(f=> f.id !== id);
  saveLS();
  render();
  toast('Đã xóa file');
}

async function updateFile(id, data){
  try{
    const r = await fetch(`${API}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json', ...authHeaders()}, credentials:'include', body: JSON.stringify(data)});
    if(r.ok){
      const updated = await r.json();
      const idx = files.findIndex(f=> f.id===id);
      if(idx!==-1) files[idx]=updated;
    } else throw new Error();
  }catch{
    const idx = files.findIndex(f=> f.id===id);
    if(idx!==-1) files[idx]={...files[idx], ...data, tags: typeof data.tags==='string'? data.tags.split(',').map(s=>s.trim()).filter(Boolean): data.tags };
  }
  saveLS();
  render();
}

function iconFor(type){
  const map = { video:'🎬', archive:'📦', document:'📄', image:'🖼️', folder:'📁', other:'📎' };
  return map[type]||'📎';
}
function badgeClass(source){
  if(source==='telegram') return 'telegram';
  if(source==='google-drive') return 'google-drive';
  if(source==='terabox') return 'terabox';
  return 'other';
}
function sourceLabel(s){
  return s==='google-drive' ? 'Google Drive' : s.charAt(0).toUpperCase()+s.slice(1);
}
function getExt(name){
  if(!name) return 'other';
  const base = name.split('?')[0].split('#')[0].trim();
  const m = base.match(/\.([a-z0-9]+)$/i);
  if(!m) return 'other';
  return m[1].toLowerCase();
}
function extLabel(e){
  if(e==='other') return 'Khác';
  return e.toUpperCase();
}

function getFiltered(){
  let out = [...files];
  if(filter!=='all') out = out.filter(f=> f.source===filter);
  if(extFilter!=='all') out = out.filter(f=> getExt(f.name) === extFilter);
  if(searchQ){
    const q = searchQ.toLowerCase();
    out = out.filter(f=> 
      f.name.toLowerCase().includes(q) ||
      f.link.toLowerCase().includes(q) ||
      (f.tags||[]).join(' ').toLowerCase().includes(q) ||
      f.source.toLowerCase().includes(q) ||
      getExt(f.name).includes(q)
    );
  }
  if(sortBy==='newest') out.sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  else if(sortBy==='oldest') out.sort((a,b)=> a.date.localeCompare(b.date));
  else if(sortBy==='name-asc') out.sort((a,b)=> a.name.localeCompare(b.name));
  else if(sortBy==='name-desc') out.sort((a,b)=> b.name.localeCompare(a.name));
  else if(sortBy==='source') out.sort((a,b)=> a.source.localeCompare(b.source));
  return out;
}

// Chỉ cập nhật đếm filter, đã bỏ phần thống kê chi tiết
function renderCounts(){
  const bySource = {
    telegram: files.filter(f=>f.source==='telegram').length,
    'google-drive': files.filter(f=>f.source==='google-drive').length,
    terabox: files.filter(f=>f.source==='terabox').length
  };
  document.getElementById('count-all').textContent = files.length;
  document.getElementById('count-telegram').textContent = bySource.telegram;
  document.getElementById('count-gdrive').textContent = bySource['google-drive'];
  document.getElementById('count-terabox').textContent = bySource.terabox;
}

function renderTypeFilters(){
  if(!els.typeFiltersEl || !els.extFilterEl) return;
  const counts = {};
  files.forEach(f=>{ const e=getExt(f.name); counts[e]=(counts[e]||0)+1; });
  const defaultExts = ['pdf','fla','png','jpg','jpeg','mp4','zip','rar','psd','ai','aep','doc','docx','mp3','mov'];
  const allExts = [...new Set([...defaultExts, ...Object.keys(counts)])].filter(e=> e!=='other').sort();
  if(Object.keys(counts).includes('other')) allExts.push('other');
  // sidebar buttons
  const total = files.length;
  let html = `<button class="type-btn ${extFilter==='all'?'active':''}" data-ext="all">Tất cả <span class="cnt">${total}</span></button>`;
  allExts.forEach(ext=>{
    const c = counts[ext]||0;
    // chỉ hiện những loại có file hoặc là default phổ biến? hiện tất cả default để người dùng biết có thể lọc
    html += `<button class="type-btn ${extFilter===ext?'active':''}" data-ext="${ext}">${extLabel(ext)} <span class="cnt">${c}</span></button>`;
  });
  els.typeFiltersEl.innerHTML = html;
  els.typeFiltersEl.querySelectorAll('.type-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      extFilter = b.dataset.ext;
      if(els.extFilterEl) els.extFilterEl.value = extFilter;
      render();
    });
  });
  // đồng bộ select
  const currentVal = extFilter;
  els.extFilterEl.innerHTML = '<option value="all">Tất cả loại</option>' + allExts.map(ext=>{
    const c = counts[ext]||0;
    return `<option value="${ext}" ${currentVal===ext?'selected':''}>${extLabel(ext)} (${c})</option>`;
  }).join('');
  // nếu filter hiện tại không còn trong list (do đổi dữ liệu) thì reset
  if(currentVal!=='all' && !allExts.includes(currentVal) && currentVal!=='other'){
    // giữ nguyên nhưng vẫn hiển thị
    const opt = document.createElement('option');
    opt.value=currentVal; opt.textContent=extLabel(currentVal); opt.selected=true;
    els.extFilterEl.appendChild(opt);
  }
}

// Logic: khi "không có gì" thì search ở giữa khung trong, khi "có" thì đưa lên trên
function updateSearchLayout(filtered){
  const hasContent = files.length > 0 && filtered.length > 0;
  const shouldHero = !hasContent;
  if(shouldHero){
    els.searchContainer.classList.remove('docked');
    els.searchContainer.classList.add('hero');
    els.main.classList.add('hero-mode');
  } else {
    els.searchContainer.classList.remove('hero');
    els.searchContainer.classList.add('docked');
    els.main.classList.remove('hero-mode');
  }
  // Cập nhật info
  const extInfo = extFilter!=='all' ? `· Loại: ${extLabel(extFilter)}` : '';
  if(filtered.length===0 && files.length===0){
    els.info.textContent = 'Chưa có file nào — hãy thêm file đầu tiên';
  } else if(filtered.length===0){
    els.info.textContent = `Không tìm thấy ${searchQ?`"${searchQ}"`:''} ${filter!=='all'?`· ${sourceLabel(filter)}`:''} ${extInfo}`.trim() || 'Không có kết quả';
  } else {
    els.info.textContent = `Hiển thị ${filtered.length} / ${files.length} file ${filter!=='all' ? `· ${sourceLabel(filter)}`:''} ${extInfo} ${searchQ? `· Tìm: "${searchQ}"`:''}`.replace(/\s+/g,' ').trim();
  }
}

function render(){
  const filtered = getFiltered();
  renderCounts();
  renderTypeFilters();
  updateSearchLayout(filtered);
  els.grid.className = view==='grid' ? 'grid' : 'grid list';
  els.grid.innerHTML = '';
  if(filtered.length===0){
    els.empty.classList.remove('hidden');
    // Khi hero thì empty nằm dưới search, khi docked thì empty vẫn hiện nhưng search đã lên trên
    // Ẩn grid
    els.grid.style.display='none';
    return;
  }
  els.empty.classList.add('hidden');
  els.grid.style.display='grid';

  filtered.forEach(f=>{
    const card = document.createElement('div');
    card.className = `card ${view}`;
    const tagsHtml = (f.tags||[]).map(t=> `<span class="tag">#${t}</span>`).join('');
    const ext = getExt(f.name);
    // Đánh dấu demo ô số 4 (id 3) để dễ bỏ khi production
    const isDemo = f.id==='3';
    card.innerHTML = `
      <div class="card-head">
        <div class="icon ${f.type}">${iconFor(f.type)}</div>
        <div style="flex:1;min-width:0">
          <div class="card-title" title="${f.name}">${f.name} ${isDemo && KEEP_DEMO ? '<span style="font-size:10px;background:#5b6cff;color:white;padding:2px 6px;border-radius:10px;margin-left:6px;vertical-align:middle">DEMO</span>':''}</div>
          <div class="card-meta">
            <span class="badge ${badgeClass(f.source)}">${sourceLabel(f.source)}</span>
            <span class="badge" style="background:rgba(154,160,181,.1);color:var(--muted);border-color:var(--border)">${extLabel(ext)}</span>
            <span>${f.size || ''}</span>
            <span>• ${f.date}</span>
          </div>
        </div>
      </div>
      <div class="link-row">🔗 <a href="${f.link}" target="_blank" rel="noopener">Mở link</a> <span style="opacity:.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${f.link}</span></div>
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
      <div class="card-actions">
        <button onclick="copyLink('${f.link}')">📋 Copy</button>
        <button onclick="editFile('${f.id}')">✏️ Sửa</button>
        <button class="danger" onclick="confirmDelete('${f.id}')">🗑 Xóa</button>
      </div>
    `;
    els.grid.appendChild(card);
  });
}

window.copyLink = async (link)=>{
  try{ await navigator.clipboard.writeText(link); toast('Đã copy link!'); }
  catch{ prompt('Copy link:', link); }
};
window.confirmDelete = (id)=>{
  if(confirm('Xóa file này?')) deleteFile(id);
};
window.editFile = (id)=>{
  const f = files.find(x=> x.id===id);
  if(!f) return;
  openModal(f);
};

function openModal(data=null){
  els.modal.classList.remove('hidden');
  if(data){
    document.getElementById('modal-title').textContent = 'Chỉnh sửa file';
    document.getElementById('f-id').value = data.id;
    document.getElementById('f-name').value = data.name;
    document.getElementById('f-source').value = data.source;
    document.getElementById('f-type').value = data.type || 'other';
    document.getElementById('f-link').value = data.link;
    document.getElementById('f-size').value = data.size || '';
    document.getElementById('f-date').value = data.date || '';
    document.getElementById('f-tags').value = (data.tags||[]).join(', ');
  } else {
    document.getElementById('modal-title').textContent = 'Thêm file mới';
    els.form.reset();
    document.getElementById('f-id').value = '';
    document.getElementById('f-date').valueAsDate = new Date();
    document.getElementById('f-source').value = 'telegram';
    document.getElementById('f-type').value = 'video';
  }
}
function closeModal(){ els.modal.classList.add('hidden'); }

const btnAdd = document.getElementById('btn-add');
if(btnAdd) btnAdd.addEventListener('click', ()=> openModal());
const btnAddHeader = document.getElementById('btn-add-header');
if(btnAddHeader) btnAddHeader.addEventListener('click', ()=> openModal());
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);

els.form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const payload = {
    name: document.getElementById('f-name').value.trim(),
    source: document.getElementById('f-source').value,
    type: document.getElementById('f-type').value,
    link: document.getElementById('f-link').value.trim(),
    size: document.getElementById('f-size').value.trim() || 'Không rõ',
    date: document.getElementById('f-date').value || new Date().toISOString().slice(0,10),
    tags: document.getElementById('f-tags').value.trim()
  };
  if(!payload.name || !payload.link) return toast('Thiếu tên hoặc link', 'error');
  const id = document.getElementById('f-id').value;
  if(id){
    await updateFile(id, payload);
    toast('Đã cập nhật!');
  } else {
    await createFile(payload);
    toast('Đã thêm file!');
  }
  closeModal();
  render();
});

els.search.addEventListener('input', (e)=>{ searchQ = e.target.value; render(); });
els.sort.addEventListener('change', (e)=>{ sortBy = e.target.value; render(); });
if(els.extFilterEl) els.extFilterEl.addEventListener('change', (e)=>{ extFilter = e.target.value; render(); });

document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  });
});

document.getElementById('view-grid').addEventListener('click', ()=>{
  view='grid';
  document.getElementById('view-grid').classList.add('active');
  document.getElementById('view-list').classList.remove('active');
  render();
});
document.getElementById('view-list').addEventListener('click', ()=>{
  view='list';
  document.getElementById('view-list').classList.add('active');
  document.getElementById('view-grid').classList.remove('active');
  render();
});

const btnExport = document.getElementById('btn-export');
if(btnExport) btnExport.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(files,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`filehub-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('Đã xuất JSON');
});
// Header user menu: mũi tên xổ xuống -> Tài khoản + Đăng xuất
(function(){
  const menu = document.getElementById('user-menu');
  const trigger = document.getElementById('btn-user-menu');
  const dropdown = document.getElementById('user-dropdown');
  const btnGoAccount = document.getElementById('btn-go-account');
  const btnDropLogout = document.getElementById('btn-dropdown-logout');
  const accountModal = document.getElementById('account-modal');
  const accountClose = document.getElementById('account-close');
  const accountBackdrop = document.getElementById('account-backdrop');
  const btnChangePass = document.getElementById('btn-change-pass');

  function toggle(open){
    if(!menu || !dropdown) return;
    const willOpen = open !== undefined ? open : dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !willOpen);
    menu.classList.toggle('open', willOpen);
  }
  if(trigger) trigger.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });
  document.addEventListener('click', (e)=>{
    if(!menu) return;
    if(!menu.contains(e.target)) toggle(false);
  });
  function openAccount(){
    toggle(false);
    if(accountModal){
      accountModal.classList.remove('hidden');
      updateUserDisplay();
      const u = localStorage.getItem('fh_user')||'admin';
      const inp = document.getElementById('account-username');
      if(inp) inp.value = u;
    }
  }
  function closeAccount(){ if(accountModal) accountModal.classList.add('hidden'); }
  if(btnGoAccount) btnGoAccount.addEventListener('click', openAccount);
  if(accountClose) accountClose.addEventListener('click', closeAccount);
  if(accountBackdrop) accountBackdrop.addEventListener('click', closeAccount);
  // đổi mật khẩu trong cửa sổ tài khoản
  if(btnChangePass) btnChangePass.addEventListener('click', async ()=>{
    const p1 = document.getElementById('account-new-pass');
    const p2 = document.getElementById('account-new-pass2');
    const v1 = p1 ? p1.value : '';
    const v2 = p2 ? p2.value : '';
    if(!v1 || v1.length < 3){ return toast('Mật khẩu tối thiểu 3 ký tự','error'); }
    if(v1 !== v2){ return toast('Nhập lại không khớp','error'); }
    const user = localStorage.getItem('fh_user')||'admin';
    try{
      const r = await fetch('/api/forgot', { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ username:user, newPassword:v1 }) });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error);
      toast('Đổi mật khẩu thành công!'); p1.value=''; p2.value='';
    }catch(ex){ toast(ex.message,'error'); }
  });
  const btnDropLogoutEl = document.getElementById('btn-dropdown-logout');
  if(btnDropLogoutEl) btnDropLogoutEl.addEventListener('click', ()=>{ toggle(false); doLogout(); });
  // đóng bằng Esc
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ toggle(false); closeAccount(); closeModal(); }});
  // compat: nút cũ
  const btnLogoutOld = document.getElementById('btn-logout');
  if(btnLogoutOld) btnLogoutOld.addEventListener('click', doLogout);
  const sideOld = document.getElementById('btn-logout-side');
  if(sideOld) sideOld.addEventListener('click', doLogout);
})();

document.getElementById('btn-clear').addEventListener('click', async ()=>{
  if(!confirm(`Xóa tất cả ${files.length} file? Không thể hoàn tác.`)) return;
  for(const f of [...files]){
    try{ await fetch(`${API}/${f.id}`, {method:'DELETE', credentials:'include', headers: authHeaders()});}catch{}
  }
  files = [];
  saveLS();
  try{ localStorage.removeItem(LS_KEY); }catch{}
  render();
  toast('Đã xóa tất cả');
});

// 1 Khung trái thu/mở, 2 khung phải căn giữa ngang tự thu phóng đã xử lý CSS clamp
(function(){
  const app = document.querySelector('.app');
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('btn-toggle-sidebar');
  const KEY = 'fh_sidebar_collapsed';
  function apply(collapsed){
    if(!app || !sidebar) return;
    app.classList.toggle('sidebar-collapsed', collapsed);
    sidebar.classList.toggle('collapsed', collapsed);
    if(btn) btn.textContent = collapsed ? '☰' : '✕';
    if(btn) btn.title = collapsed ? 'Mở menu' : 'Thu menu';
    localStorage.setItem(KEY, collapsed ? '1' : '0');
  }
  const saved = localStorage.getItem(KEY) === '1';
  apply(saved);
  if(btn) btn.addEventListener('click', ()=>{
    const isCollapsed = sidebar.classList.contains('collapsed');
    apply(!isCollapsed);
  });
})();

fetchFiles();
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape') closeModal();
});
