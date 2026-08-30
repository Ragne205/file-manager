# HƯỚNG DẪN DEPLOY WEB LÊN SERVER

## 1. Chuẩn bị trước khi deploy

```bash
cd file-manager
npm install
# Kiểm tra chạy local ok
npm start  # http://localhost:3000
# Login: admin / admin123
```

**Việc sẽ tự ẩn khi deploy:**
- Hộp `Mặc định: admin / admin123` ở login (`login.html:131` tự ẩn khi `hostname != localhost`)
- File demo ô số 4 (`app.js:KEEP_DEMO` tự `false` khi không phải localhost) — không cần xóa tay
- Nếu muốn ép ẩn ngay cả local: đổi `KEEP_DEMO=false` trong `public/app.js`

**Đổi mật khẩu trước khi deploy:**
- Cách 1: Biến môi trường `ADMIN_USER` / `ADMIN_PASS` (khuyến nghị)
- Cách 2: Sau khi deploy, đăng nhập → dropdown avatar ▾ → **Tài khoản** → Đổi mật khẩu (sẽ lưu vào `users.json`)

---

## 2. Chọn nền tảng

### A. Render.com (free, dễ nhất, có lưu file)
1. Đẩy code lên GitHub: `file-manager/` phải là root repo hoặc set Root Directory = `file-manager`
2. Tại https://dashboard.render.com → New → Web Service → Connect repo
3. Build Command: `npm install`
   Start Command: `node server.js`
4. Env Vars:
   ```
   NODE_ENV=production
   ADMIN_USER=admin
   ADMIN_PASS=mat_khau_manh_cua_ban
   ```
5. Deploy → sẽ có URL `https://filehub-xxxx.onrender.com`

> Lưu ý: Render free có disk ephemeral, `db.json`/`users.json` sẽ mất khi redeploy. Cần gắn **Persistent Disk** hoặc đổi sang DB ngoài nếu cần lưu lâu.

### B. VPS / Ubuntu (khuyên dùng cho lưu file lâu dài)
```bash
# Trên VPS
git clone <repo> && cd file-manager
npm ci --only=production

# Dùng PM2 để chạy 24/7
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # copy lệnh nó in ra để tự chạy khi reboot

# Nginx reverse proxy
sudo nano /etc/nginx/sites-available/filehub
```
```nginx
server {
  listen 80;
  server_name yourdomain.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/filehub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# SSL miễn phí
sudo certbot --nginx -d yourdomain.com
```

### C. Docker (chạy ở bất kỳ server nào)
```bash
cd file-manager
docker build -t filehub .
docker run -d -p 3000:3000 \
  -e ADMIN_USER=admin -e ADMIN_PASS=mat_khau_manh \
  -v filehub_data:/app \
  --name filehub filehub

# hoặc docker-compose
```
Truy cập `http://server-ip:3000`

### D. Vercel (serverless, nhanh nhưng lưu file tạm)
```bash
npm i -g vercel
cd file-manager
vercel --prod
# Set env trên Vercel Dashboard: ADMIN_USER, ADMIN_PASS, NODE_ENV=production
```
Đã có `vercel.json` sẵn, `server.js` đã `module.exports = app` để chạy serverless.
> Lưu ý: `db.json`/`users.json` trên Vercel sẽ reset mỗi lần deploy (filesystem tạm). Chỉ dùng để demo, muốn lưu lâu hãy đổi sang Vercel KV / Postgres.

---

## 3. Biến môi trường

Tạo file `.env` từ `.env.example`:
```
NODE_ENV=production
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=mat_khau_manh
```

---

## 4. Checklist trước khi public

- [ ] Đổi `ADMIN_PASS` mạnh, không để `admin123`
- [ ] Test `POST /api/register` và `POST /api/forgot` chạy ok
- [ ] Xóa file demo nếu cần: `KEEP_DEMO=false` hoặc xóa record id `3` trong `db.json`
- [ ] Đặt `protectFiles=true` trong `server.js:208` nếu muốn bắt buộc đăng nhập mới gọi API
- [ ] Kiểm tra `login.html` đã tự ẩn hint khi không phải localhost
- [ ] Đẩy code, kiểm tra `https://yourdomain.com/login.html` → đăng nhập được

## 5. Cập nhật sau deploy

```bash
git add .
git commit -m "deploy"
git push
# Render/Vercel sẽ auto deploy
# VPS: ssh vào và git pull && pm2 restart filehub
```

Cần hỗ trợ thêm (thêm domain, SSL, đổi DB sang Postgres/Supabase) cứ nói.
