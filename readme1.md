# Kiểm tra tốc độ Payload vs. Strapi

Với bài kiểm tra hiệu năng này, chúng tôi muốn xem một truy vấn tài liệu phức tạp trong thực tế sẽ hoạt động như thế nào khi được truy xuất từ các endpoint GraphQL của hai CMS khác nhau. Hãy xem xét một tài liệu "mega menu" phức tạp, nơi có thể có 30-50 "liên kết" đến các trang / bài viết / v.v. khác và rất nhiều quan hệ đa phương tiện như biểu tượng, hình ảnh, v.v. cần được hiển thị trong một mega menu nhất định. Chỉ với một tài liệu mega menu đó, chúng ta có thể phải lấy rất nhiều tài liệu "liên quan", với rất nhiều JSON trả về từ phản hồi.

Theo kinh nghiệm của chúng tôi, điều này có thể nhanh chóng trở thành vấn đề (đặc biệt là nếu bạn đang sử dụng server-side rendering), bởi vì tài liệu "mega menu" đó được sử dụng và cần được truy xuất cho **mỗi view được render phía server** của một ứng dụng hoặc trang web. Điều đó có nghĩa là trừ khi CMS của bạn được tối ưu hóa tốt, bạn sẽ phải tốn thêm chi phí để đảm bảo máy chủ có thể xử lý loại yêu cầu này. Tệ hơn nữa, các framework frontend hiện đại như Gatsby hoặc Next thường pre-render các view, nghĩa là trong quá trình build, máy chủ của bạn có thể bị dội bom bởi các yêu cầu gửi đến API.

Để phản ánh một truy vấn thực tế có độ phức tạp vừa phải, chúng tôi đã thiết kế một cấu trúc tài liệu có hơn 60 mối quan hệ cũng như các cấu trúc dữ liệu phức tạp như nhóm (groups), mảng (arrays), mảng lồng nhau (nested arrays) và khối (blocks). Bản thân tài liệu được tạo mẫu (seeded) một cách có thể dự đoán được và hoàn toàn giống nhau trên cả hai hệ thống quản lý nội dung (CMS), và các truy vấn GraphQL được thực thi cũng giống hệt nhau, ngoại trừ các khác biệt về cú pháp đặc thù của từng CMS.

## Kết quả

Kết quả được phân tích trên 100 truy vấn tuần tự. Đơn vị là mili giây.

| Nền tảng | Trung bình | Tối đa | Tối thiểu | Tổng thời gian kiểm tra |
| -------- | ---------- | ------ | --------- | ----------------------- |
| Payload  | 15         | 43     | 8         | 1513                    |
| Strapi   | 102        | 353    | 77        | 10172                   |

## Thiết lập và Chạy kiểm tra

Mỗi nền tảng có các bước thiết lập và thực thi riêng được ghi lại bên dưới. Kết quả được xuất ra dưới dạng `<platform>-results.json` trong thư mục gốc của dự án.

Để chạy kiểm tra hiệu năng cho một CMS cụ thể, hãy chạy `yarn` trong thư mục gốc, và sau đó làm theo các bước bên dưới cho bất kỳ CMS nào bạn muốn kiểm tra.

### Payload

1. `cd ./payload`
2. Sao chép `.env.example` thành `.env` và cập nhật các giá trị nếu cần thiết
3. `yarn install`
4. Ở thư mục cấp cao nhất (root), chạy `yarn payload:run`
5. Trong một cửa sổ terminal khác, chạy `yarn payload:test`

### Strapi

1. Tạo DB tên là `strapi` trong Postgres
2. `cd ./strapi`
3. Sao chép `.env.example` thành `.env` và cập nhật các giá trị nếu cần thiết
4. `yarn install`
5. Ở thư mục cấp cao nhất, chạy `yarn strapi:run`
6. Trong một cửa sổ terminal khác, chạy `yarn strapi:bootstrap`
7. `yarn strapi:test`