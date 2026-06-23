# Hướng Dẫn Kết Nối Google Sheet Mới

Theo yêu cầu, dữ liệu sẽ được lưu vào 2 Sheet khác nhau trong cùng một file Google Sheets:
- **Sheet 1**: Dùng để lưu danh sách lịch đánh giá và giảng viên khi tạo từ trang Admin.
- **Sheet 2**: Dùng để lưu kết quả chấm điểm của Hội đồng.

## Bước 1: Chuẩn bị Google Sheet

1. Truy cập [Google Sheets](https://sheets.google.com) → **Tạo bảng tính mới**
2. Phía dưới cùng, tạo **2 Sheet** (nếu chưa có thì nhấn dấu `+` để thêm). Bạn có thể đổi tên Sheet tùy ý (VD: Sheet 1 là `Kì 1 Năm 2026`, Sheet 2 là `Kết quả Kì 1 Năm 2026`). 
   *Lưu ý: Hệ thống nhận diện tự động Sheet đầu tiên (Sheet 1) và Sheet thứ hai (Sheet 2) bằng thứ tự của chúng, không quan trọng tên.*

3. **Ở Sheet 1 (Lịch Đánh Giá)**, nhập tiêu đề ở hàng 1:
```text
A1: Mã ca (ID)
B1: Tên ca đánh giá
C1: Ngày đánh giá
D1: Địa điểm
E1: Tên giảng viên
F1: Tên bài giảng
```

4. **Ở Sheet 2 (Kết Quả)**, nhập tiêu đề ở hàng 1:
```text
A1: Thời gian chấm
B1: Tên giảng viên
C1: SĐT Hội đồng chấm
D1: Bài giảng
E1: Tên ca đánh giá
F1: TC1 - Mục tiêu bài học
G1: TC2 - Nội dung chính xác
... (Từ F1 đến Y1 là các Tiêu chí 1-20)
Z1: Tổng điểm
AA1: Nhận xét
```

## Bước 2: Tạo Google Apps Script

1. Trong Google Sheet, vào menu **Tiện ích mở rộng** → **Apps Script**
2. **Xóa hết** code mặc định, dán toàn bộ đoạn code sau vào:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    
    // Đảm bảo có ít nhất 2 sheet
    if (sheets.length < 2) {
      throw new Error("Vui lòng tạo ít nhất 2 sheet (Sheet 1: Lịch, Sheet 2: Kết quả)");
    }
    
    var sheetSchedule = sheets[0]; // Sheet 1: Lưu lịch (index = 0)
    var sheetResult = sheets[1];   // Sheet 2: Lưu kết quả (index = 1)
    
    // ============================================
    // 1. XỬ LÝ LƯU LỊCH ĐÁNH GIÁ (Sheet 1)
    // ============================================
    if (data.type === 'schedule') {
      var s = data.data; 
      
      // Nếu là update hoặc delete, xóa các dòng cũ của ID lịch này
      if (data.action === 'update' || data.action === 'delete') {
        var rows = sheetSchedule.getDataRange().getValues();
        // Xóa từ dưới lên để không làm thay đổi thứ tự các dòng đang duyệt
        for (var i = rows.length - 1; i >= 1; i--) {
          if (rows[i][0] === s.id) {
            sheetSchedule.deleteRow(i + 1);
          }
        }
      }
      
      if (data.action === 'delete') {
         return ContentService.createTextOutput(
           JSON.stringify({ status: 'success', message: 'Đã xóa lịch đánh giá' })
         ).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Thêm các giảng viên vào sheet
      s.lecturers.forEach(function(gv) {
        sheetSchedule.appendRow([
          s.id, s.name, s.date, s.location, gv.name, gv.lesson
        ]);
      });
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', message: 'Đã lưu lịch đánh giá' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ============================================
    // 2. XỬ LÝ LƯU KẾT QUẢ ĐÁNH GIÁ (Sheet 2)
    // ============================================
    if (data.type === 'result') {
      var d = data.data;
      
      if (data.action === 'update' && data.rowIndex) {
        var rows = sheetResult.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (rows[i][1] === d.name && rows[i][2] === d.phone) {
            var row = i + 1;
            sheetResult.getRange(row, 1, 1, 27).setValues([[
              d.timestamp, d.name, d.phone, d.lesson, d.scheduleName,
              d.score1, d.score2, d.score3, d.score4, d.score5,
              d.score6, d.score7, d.score8, d.score9,
              d.score10, d.score11,
              d.score12, d.score13, d.score14,
              d.score15, d.score16,
              d.score17, d.score18,
              d.score19, d.score20,
              d.total, d.comment
            ]]);
            return ContentService.createTextOutput(
              JSON.stringify({ status: 'updated', row: row })
            ).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      
      // Insert dòng mới
      sheetResult.appendRow([
        d.timestamp, d.name, d.phone, d.lesson, d.scheduleName,
        d.score1, d.score2, d.score3, d.score4, d.score5,
        d.score6, d.score7, d.score8, d.score9,
        d.score10, d.score11,
        d.score12, d.score13, d.score14,
        d.score15, d.score16,
        d.score17, d.score18,
        d.score19, d.score20,
        d.total, d.comment
      ]);
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', row: sheetResult.getLastRow() })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error("Invalid request type");

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    // API Lấy danh sách lịch đánh giá
    if (e.parameter.action === 'get_schedules') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var rows = sheet.getDataRange().getValues();
      var schedulesObj = {};
      
      // Bỏ qua dòng tiêu đề
      for (var i = 1; i < rows.length; i++) {
        var id = rows[i][0];
        if (!id) continue;
        
        if (!schedulesObj[id]) {
          schedulesObj[id] = {
            id: id,
            name: rows[i][1],
            date: rows[i][2],
            location: rows[i][3],
            lecturers: []
          };
        }
        
        schedulesObj[id].lecturers.push({
          name: rows[i][4],
          lesson: rows[i][5]
        });
      }
      
      var schedulesList = Object.keys(schedulesObj).map(function(k) { return schedulesObj[k]; });
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', data: schedulesList })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // API Lấy danh sách kết quả chấm điểm
    if (e.parameter.action === 'get_results') {
      var sheetResult = SpreadsheetApp.getActiveSpreadsheet().getSheets()[1];
      var rows = sheetResult.getDataRange().getValues();
      var results = [];
      
      // Bỏ qua dòng tiêu đề
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r[1]) continue; // Nếu không có tên giảng viên thì bỏ qua
        
        var scores = [];
        // Điểm tiêu chí nằm từ cột F (index 5) đến cột Y (index 24)
        for (var j = 5; j <= 24; j++) {
           scores.push(r[j] === "" ? 0 : Number(r[j]));
        }
        
        results.push({
           timestamp: r[0],
           lecturerName: r[1],
           reviewerPhone: r[2],
           lesson: r[3],
           scheduleName: r[4],
           scores: scores,
           total: r[25] === "" ? 0 : Number(r[25]),
           comment: r[26]
        });
      }
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', data: results })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check API Status
    return ContentService.createTextOutput('Scoring API is running!').setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Nhấn **Ctrl + S** để lưu code.

## Bước 3: Cập nhật Triển khai (Deploy)
Do bạn thay đổi code Apps Script nên bắt buộc phải cập nhật Deploy (nếu không link cũ vẫn chạy code cũ).

1. Nhấn nút **Triển khai** (Deploy) góc trên phải → Chọn **Quản lý bản triển khai** (Manage deployments).
2. Nhấn biểu tượng ✏️ (Chỉnh sửa) ở bản triển khai hiện tại.
3. Ở mục Phiên bản (Version), chọn **Phiên bản mới** (New version).
4. Nhấn **Triển khai** (Deploy) một lần nữa. 
5. Bạn không cần phải đổi link trong app, vẫn dùng URL cũ là được, nhưng hệ thống sẽ dùng code mới.

> **Lưu ý:** Đừng quên test thử bằng cách tạo một Lịch mới trong `admin.html` để xem Sheet 1 có nhảy số không, và thực hiện thử 1 bài đánh giá trong `index.html` để xem Sheet 2 có nhận được kết quả không nhé!
