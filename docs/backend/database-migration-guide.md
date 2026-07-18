# Database Migration Guide

Tài liệu này hướng dẫn cách thay đổi cấu trúc database và áp dụng (apply) migration trong dự án `monolith-backend` bằng Prisma.

## Khi nào cần làm Migration?
Mỗi khi bạn có sự thay đổi trong file `prisma/schema.prisma` (thêm bảng, sửa cột, đổi kiểu dữ liệu, ...), bạn bắt buộc phải tạo migration để Prisma sinh ra mã SQL cập nhật database.

## Quy trình 2 bước khi sửa Schema

### Bước 1: Tạo file Migration mới
Mở terminal ở thư mục `monolith-backend` và chạy lệnh sau (thay `ten_thay_doi` bằng mô tả ngắn gọn về thứ bạn vừa sửa):

```bash
npx prisma migrate dev --name ten_thay_doi
```

**Ví dụ:**
```bash
npx prisma migrate dev --name add_user_table
```

**Điều gì xảy ra?**
- Prisma sẽ so sánh file `schema.prisma` với cơ sở dữ liệu hiện tại.
- Sinh ra thư mục mới trong `prisma/migrations/` chứa file `migration.sql`.
- Tự động thực thi file SQL đó để áp dụng thay đổi vào database hiện tại của bạn.
- Cập nhật Prisma Client (tự động chạy ngầm lệnh `prisma generate` để code TypeScript nhận diện bảng/cột mới).

### Bước 2: Commit Code
Sau khi chạy xong, hãy `git add` toàn bộ thư mục `prisma/migrations` cùng với `schema.prisma` để đẩy lên repository.

---

## Áp dụng Migration (khi pull code từ Git về)

Nếu một người khác trong team (hoặc khi bạn deploy) đẩy các file migration mới lên Git, sau khi pull code về, bạn KHÔNG chạy lệnh `migrate dev`. Thay vào đó, dùng lệnh:

```bash
npx prisma migrate deploy
```

Lệnh này sẽ kiểm tra xem database của bạn còn thiếu migration nào (đã có trong source code nhưng chưa chạy ở DB) và tiến hành chạy chúng.

---

## Ghi chú quan trọng
- Không bao giờ sửa thủ công các file `.sql` trong thư mục `prisma/migrations` đã được tạo ra.
- Nếu lỡ làm rối database và muốn xoá sạch làm lại từ đầu (mất hết data), bạn có thể chạy `npx prisma migrate reset`.
