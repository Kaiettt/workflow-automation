# Running the Project (Backend)

Tài liệu này hướng dẫn các bước để khởi chạy dự án `monolith-backend` từ đầu.

## 1. Yêu cầu hệ thống
- **Node.js** (Phiên bản tương thích với package.json, nên dùng v20+)
- **Docker** và **Docker Compose** (Để chạy PostgreSQL và các dịch vụ đi kèm)

## 2. Các bước khởi chạy

### Bước 2.1: Chạy Database bằng Docker
Dự án sử dụng PostgreSQL. Mở terminal ở **thư mục gốc của project** (nơi chứa file `docker-compose.yml`) và chạy:

```bash
docker-compose up -d postgres
```

Lệnh này sẽ tải image PostgreSQL và chạy ở chế độ background (port 5432).

### Bước 2.2: Thiết lập Biến Môi Trường (Environment Variables)
Chuyển vào thư mục backend:
```bash
cd monolith-backend
```

- Sao chép file `.env.example` thành file `.env`:
  ```bash
  cp .env.example .env
  ```
- Mặc định URL kết nối DB trong `.env.example` đã trỏ đúng tới Docker local của bạn.

### Bước 2.3: Cài đặt Dependencies
Bên trong thư mục `monolith-backend`, chạy lệnh:
```bash
npm install
```

### Bước 2.4: Khởi tạo Prisma và Database
Chạy lệnh sau để đồng bộ database và sinh ra Prisma Client cho TypeScript:

```bash
npx prisma migrate deploy
npx prisma generate
```

*(Lưu ý: Nếu đang code tính năng và cần thay đổi cấu trúc DB, hãy xem tài liệu `database-migration-guide.md`)*

### Bước 2.5: Khởi chạy NestJS Server
Cuối cùng, start ứng dụng NestJS ở chế độ watch (tự động reload khi sửa code):

```bash
npm run start:dev
```

Server của bạn sẽ chạy mặc định ở `http://localhost:8080` (hoặc cổng được cấu hình trong `main.ts`).
