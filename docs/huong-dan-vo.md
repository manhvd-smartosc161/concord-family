# Hướng dẫn dùng Concord — cho vợ

Concord là app vợ chồng mình tự host để cùng quản lý tiền: chi tiêu, tiết kiệm, mục tiêu chung. Có 1 con AI (Claude) để em chỉ cần gõ tự nhiên kiểu *"hôm nay đi chợ 350k"* là nó tự ghi vào sổ.

App có **3 quỹ**:
- **Quỹ Vợ** — của riêng em, chồng không thấy số dư + không thấy giao dịch.
- **Quỹ Chồng** — của riêng chồng, em cũng không thấy.
- **Quỹ Chung** — cả 2 vợ chồng cùng thấy + cùng ghi.

Privacy này là cố định (mã hoá ở backend, không lụy được). Nên em yên tâm log mọi chi tiêu cá nhân trong **Quỹ Vợ**.

---

## Lần đầu dùng — 3 bước setup (~10 phút)

### Bước 1. Đăng nhập

Mở `http://localhost:3000` (hoặc địa chỉ chồng đã setup). Nhập:

- **Email**: `wife@concord.local`
- **Mật khẩu**: `concord-wife`

→ Vào thẳng **Dashboard**.

### Bước 2. Đổi mật khẩu (làm ngay)

Vào tab **⚙️ Cài đặt** ở sidebar trái → khối **Tài khoản** → bấm **🔐 Đổi mật khẩu**.

- Mật khẩu cũ: `concord-wife` (default)
- Mật khẩu mới: tự đặt, nhớ kỹ

### Bước 3. Nhập số dư khởi điểm các quỹ

Đây là số tiền **đang có sẵn ở thời điểm bắt đầu xài Concord** — gom từ ví ngân hàng + ví Shopee + tiền mặt + bất cứ ví/tài khoản nào em coi là "Quỹ của em".

Vào **⚙️ Cài đặt** → khối **Số dư khởi điểm**. Em sẽ thấy list các quỹ em truy cập được:

- **Quỹ Vợ**: nhập tổng tiền em đang có (vd: nếu Vietcombank có 12tr + Momo 800k + tiền mặt 500k → nhập **`13300000`** = 13,3 triệu)
- **Quỹ Chung**: nhập tổng tiền 2 vợ chồng đang để chung (nếu có account riêng cho việc gia đình thì lấy số đó). Nếu chưa có quỹ chung riêng, để **0** rồi sau bàn với chồng để ra số.
- **Quỹ tiết kiệm/đầu tư** (Du lịch, Chứng khoán, …): nếu sau này em tạo quỹ mục tiêu (xem mục tiếp theo), chúng cũng sẽ hiện ở đây để em nhập số tiền đã để dành sẵn trước khi xài Concord (vd đã có sẵn 5tr cho Quỹ Du lịch).

Em **không cần** nhập Quỹ Chồng — chồng tự nhập của chồng.

> 💡 **Lưu ý**: nhập **số nguyên VND**, không phẩy thập phân. 13,3 triệu = `13300000` (8 số 0 cộng lại). Đừng nhập `13.300.000` — nó hiểu là 13 phẩy 3.

Số này được ghi như 1 entry cấu trúc, **không hiện trong "Giao dịch gần đây"** và **không tính vào báo cáo thu/chi tháng** — coi như là "vạch xuất phát".

---

## Setup mục tiêu (optional, nhưng nên làm)

### Mục tiêu tiết kiệm năm

Vào **⚙️ Cài đặt** → khối **Mục tiêu tiết kiệm năm 2026** → nhập số tiền 2 vợ chồng muốn để dành cùng nhau **trong cả năm**.

Có 3 preset nhanh: 100tr / 150tr / 200tr. Hoặc tự gõ số.

> 📊 **Cách tính**: tiến độ trên dashboard = **tổng tiền 2 vợ chồng đã chuyển vào các quỹ tiết kiệm & đầu tư trong năm** (vd: chuyển vào Quỹ Du lịch, Quỹ Mua xe…). Không phải thu/chi của Quỹ Chung hằng ngày. Số dư khởi điểm khai báo ban đầu không tính vào tiến độ để tránh gian lận.

### Quỹ tiết kiệm & đầu tư

Nếu vợ chồng có nhiều mục tiêu rõ ràng (vd: du lịch hè, sửa nhà, học phí cho con, chứng khoán), tạo **Quỹ tiết kiệm hoặc Quỹ đầu tư** riêng cho từng cái.

