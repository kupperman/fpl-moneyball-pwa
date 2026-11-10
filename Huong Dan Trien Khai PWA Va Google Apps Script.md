# HƯỚNG DẪN KIẾN TRÚC & VẬN HÀNH HỆ THỐNG FPL MONEYBALL PWA (LIVE AUTO-SYNC)

> **Hệ thống:** `124+ FANTASY ANALYTICS HUB` (GitHub Pages + GitHub Actions Serverless Auto-Sync)  
> **Live URL:** https://kupperman.github.io/fpl-moneyball-pwa/  
> **Tài liệu gốc quy chuẩn:** [`e:\FPL_2026_27_Project\00_Admin_Rules\Cam Nang Van Hanh Va Luat Giai 124 Plus Va Live PWA Hub.md`](file:///e:/FPL_2026_27_Project/00_Admin_Rules/Cam%20Nang%20Van%20Hanh%20Va%20Luat%20Giai%20124%20Plus%20Va%20Live%20PWA%20Hub.md)

---

## 🛠️ 1. KIẾN TRÚC HỆ THỐNG (0 ĐỒNG SERVER, TỰ ĐỘNG 24/7)

Hệ thống tách biệt hoàn toàn giữa **Giao diện (`index.html`)** và **Dữ liệu (`data.json`)**, loại bỏ hoàn toàn lỗi lệch dữ liệu hoặc hỏng cú pháp khi chỉnh sửa thủ công:

1. **`sync.py` (Bộ Kéo Dữ Liệu Chính Chủ FPL API):**
   * Kết nối trực tiếp tới các endpoint chính thức của Premier League (`bootstrap-static/`, `fixtures/`, `event/{gw}/live/`, `entry/{id}/history/`, `entry/{id}/event/{gw}/picks/`, `leagues-classic/`).
   * Tự động tính toán và xuất ra `data.json`: BXH `124+ | NÁT` (kèm điểm Turn 2 Reset 0-0, Chip đã dùng, Giá trị đội hình, Kỷ lục Turn 1), Đội hình GW gần nhất của cả 7 HLV, 20 CLB Fixture Heatmap, Top 35 cầu thủ, Biến động chuyển nhượng thật (`watchdog`), Dream Team và dữ liệu riêng cho `VIP Vault`.
2. **`.github/workflows/sync.yml` (Tự Động Hóa Cloud):**
   * Chạy định kỳ mỗi **6 tiếng/lần** trên máy chủ GitHub Actions (`cron: '0 */6 * * *'`) hoặc bấm chạy tay bất cứ lúc nào từ GitHub Actions / CLI (`gh workflow run sync.yml`).
   * Tự động commit `data.json` mới và kích hoạt GitHub Pages deploy trong vòng ~30 giây.
3. **`index.html` (Frontend PWA Bloomberg Pro Max):**
   * Luôn tải `./data.json?v=Date.now()` để đảm bảo hiển thị số liệu mới nhất ngay lập tức.
   * **Tab Đấu trường:** Countdown Deadline GW11, 4 Thẻ Kỷ Lục Chặng 1 (*Tuyển Trạch Viên Cao Thủ*, *Chiến Thuật Điểm Kém*, *Chúa Tể Dự Bị*, *Chuyên Gia Đi Chợ*), BXH 2 chế độ (`⚡ Chặng 2 Reset 0-0` vs `🏆 Cả Mùa`), Ma trận Kho Chip 7×4, Quỹ đạo Thứ hạng thực tế 10 vòng (Ninh SS màu **Xanh Samsung `#2563EB`**), và Đấu trường Giả lập Kèo GW11.
   * **Tab Sa bàn 2D (Broadcast Stadium Pitch):** Mặt sân SVG sắc nét, Áo đấu SVG chuẩn màu cả 20 CLB, cho phép soi Dream Team hoặc đội hình GW của từng HLV trong `124+ | NÁT`, Hồ sơ soi cầu thủ khi chạm áo đấu, Biểu đồ Doughnut & Độ phủ CLB.
   * **Tab Market Radar:** Radar 5 trục, So găng tay đôi trực tiếp, Transfer Watchdog thực tế, Captaincy Index, Bảng tìm kiếm & lọc vị trí Top 35 ngôi sao.
   * **Tab Heatmap 20 CLB:** Đầy đủ 20 CLB mùa 2026/27 thực tế (có Coventry, Hull, Sunderland, Leeds) + ngôi sao từng đội.

---

## 🔒 2. BẢO MẬT OPSEC & PHÂN TÁCH VIP VAULT

* **Public View:** Chỉ hiển thị thông tin chung của `124+ | NÁT` và số liệu công khai từ Premier League.
* **VIP Vault (Nút Ổ Khóa góc trên):** Bảo vệ bằng mật mã (`6767` / `tit67` / `canvip`), che giấu hoàn toàn:
  * Bảng xếp hạng giải công ty **`IOC_124` (ID: 155330)**.
  * Ngân sách dư ITB, trạng thái 4 Chip còn lại, đội hình 15 người và chiến lược Chặng 2 của **Cận VIP (ID: 707471)**.

---

## ⚙️ 3. QUY TRÌNH KIỂM ĐỊNH & DEPLOY KHI CHỈNH SỬA CODE

Mỗi khi cập nhật giao diện hoặc logic tính toán:
1. Chạy `python sync.py` để làm mới `data.json`.
2. Chạy script kiểm định bắt buộc:
   ```powershell
   node e:\FPL_2026_27_Project\07_Automation_Scripts\utility_scripts\verify_pwa.js
   ```
   *(Phải pass: JS Syntax Check, All 20 clubs x 5 GWs valid, Zero-Hallucination Check).*
3. Đồng bộ trước khi đẩy code lên GitHub Pages (tránh đụng commit từ bot GitHub Actions):
   ```powershell
   git add -A
   git commit -m "Mô tả thay đổi"
   git pull --rebase origin master
   git push origin master
   ```
