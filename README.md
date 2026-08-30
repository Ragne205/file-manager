# FileHub — Quản lý file đa nguồn (Telegram / Google Drive / Terabox)

Web cơ bản giúp bạn quản lý tập trung các file đang rải rác ở nhiều nơi.

## Tính năng
- **Thêm / Sửa / Xóa** file với: tên, nguồn (Telegram / Drive / Terabox), link, dung lượng, ngày, loại, tags
- **Lọc** theo nguồn (sidebar), **tìm kiếm** theo tên/tag/link, **sắp xếp** (mới nhất, tên, nguồn)
- **Thống kê**: tổng file + biểu đồ % theo nguồn, badge đếm từng nguồn
- **Grid / List view**, copy link 1 click, mở link trực tiếp
- **Xuất JSON** backup và xóa tất cả
- **Lưu trữ**: `db.json` trên server (Express) + fallback `localStorage` khi offline
- Giao diện dark, responsive, tiếng Việt

## Chạy nhanh
```bash
cd file-manager
npm install
npm start
# mở http://localhost:3000
```

Không cần backend vẫn chạy được: chỉ cần mở `public/index.html` bằng Live Server — app sẽ tự dùng `localStorage`.

## API
- `GET /api/files` — danh sách
- `POST /api/files` — tạo `{name, source, link, size, type, tags}`
- `PUT /api/files/:id` — cập nhật
- `DELETE /api/files/:id` — xóa
- `GET /api/stats` — thống kê

Dữ liệu mẫu nằm ở `getInitialData()` trong `server.js` và tự tạo `db.json` lần đầu.

## Tích hợp thật sau này
Thay `POST /api/files` bằng logic gọi:
- **Telegram**: Bot API `getFile` + lưu `file_id` -> `https://api.telegram.org/file/bot<token>/<path>`
- **Google Drive**: OAuth2 + Drive API `files.list` / `files.get`
- **Terabox**: unofficial API hoặc crawl link chia sẻ (cần token/cookie)

Frontend đã chừa sẵn field `link` + `source` để bạn map thẳng.

## Cấu trúc
```
file-manager/
  server.js      # Express + API + serve static
  db.json        # auto tạo
  package.json
  public/
    index.html
    style.css
    app.js
```

## Gợi ý mở rộng
- Thêm đăng nhập
- Preview ảnh/video
- Đồng bộ tự động qua cron gọi API các nguồn
- Thêm cột "trạng thái" (còn sống / link die) với job check link định kỳ