Vào tab **🎯 Mục tiêu** ở sidebar → **+ Tạo quỹ**. Chọn loại quỹ:
- **🐷 Tiết kiệm** — mục tiêu cụ thể, có deadline (vd: Quỹ Du lịch Đà Nẵng, Quỹ Mua xe)
- **📈 Đầu tư** — tích lũy dài hạn không deadline rõ (vd: Quỹ Chứng khoán, Quỹ Bất động sản)

Điền thêm (tuỳ chọn):
- **Mục tiêu**: tổng tiền cần (vd `50000000` = 50tr)
- **Deadline**: ngày cần đạt (vd `2026-09-15`)
- **Đóng góp/tháng**: tháng nào cũng cần bỏ vào ít nhất bao nhiêu (vd `5000000` = 5tr/tháng)

App sẽ tự tính em đang **đúng tiến độ / vượt / chậm**, dựa trên số ngày đã trôi và tỉ lệ tiền đã có.

**Cách nạp tiền vào quỹ tiết kiệm/đầu tư**: dùng "Chuyển nội bộ" qua chat — vd `chuyển 5tr vào quỹ du lịch`. Đây là cơ chế chính thống. Khoản chuyển này SẼ tính vào tiến độ mục tiêu năm.

> 💡 Sau khi tạo quỹ, quay lại **⚙️ Cài đặt → Số dư khởi điểm** — list quỹ sẽ có row cho quỹ vừa tạo. Nhập tiền đã để dành sẵn trước khi xài Concord (nếu có) ở đây; đừng tạo giao dịch chuyển vào qua chat cho khoản này (sẽ bị coi là tiết kiệm tháng).

---

## Hằng ngày — Log giao dịch qua Chat (cách chính)

Đây là cách **ngon nhất** và là điểm mạnh của Concord. Em không cần click form, chỉ cần gõ như nhắn tin.

Vào tab **💬 Chat** ở sidebar.

### Ví dụ câu em có thể gõ

| Tình huống | Gõ thế nào |
|---|---|
| Đi chợ về | `đi chợ 350k` |
| Cafe sáng | `cà phê Highland 65k` |
| Đổ xăng | `đổ xăng 200k` |
| Trả tiền điện | `tiền điện tháng 5: 1tr2` |
| Sữa bỉm cho Bin | `mua sữa Bin 350k` |
| Lương về | `lương về 25 triệu` |
| Đưa chồng tiền | `đưa anh 2tr` |
| Thưởng tháng | `thưởng kpi 3tr` |
| Mua online | `Shopee son MAC 850k` |
| Đi ăn cuối tuần | `ăn cơm cả nhà 800k` (sẽ vào quỹ chung) |
| Học phí | `học phí Bin tháng 5: 5tr` |
| Để dành vào quỹ du lịch | `chuyển 5tr vào quỹ du lịch` |
| Góp quỹ đầu tư tháng này | `góp quỹ chứng khoán 3tr` |

### AI hiểu được gì

- **Số tiền**: `350k`, `1tr2`, `2 triệu`, `25,000,000`, `25000000` — đều OK.
- **Quỹ**: dựa vào nội dung. *"đi chợ"*, *"học phí Bin"*, *"tiền điện"* → **Quỹ Chung** (chi tiêu gia đình). *"son MAC"*, *"cà phê em uống"*, *"lương em"* → **Quỹ Vợ**.
- **Category**: *"đổ xăng"* → "Xăng". *"cafe"* → "Cà phê / Trà sữa". *"sữa Bin"* → "Sữa / Bỉm". App có sẵn ~30 category tiếng Việt (Ăn uống / Đi lại / Nhà cửa / Con cái / Sức khoẻ / Mua sắm / …).
- **Ngày**: nếu không nói gì → hôm nay. Nói *"hôm qua mua…"* hoặc *"thứ 2 đi…"* → AI tự lùi ngày.

### Khi AI hỏi lại

Đôi lúc AI không chắc → nó sẽ hỏi `❓ Em định ghi vào Quỹ Vợ hay Quỹ Chung?` → em trả lời `Quỹ Vợ` rồi nó tự ghi tiếp.

### Sau khi log

AI hồi lại `✅ Đã ghi: -350,000đ • Quỹ Chung • Đi chợ / Siêu thị`. Sidebar trái cập nhật số dư realtime.

### Sửa / xoá

