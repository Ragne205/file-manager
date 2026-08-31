const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const crypto = require('crypto');

// --- AUTH CONFIG ---
const USERS_PATH = path.join(__dirname, 'users.json');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const sessions = new Map(); // token -> { user, created }

function readUsers(){
  try{
    if(!fs.existsSync(USERS_PATH)){
      const init = [{ username: ADMIN_USER, email: `${ADMIN_USER}@example.com`, password: ADMIN_PASS }];
      fs.writeFileSync(USERS_PATH, JSON.stringify(init, null, 2));
      return init;
    }
    const data = JSON.parse(fs.readFileSync(USERS_PATH,'utf-8'));
    // migrate: thêm email nếu thiếu
    let changed=false;
    data.forEach(u=>{
      if(!u.email){ u.email = `${u.username}@example.com`; changed=true; }
    });
    if(changed) fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
    return data;
  }catch(e){
    console.error('readUsers error', e);
    return [{ username: ADMIN_USER, email: `${ADMIN_USER}@example.com`, password: ADMIN_PASS }];
  }
}
function writeUsers(users){
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}
function findUser(username){
  const users = readUsers();
  return users.find(u=> u.username === username);
}
function findUserByIdentifier(identifier){
  const users = readUsers();
  const low = identifier.toLowerCase();
  return users.find(u=> u.username.toLowerCase()===low || (u.email && u.email.toLowerCase()===low));
}
function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// OTP store: key -> { otp, expires, data }
const otpStore = new Map();
function generateOTP(){ return Math.floor(100000 + Math.random()*900000).toString(); }
function setOTP(key, data){
  const otp = generateOTP();
  otpStore.set(key, { otp, data, expires: Date.now() + 5*60*1000 });
  console.log(`[OTP] ${key} -> ${otp} (demo, sẽ trả về client)`);
  return otp;
}
function verifyOTP(key, otp){
  const rec = otpStore.get(key);
  if(!rec) return { ok:false, error:'Chưa gửi OTP hoặc OTP hết hạn, hãy bấm Gửi OTP lại' };
  if(Date.now() > rec.expires){ otpStore.delete(key); return { ok:false, error:'OTP đã hết hạn (5 phút), hãy gửi lại' }; }
  if(rec.otp !== String(otp).trim()) return { ok:false, error:'OTP không đúng' };
  otpStore.delete(key);
  return { ok:true, data: rec.data };
}
// dọn rác mỗi 5 phút
setInterval(()=>{ for(const [k,v] of otpStore) if(Date.now()>v.expires) otpStore.delete(k); }, 5*60*1000);

