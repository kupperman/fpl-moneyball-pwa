# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG MONEYBALL FPL PWA VÀ GOOGLE APPS SCRIPT

> **Mục tiêu:** Xây dựng ứng dụng web cá nhân PWA (Progressive Web App) hiển thị toàn bộ số liệu FPL (Radar Tiền Vệ, Bảng Xếp Hạng Mini-League 124+ Nát & IOC, Kế Hoạch Chuyển Nhượng) hoàn toàn miễn phí (0 đồng server, 0 đồng domain), truy cập siêu tốc trên điện thoại và máy tính.

---

## 🛠️ BƯỚC 1: TRIỂN KHAI BACKEND SERVERLESS TRÊN GOOGLE APPS SCRIPT (GAS)

1. Truy cập vào [Google Apps Script](https://script.google.com/home).
2. Nhấn nút **New project** (Dự án mới) và đổi tên dự án thành: `FPL Moneyball Engine`.
3. Mở file mã nguồn:
   - File trên máy: [`e:\FPL_2026_27_Project\web_dashboard\fpl_pwa\Google Apps Script Code.js`](file:///e:/FPL_2026_27_Project/web_dashboard/fpl_pwa/Google%20Apps%20Script%20Code.js).
   - Copy toàn bộ nội dung dán đè vào file `Code.gs` trên trình duyệt.
4. Nhấn **Deploy** (Triển khai) góc trên bên phải -> chọn **New deployment** (Tùy chọn triển khai mới):
   - **Select type** (Chọn loại): Nhấn biểu tượng bánh răng ⚙️ -> Chọn **Web app**.
   - **Description**: `FPL Production API v1`.
   - **Execute as** (Thực thi dưới dạng): `Me (địa chỉ email của bạn)`.
   - **Who has access** (Ai có quyền truy cập): Chọn **Anyone** (Bất kỳ ai).
5. Nhấn **Deploy**. Google sẽ yêu cầu ủy quyền quyền truy cập (Authorize Access) lần đầu -> Chọn tài khoản Google của bạn -> Nhấn *Advanced* (Nâng cao) -> *Go to FPL Moneyball Engine (unsafe)* -> Nhấn *Allow*.
6. Sau khi xong, copy chuỗi **Web App URL** (có đuôi kết thúc bằng `/exec`).

---

## 📱 BƯỚC 2: CÁCH CHẠY VÀ SỬ DỤNG FRONTEND PWA

Frontend đã được dựng hoàn chỉnh tại thư mục:
[`e:\FPL_2026_27_Project\web_dashboard\fpl_pwa`](file:///e:/FPL_2026_27_Project/web_dashboard/fpl_pwa)

### Cách 1: Chạy Thử Ngay Trên Máy Tính (Local)
- Mở trực tiếp file [`index.html`](file:///e:/FPL_2026_27_Project/web_dashboard/fpl_pwa/index.html) bằng trình duyệt Google Chrome hoặc Edge.
- Bấm vào nút **Nguồn API** (góc trên bên phải), dán link `/exec` từ Bước 1 vào rồi bấm **Lưu URL**.
- Bấm **Làm mới**: Dữ liệu Live từ FPL sẽ lập tức đổ về!

### Cách 2: Đưa Lên Mạng Miễn Phí (Cloudflare Pages / GitHub Pages / Vercel)
Để truy cập được từ điện thoại ở bất kỳ đâu ngoài đường hoặc cơ quan:
1. Tạo 1 tài khoản miễn phí tại [Cloudflare Pages](https://pages.cloudflare.com/) hoặc GitHub Pages.
2. Kéo thả thư mục `e:\FPL_2026_27_Project\web_dashboard\fpl_pwa` lên.
3. Trong vòng 10 giây, Cloudflare sẽ cấp cho bạn một đường link HTTPS siêu tốc (ví dụ: `https://fpl-canvip.pages.dev`).
4. Mở link trên điện thoại (Safari hoặc Chrome):
   - **Trên iPhone:** Bấm nút Chia sẻ (Share) -> Chọn **Thêm vào MH chính (Add to Home Screen)**.
   - **Trên Android:** Bấm menu 3 chấm -> Chọn **Cài đặt ứng dụng / Thêm vào màn hình chính**.
   - Ngay lập tức trên màn hình điện thoại sẽ xuất hiện icon FPL Moneyball, mở lên full màn hình như 1 app tải từ App Store mà không tốn 1 xu chi phí!

### Cách 3: Nhúng Vào Google Sites (Nếu Vẫn Muốn Có 1 Trang Google Sites Cá Nhân)
1. Mở trang Google Sites của bạn.
2. Chọn công cụ **Nhúng (Embed)** -> Chọn tab **Theo URL**.
3. Dán đường link Cloudflare Pages (hoặc link trực tiếp) vào -> Chọn chế độ hiển thị toàn trang.

---

## 📊 CÁC TÍNH NĂNG ĐÃ SỐ LIỆU HÓA TRÊN APP
- **Radar Tiền Vệ (Midfielders Scanner):** So sánh trực quan dạng biểu đồ mạng nhện giữa bất kỳ 2 tiền vệ nào (xGI/90, Form, ICT, Điểm/Triệu bảng) — giải quyết dứt điểm nỗi lo chọn nhầm tiền vệ xịt.
- **Phòng Tác Chiến 124+ Nát:** Theo dõi sát sao cuộc đua vô địch (Cận VIP bám đuổi Bao Bui 8 điểm) và cuộc chiến trụ hạng tránh "móc túi nộp phạt" của Cường Tệ & Ngọc Dao.
- **Quản Trị Kho Chip:** Đếm ngược 9 vòng tới hạn chót GW19 cho 4 chip đợt 1 (Wildcard, Triple Captain, Bench Boost, Free Hit).
