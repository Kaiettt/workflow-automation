// A tiny order API for trying the "Order lookup" node on your own machine.
//   node scripts/mock-orders-api.mjs        (listens on http://localhost:4000)
// GET /orders?q=<text>: finds an order code such as DH001 inside q and returns that order.
import http from 'node:http';

const ORDERS = {
  DH001: { ma_don: 'DH001', khach: 'Nguyễn An', trang_thai: 'Đang giao', du_kien: '2 ngày nữa', tong_tien: 500000 },
  DH002: { ma_don: 'DH002', khach: 'Trần Bình', trang_thai: 'Đã giao', du_kien: 'Đã nhận hàng', tong_tien: 350000 },
  DH003: { ma_don: 'DH003', khach: 'Lê Chi', trang_thai: 'Đang chuẩn bị hàng', du_kien: '4 ngày nữa', tong_tien: 220000 },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (url.pathname !== '/orders') {
    res.writeHead(404).end(JSON.stringify({ error: 'not found' }));
    return;
  }
  const text = url.searchParams.get('q') ?? '';
  const code = (text.match(/DH\d+/i) ?? [])[0]?.toUpperCase();
  const order = code ? ORDERS[code] : undefined;
  const body = order
    ? { found: true, order }
    : { found: false, message: code ? `Không có đơn ${code}` : 'Khách chưa nói mã đơn (dạng DH001)' };
  console.log(new Date().toISOString(), req.method, req.url, '->', body.found);
  res.writeHead(200).end(JSON.stringify(body));
});

server.listen(4000, () => console.log('Mock orders API on http://localhost:4000/orders'));
