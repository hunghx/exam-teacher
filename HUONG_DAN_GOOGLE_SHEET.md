# Hướng Dẫn Kết Nối Google Sheet Mới

Theo yêu cầu, dữ liệu sẽ được lưu vào 3 Sheet khác nhau trong cùng một file Google Sheets:
- **Sheet 1**: Dùng để lưu danh sách lịch đánh giá, khung giờ và giảng viên khi tạo từ trang Admin.
- **Sheet 2**: Dùng để lưu kết quả chấm điểm của Hội đồng.
- **Sheet 3**: Dùng để lưu danh sách Hội đồng chấm và mã truy cập riêng của từng người.

## Bước 1: Chuẩn bị Google Sheet

1. Truy cập [Google Sheets](https://sheets.google.com) → **Tạo bảng tính mới**
2. Phía dưới cùng, tạo **3 Sheet** (rearrange đúng thứ tự từ trái sang phải):
   - Sheet 1: đặt tên tùy ý (VD: `Lịch`)
   - Sheet 2: đặt tên tùy ý (VD: `Kết quả`)
   - Sheet 3: đặt tên tùy ý (VD: `Hội đồng`)
   *Lưu ý: Hệ thống nhận diện tự động Sheet đầu tiên (Sheet 1), Sheet thứ hai (Sheet 2), và Sheet thứ ba (Sheet 3) bằng thứ tự của chúng từ trái qua phải, không quan trọng tên.*

3. **Ở Sheet 1 (Lịch Đánh Giá)**, nhập tiêu đề ở hàng 1:
```text
A1: Mã ca (ID)
B1: Tên ca đánh giá
C1: Ngày đánh giá
D1: Giờ bắt đầu
E1: Giờ kết thúc
F1: Địa điểm
G1: Tên giảng viên
H1: Tên bài giảng
```

4. **Ở Sheet 2 (Kết Quả)**, nhập tiêu đề ở hàng 1:
```text
A1: Thời gian chấm
B1: Tên giảng viên
C1: Người chấm
D1: Bài giảng
E1: Tên ca đánh giá
F1: TC1 - Mục tiêu bài học
... (Từ F1 đến Y1 là các Tiêu chí 1-20)
Z1: Tổng điểm
AA1: Nhận xét
```

5. **Ở Sheet 3 (Hội đồng)**, nhập tiêu đề ở hàng 1:
```text
A1: Mã ca (ID)
B1: Tên người chấm
C1: Email
D1: Mã truy cập
```

## Bước 2: Tạo Google Apps Script

1. Trong Google Sheet, vào menu **Tiện ích mở rộng** (Extensions) → **Apps Script**
2. **Xóa hết** code mặc định, dán toàn bộ đoạn code sau vào:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    
    if (sheets.length < 3) {
      throw new Error("Vui lòng tạo ít nhất 3 sheet (Sheet 1: Lịch, Sheet 2: Kết quả, Sheet 3: Hội đồng)");
    }
    
    var sheetSchedule = sheets[0];
    var sheetResult = sheets[1];
    var sheetCommittee = sheets[2];
    
    // ============================================
    // 1. XỬ LÝ LƯU LỊCH ĐÁNH GIÁ (Sheet 1) & HỘI ĐỒNG (Sheet 3)
    // ============================================
    if (data.type === 'schedule') {
      var s = data.data; 
      
      if (data.action === 'update' || data.action === 'delete') {
        var rows = sheetSchedule.getDataRange().getValues();
        for (var i = rows.length - 1; i >= 1; i--) {
          if (rows[i][0] === s.id) {
            sheetSchedule.deleteRow(i + 1);
          }
        }
        
        var cRows = sheetCommittee.getDataRange().getValues();
        for (var k = cRows.length - 1; k >= 1; k--) {
          if (cRows[k][0] === s.id) {
            sheetCommittee.deleteRow(k + 1);
          }
        }
      }
      
      if (data.action === 'delete') {
         return ContentService.createTextOutput(
           JSON.stringify({ status: 'success', message: 'Đã xóa lịch đánh giá' })
         ).setMimeType(ContentService.MimeType.JSON);
      }
      
      s.lecturers.forEach(function(gv) {
        sheetSchedule.appendRow([
          s.id, s.name, s.date, s.startTime || '', s.endTime || '', s.location, gv.name, gv.lesson
        ]);
      });
      
      if (s.committee && s.committee.length > 0) {
        s.committee.forEach(function(member) {
          sheetCommittee.appendRow([
            s.id, member.name, member.email, member.accessCode || ''
          ]);
        });
      }
      
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
          if (rows[i][1] === d.name && rows[i][2] === d.reviewerName) {
            var row = i + 1;
            sheetResult.getRange(row, 1, 1, 26).setValues([[
              d.timestamp, d.name, d.reviewerName, d.lesson, d.scheduleName,
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
      
      sheetResult.appendRow([
        d.timestamp, d.name, d.reviewerName, d.lesson, d.scheduleName,
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

    // ============================================
    // 3. TẠO MÃ VÀ GỬI EMAIL (Sheet 3)
    // ============================================
    if (data.type === 'generate_code') {
      var cRows = sheetCommittee.getDataRange().getValues();
      for (var k = cRows.length - 1; k >= 1; k--) {
        if (cRows[k][0] === data.scheduleId) {
          sheetCommittee.deleteRow(k + 1);
        }
      }
      
      data.committee.forEach(function(member) {
        sheetCommittee.appendRow([
          data.scheduleId, member.name, member.email, member.accessCode
        ]);
        
        var subject = "Mã truy cập đánh giá: " + data.scheduleName;
        var body = "Kính gửi " + member.name + ",\n\n" +
                   "Bạn đã được thêm vào Hội đồng chấm thi cho ca: " + data.scheduleName + "\n" +
                   "Ngày: " + data.date + " \n" +
                   "Thời gian: " + data.startTime + " - " + data.endTime + "\n\n" +
                   "Mã truy cập cá nhân của bạn là: " + member.accessCode + "\n\n" +
                   "Vui lòng đăng nhập vào hệ thống và nhập mã này để tiến hành chấm điểm trong khung giờ quy định.\n" +
                   "Lưu ý: Mã này là mã cá nhân và chỉ có hiệu lực trong thời gian đánh giá.\n\n" +
                   "Trân trọng!";
                   
        if(member.email) {
          try {
             GmailApp.sendEmail(member.email, subject, body);
          } catch(e) {
             console.error("Lỗi gửi mail tới " + member.email + ": " + e.toString());
          }
        }
      });
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', message: 'Đã tạo mã và gửi email' })
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
    if (e.parameter.action === 'get_schedules') {
      var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
      var sheet = sheets[0];
      var rows = sheet.getDataRange().getValues();
      var schedulesObj = {};
      
      for (var i = 1; i < rows.length; i++) {
        var id = rows[i][0];
        if (!id) continue;
        
        if (!schedulesObj[id]) {
          schedulesObj[id] = {
            id: id,
            name: rows[i][1],
            date: rows[i][2],
            startTime: rows[i][3],
            endTime: rows[i][4],
            location: rows[i][5],
            lecturers: [],
            committee: []
          };
        }
        
        // Push lecturer if not duplicated (doPost appends row multiple times for lecturers)
        var hasLecturer = schedulesObj[id].lecturers.some(function(l) { return l.name === rows[i][6] && l.lesson === rows[i][7]; });
        if (!hasLecturer && rows[i][6]) {
            schedulesObj[id].lecturers.push({ name: rows[i][6], lesson: rows[i][7] });
        }
      }

      // Read Committee from Sheet 3
      if (sheets.length >= 3) {
         var sheetCommittee = sheets[2];
         var cRows = sheetCommittee.getDataRange().getValues();
         for (var k = 1; k < cRows.length; k++) {
             var sId = cRows[k][0];
             if (schedulesObj[sId]) {
                 schedulesObj[sId].committee.push({
                     name: cRows[k][1],
                     email: cRows[k][2],
                     accessCode: String(cRows[k][3])
                 });
             }
         }
      }
      
      var schedulesList = Object.keys(schedulesObj).map(function(k) { return schedulesObj[k]; });
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', data: schedulesList })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (e.parameter.action === 'get_results') {
      var sheetResult = SpreadsheetApp.getActiveSpreadsheet().getSheets()[1];
      var rows = sheetResult.getDataRange().getValues();
      var results = [];
      
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r[1]) continue; 
        
        var scores = [];
        for (var j = 5; j <= 24; j++) {
           scores.push(r[j] === "" ? 0 : Number(r[j]));
        }
        
        results.push({
           timestamp: r[0],
           lecturerName: r[1],
           reviewerName: r[2],
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

Do bạn thay đổi code Apps Script và yêu cầu cấp quyền gửi Email (`GmailApp.sendEmail`), bạn bắt buộc phải tạo bản triển khai mới và Xác thực quyền.

1. Nhấn nút **Triển khai** (Deploy) góc trên phải → Chọn **Quản lý bản triển khai** (Manage deployments).
2. Nhấn biểu tượng ✏️ (Chỉnh sửa) ở bản triển khai hiện tại.
3. Ở mục Phiên bản (Version), chọn **Phiên bản mới** (New version).
4. Nhấn **Triển khai** (Deploy) một lần nữa. 
5. Lúc này Google sẽ hiện ra một cảnh báo yêu cầu bạn **Xác thực ủy quyền** để gửi Email. Bạn hãy cấp quyền bằng tài khoản Google của bạn (bấm Nâng cao -> Chuyển tới Script không an toàn -> Cho phép).
6. Hoàn tất! Bạn không cần thay đổi đường link trong App. Mọi thứ đã sẵn sàng.