function parseCookies(req){
  const h = req.headers.cookie || '';
  const out = {};
  h.split(';').forEach(p=>{
    const [k,...v] = p.trim().split('=');
    if(k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}
function getToken(req){
  const c = parseCookies(req);
  if(c.token && sessions.has(c.token)) return c.token;
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if(m && sessions.has(m[1])) return m[1];
  return null;
}
function requireAuth(req,res,next){
  const tok = getToken(req);
  if(!tok) return res.status(401).json({ error: 'Chưa đăng nhập' });
  req.user = sessions.get(tok).user;
  next();
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper: format bytes ---
function formatBytes(bytes){
  if(!bytes || isNaN(bytes) || bytes<=0) return 'Không rõ';
  const u=['B','KB','MB','GB','TB'];
  let i=0; let n=Number(bytes);
  while(n>=1024 && i<u.length-1){ n/=1024; i++; }
  return (i===0? n : n.toFixed(n>=10?1:2)) + ' ' + u[i];
}

// --- DB helpers ---
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    console.error('DB read error', e);
    return getInitialData();
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function getInitialData() {
  return [
    {
      id: "1",
      name: "Video huong dan AE 2024.mp4",
      source: "telegram",
      size: "1.2 GB",
      sizeBytes: 1288490188,
      link: "https://t.me/c/123456/789",
      date: "2026-08-28",
      type: "video",
      tags: ["after-effects", "tutorial"]
    },
    {
      id: "2",
      name: "Project Animate - Nhan vat.zip",
      source: "google-drive",
      size: "856 MB",
      sizeBytes: 897581056,
      link: "https://drive.google.com/file/d/1abcXYZ/view",
      date: "2026-08-25",
      type: "archive",
      tags: ["animate", "character"]
    },
    {
      id: "3",
      name: "Bo stock footage 4K.rar",
      source: "terabox",
      size: "4.5 GB",
      sizeBytes: 4831838208,
      link: "https://1024terabox.com/s/1xyz123",
      date: "2026-08-20",
      type: "archive",
      tags: ["stock", "4k"]
    },
    {
      id: "4",
      name: "Tai lieu API Telegram Bot.pdf",
      source: "telegram",
      size: "3.2 MB",
      sizeBytes: 3355443,
      link: "https://t.me/c/123456/790",
      date: "2026-08-29",
      type: "document",
      tags: ["telegram", "api"]
    },
    {
      id: "5",
      name: "Backup Drive thang 8",
      source: "google-drive",
      size: "12 GB",
      sizeBytes: 12884901888,
      link: "https://drive.google.com/drive/folders/1folderABC",
      date: "2026-08-15",
      type: "folder",
      tags: ["backup"]
    }
  ];
}

// --- AUTH API (OTP) ---
// Đăng ký: bước 1 gửi OTP về email
app.post('/api/register/send-otp', (req, res) => {
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.status(400).json({ error: 'Thiếu username, email hoặc mật khẩu' });
  if(username.length < 3) return res.status(400).json({ error: 'Tài khoản tối thiểu 3 ký tự' });
  if(!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
  if(password.length < 3) return res.status(400).json({ error: 'Mật khẩu tối thiểu 3 ký tự' });
  const users = readUsers();
  if(users.find(u=> u.username.toLowerCase()===username.toLowerCase())) return res.status(400).json({ error: 'Tài khoản đã tồn tại' });
  if(users.find(u=> u.email && u.email.toLowerCase()===email.toLowerCase())) return res.status(400).json({ error: 'Email đã được dùng' });
  const otp = setOTP(`register:${email.toLowerCase()}`, { username: username.trim(), email: email.trim().toLowerCase(), password });
  // demo: trả luôn OTP để test (khi deploy thật sẽ gửi mail)
  return res.json({ success: true, message: `OTP đã gửi đến ${email} (demo)`, otp, demoHint: `Demo: OTP là ${otp} - sẽ gửi qua email khi deploy thật` });
});
// Đăng ký: bước 2 xác thực OTP
app.post('/api/register/verify', (req, res) => {
  const { email, otp } = req.body;
  if(!email || !otp) return res.status(400).json({ error: 'Thiếu email hoặc OTP' });
  const v = verifyOTP(`register:${email.toLowerCase()}`, otp);
  if(!v.ok) return res.status(400).json({ error: v.error });
  const { username, password } = v.data;
  const users = readUsers();
  if(users.find(u=> u.username.toLowerCase()===username.toLowerCase())) return res.status(400).json({ error: 'Tài khoản đã tồn tại (vừa có người đăng ký)' });
  users.push({ username, email: email.toLowerCase(), password });
  writeUsers(users);
  return res.json({ success: true, message: 'Tạo tài khoản thành công! Hãy đăng nhập' });
});
// Giữ endpoint cũ cho tương thích (không yêu cầu OTP) - nhưng khuyên dùng OTP
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  // nếu có email thì dùng luồng mới, nếu không thì cho qua cũ để tránh break
  if(email){
    if(!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
  }
  if(!username || !password) return res.status(400).json({ error: 'Thiếu tài khoản hoặc mật khẩu' });
  if(username.length < 3) return res.status(400).json({ error: 'Tài khoản tối thiểu 3 ký tự' });
  if(password.length < 3) return res.status(400).json({ error: 'Mật khẩu tối thiểu 3 ký tự' });
  const users = readUsers();
  if(users.find(u=> u.username.toLowerCase()===username.toLowerCase())){
    return res.status(400).json({ error: 'Tài khoản đã tồn tại' });
  }
  users.push({ username: username.trim(), email: email ? email.trim().toLowerCase() : `${username}@example.com`, password });
  writeUsers(users);
  return res.json({ success: true, message: 'Tạo tài khoản thành công' });
});

// Quên mật khẩu: bước 1 gửi OTP theo username hoặc email
app.post('/api/forgot/send-otp', (req, res) => {
  const { identifier } = req.body; // username hoặc email
  if(!identifier) return res.status(400).json({ error: 'Thiếu tài khoản hoặc email' });
  const user = findUserByIdentifier(identifier);
  if(!user) return res.status(404).json({ error: 'Tài khoản / email không tồn tại' });
  const key = `forgot:${user.username.toLowerCase()}`;
  const otp = setOTP(key, { username: user.username });
  return res.json({ success: true, message: `OTP đã gửi đến email ${user.email} (demo)`, otp, demoHint: `Demo: OTP là ${otp}`, email: user.email });
});
// Quên mật khẩu: bước 2 xác thực OTP + đặt mật khẩu mới
app.post('/api/forgot/verify', (req, res) => {
  const { identifier, otp, newPassword } = req.body;
  if(!identifier || !otp || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
  if(newPassword.length < 3) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 3 ký tự' });
  const user = findUserByIdentifier(identifier);
  if(!user) return res.status(404).json({ error: 'Tài khoản không tồn tại' });
  const key = `forgot:${user.username.toLowerCase()}`;
  const v = verifyOTP(key, otp);
  if(!v.ok) return res.status(400).json({ error: v.error });
  const users = readUsers();
  const u = users.find(x=> x.username.toLowerCase()===user.username.toLowerCase());
  u.password = newPassword;
  writeUsers(users);
  for(const [tok, sess] of sessions) if(sess.user.toLowerCase()===user.username.toLowerCase()) sessions.delete(tok);
  return res.json({ success: true, message: 'Đặt lại mật khẩu thành công! Hãy đăng nhập' });
});
// Giữ endpoint cũ /api/forgot cho tương thích
app.post('/api/forgot', (req, res) => {
  const { username, newPassword, identifier } = req.body;
  const id = identifier || username;
  if(!id || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
  if(newPassword.length < 3) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 3 ký tự' });
  const users = readUsers();
  const u = findUserByIdentifier(id);
  if(!u) return res.status(404).json({ error: 'Tài khoản không tồn tại' });
  const target = users.find(x=> x.username.toLowerCase()===u.username.toLowerCase());
  target.password = newPassword;
  writeUsers(users);
  for(const [tok, sess] of sessions) if(sess.user.toLowerCase()===u.username.toLowerCase()) sessions.delete(tok);
  return res.json({ success: true, message: 'Đặt lại mật khẩu thành công' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body; // username có thể là email
  const identifier = (username||'').trim();
  const user = findUserByIdentifier(identifier) || findUser(identifier);
  const valid = user ? (user.password === password) : (identifier === ADMIN_USER && password === ADMIN_PASS) || (identifier.toLowerCase() === `${ADMIN_USER}@example.com` && password === ADMIN_PASS);
  const loginName = user ? user.username : identifier;
  if(valid){
    if(!user && identifier === ADMIN_USER){
      const users = readUsers();
      if(!users.find(u=> u.username===identifier)) { users.push({ username: identifier, email: `${identifier}@example.com`, password }); writeUsers(users); }
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { user: loginName, created: Date.now() });
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*3600}`);
    return res.json({ success: true, token, user: loginName });
  }
  return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
});

app.post('/api/logout', (req, res) => {
  const tok = getToken(req);
  if(tok) sessions.delete(tok);
  res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const tok = getToken(req);
  if(!tok) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, user: sessions.get(tok).user });
});

// --- API: tự check dung lượng từ link ---
app.get('/api/check-size', async (req, res) => {
  const url = (req.query.url||'').trim();
  if(!url) return res.status(400).json({ error: 'Thiếu url' });
  try{ new URL(url); }catch{ return res.status(400).json({ error: 'URL không hợp lệ' }); }
  // whitelist sơ bộ để tránh SSRF nội bộ
  if(url.startsWith('http://127.')||url.startsWith('http://localhost')||url.includes('169.254.')) return res.status(400).json({ error: 'URL không được phép' });

  // thử biến thể Google Drive: /file/d/<id>/view -> uc?export=download&id=<id>
  let candidates = [url];
  const mDrive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if(mDrive) candidates.unshift(`https://drive.google.com/uc?export=download&id=${mDrive[1]}`);
  const mDrive2 = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if(mDrive2 && !mDrive) candidates.unshift(`https://drive.google.com/uc?export=download&id=${mDrive2[1]}`);

  let sizeBytes = null;
  let contentType = null;
  for(const cand of candidates){
    try{
      const ctrl = new AbortController();
      const t = setTimeout(()=> ctrl.abort(), 7000);
      const head = await fetch(cand, { method:'HEAD', redirect:'follow', signal: ctrl.signal, headers:{ 'User-Agent':'FileHub/1.0' } });
      clearTimeout(t);
      contentType = head.headers.get('content-type');
      const cl = head.headers.get('content-length');
      if(cl){ const n=parseInt(cl,10); if(!isNaN(n) && n>0) { sizeBytes=n; break; } }
      // nếu không có content-length thử content-range qua GET range
      if(!sizeBytes){
        const ctrl2 = new AbortController();
        const t2 = setTimeout(()=> ctrl2.abort(), 7000);
        const get = await fetch(cand, { method:'GET', redirect:'follow', signal: ctrl2.signal, headers:{ 'User-Agent':'FileHub/1.0', 'Range':'bytes=0-0' } });
        clearTimeout(t2);
        contentType = contentType || get.headers.get('content-type');
        const cr = get.headers.get('content-range');
        if(cr){ const mm = cr.match(/\/(\d+)$/); if(mm){ const n=parseInt(mm[1],10); if(!isNaN(n)&&n>0){ sizeBytes=n; break; } } }
        const cl2 = get.headers.get('content-length');
        if(cl2){ const n=parseInt(cl2,10); if(!isNaN(n)&&n>0){ sizeBytes=n; break; } }
      }
    }catch(e){ /* thử candidate tiếp */ }
  }

  if(!sizeBytes){
    return res.json({ size: null, sizeBytes: 0, sizeFormatted: 'Không rõ', contentType: contentType || null, checked: true });
  }
  return res.json({ sizeBytes, size: formatBytes(sizeBytes), sizeFormatted: formatBytes(sizeBytes), contentType, checked: true });
});

// Bảo vệ API files - bỏ comment dòng dưới nếu muốn bắt buộc đăng nhập mới xem được file
// Hiện tại để mở, chỉ cần login để vào web; API vẫn cho qua nếu chưa login để tránh lỗi khi test
// Nếu muốn khóa API, đổi thành app.use('/api/files', requireAuth);
const protectFiles = false; // đổi true để bắt buộc login mới gọi được /api/files

// --- API FILES ---
app.get('/api/files', (req, res) => {
  if(protectFiles && !getToken(req)) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const files = readDB();
  res.json(files);
});

app.post('/api/files', (req, res) => {
  if(protectFiles && !getToken(req)) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const files = readDB();
  const { name, source, link, size, type, tags } = req.body;
  if (!name || !source || !link) {
    return res.status(400).json({ error: 'Thiếu name, source hoặc link' });
  }
  const newFile = {
    id: Date.now().toString(),
    name: name.trim(),
    source,
    link: link.trim(),
    size: size || "Không rõ",
    sizeBytes: 0,
    date: new Date().toISOString().slice(0, 10),
    type: type || "other",
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(s=>s.trim()).filter(Boolean)) : []
  };
  files.unshift(newFile);
  writeDB(files);
  res.status(201).json(newFile);
});

app.put('/api/files/:id', (req, res) => {
  if(protectFiles && !getToken(req)) return res.status(401).json({ error: 'Chưa đăng nhập' });
  let files = readDB();
  const idx = files.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy file' });
  files[idx] = { ...files[idx], ...req.body, id: files[idx].id };
  // normalize tags if string
  if (typeof files[idx].tags === 'string') {
    files[idx].tags = files[idx].tags.split(',').map(s=>s.trim()).filter(Boolean);
  }
  writeDB(files);
  res.json(files[idx]);
});

app.delete('/api/files/:id', (req, res) => {
  if(protectFiles && !getToken(req)) return res.status(401).json({ error: 'Chưa đăng nhập' });
  let files = readDB();
  const before = files.length;
  files = files.filter(f => f.id !== req.params.id);
  if (files.length === before) return res.status(404).json({ error: 'Không tìm thấy' });
  writeDB(files);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const files = readDB();
  const stats = {
    total: files.length,
    bySource: {
      telegram: files.filter(f => f.source === 'telegram').length,
      'google-drive': files.filter(f => f.source === 'google-drive').length,
      terabox: files.filter(f => f.source === 'terabox').length,
    },
    byType: {}
  };
  files.forEach(f => {
    stats.byType[f.type] = (stats.byType[f.type] || 0) + 1;
  });
  res.json(stats);
});

// SPA fallback (không chặn /api và /login.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

// Chỉ listen khi chạy trực tiếp (không phải import từ Vercel/serverless)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`✅ File Manager đang chạy tại http://localhost:${PORT} [${process.env.NODE_ENV||'development'}]`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = PORT + 1;
      console.warn(`⚠️  Cổng ${PORT} đang bận (EADDRINUSE). Tự động thử cổng ${nextPort}...`);
      console.warn(`   Cách fix thủ công: chạy 'npx kill-port ${PORT}' hoặc 'set PORT=3001 && npm start'`);
      server.listen(nextPort);
    } else {
      console.error('Server error:', err);
    }
  });
}