Em vừa log nhầm? Trong cùng cuộc chat, gõ:
- `xoá giao dịch vừa rồi` — AI xoá entry vừa tạo.
- `sửa thành 250k` — AI điều chỉnh lại số tiền entry vừa tạo.
- `chuyển sang quỹ chung` — AI chuyển fund.

Hoặc vào **📒 Giao dịch** ở sidebar, tìm dòng đó → bấm icon ✏️ (edit) hoặc 🗑️ (xoá).

---

## Các tab khác

### 📊 Dashboard

Tổng quan 1 màn hình:
- **Mục tiêu năm** — em đã tiết kiệm được bao nhiêu (tính theo tiền chuyển vào quỹ tiết kiệm/đầu tư trong năm), đang vượt/đúng/chậm tiến độ
- **Quỹ tiết kiệm & đầu tư** — tiến độ từng quỹ (du lịch, mua xe…) kèm progress bar
- **Tháng này** — thu / chi / net
- **Số dư các quỹ**: phân thành 2 nhóm — Quỹ chi tiêu (Vợ/Chồng/Chung) và Quỹ tiết kiệm & đầu tư. Riêng Quỹ Chồng em sẽ thấy `🔒 Riêng tư` vì privacy.
- **Giao dịch gần đây** — 8 entry mới nhất em xem được

### 📒 Giao dịch

Toàn bộ lịch sử giao dịch em xem được. Có:
- Filter theo quỹ (Tất cả / Vợ / Chung)
- Filter theo tháng (← →)
- Search theo ghi chú/category
- Nhóm theo ngày (Hôm nay / Hôm qua / từng ngày trong tháng)

### 📈 Báo cáo

Báo cáo chi tiết theo tháng: biểu đồ thu/chi từng ngày + chi tiêu theo từng category (em xài bao nhiêu cho Ăn uống, Đi lại, Con cái…).

### 🎯 Mục tiêu

Quản lý các quỹ tiết kiệm & đầu tư đã setup ở trên — sửa, archive, unarchive.

### ⚙️ Cài đặt

Tài khoản, đổi mật khẩu, mục tiêu năm, số dư khởi điểm.

---

## Privacy — đọc kỹ phần này 🔒

- **Quỹ Chồng em không bao giờ thấy** số dư hay giao dịch. Trong sidebar nó hiện `🔒 Riêng tư — — — đ`.
- **Quỹ Vợ chồng cũng không thấy**. Em log gì trong đó đều chỉ em đọc được.
- **Quỹ Chung cả 2 cùng thấy + ghi**. Mọi giao dịch ở Quỹ Chung sẽ hiện cho cả em và chồng.
- AI agent có "thấy" toàn bộ 3 quỹ để đưa lời khuyên tài chính cho cặp đôi (vd "tháng này 2 vợ chồng tiêu hơi cao mảng ăn ngoài"), **nhưng** trong câu trả lời nó sẽ KHÔNG bao giờ nói tên giao dịch hay số tiền cụ thể của Quỹ Chồng / Quỹ Vợ — chỉ aggregate ẩn danh.

Nói cách khác: chồng không bao giờ biết em mua son giá bao nhiêu. Em yên tâm.

---

## Quick reference — bảng tóm tắt

| Việc | Đi đâu |
|---|---|
| Log giao dịch | 💬 Chat — gõ tự nhiên |
| Sửa giao dịch | 💬 Chat (vừa tạo xong) hoặc 📒 Giao dịch (cũ hơn) |
| Xem số dư từng quỹ | Sidebar trái |
| Xem tiến độ mục tiêu năm | 📊 Dashboard hoặc ⚙️ Cài đặt |
| Tạo quỹ tiết kiệm / đầu tư | 🎯 Mục tiêu → + Tạo quỹ |
| Báo cáo thu/chi tháng | 📈 Báo cáo |
| Đổi mật khẩu | ⚙️ Cài đặt → Tài khoản |
| Đổi số dư khởi điểm (sai mới sửa) | ⚙️ Cài đặt → Số dư khởi điểm |

---

## Có chuyện gì hỏi chồng ngay 😄

App đang là MVP, có thể có lỗi nhỏ. Em gặp tình huống lạ — screenshot lại + nhắn chồng. Đặc biệt:

- AI ghi sai quỹ / sai số → kể chồng câu chính xác em đã gõ
- App đứng / loading mãi không xong → reload trang trước
- Số dư hiện sai → đừng tự sửa số dư khởi điểm, kể chồng để chồng debug
