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
            sheetResult.getRange(row, 1, 1, 27).setValues([[
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
    // 3. WEBHOOK TỪ LARK FORM (THÊM HỘI ĐỒNG)
    // ============================================
    if (data.type === 'lark_webhook_add_committee') {
      var scheduleId = data.scheduleId || '';
      var name = data.name || '';
      var email = data.email || '';
      // Tạo mã truy cập ngẫu nhiên 6 chữ số
      var accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      sheetCommittee.appendRow([
        scheduleId, name, email, accessCode
      ]);
      
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', message: 'Thêm thành viên từ Lark thành công' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // ============================================
    // 4. TẠO MÃ VÀ GỬI EMAIL TỪ ADMIN APP (Sheet 3)
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
        
        var loginLink = data.appUrl ? (data.appUrl + "?scheduleId=" + data.scheduleId + "&accessCode=" + member.accessCode) : "";
        
        var lecturersHtml = "";
        if (data.lecturers && data.lecturers.length > 0) {
            lecturersHtml = "<h3 style=\"margin-top: 25px; margin-bottom: 15px; color: #4f46e5; border-bottom: 2px solid #e0e7ff; padding-bottom: 8px; font-size: 18px;\">Danh sách Giảng viên tham gia:</h3><ul style=\"list-style: none; padding-left: 0; margin: 0;\">";
            data.lecturers.forEach(function(gv) {
                lecturersHtml += "<li style=\"background-color: #f8fafc; padding: 12px 15px; margin-bottom: 10px; border-left: 4px solid #818cf8; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);\">" +
                    "<strong style=\"color: #334155; font-size: 16px;\">" + gv.name + "</strong><br>" +
                    "<span style=\"color: #64748b; font-size: 14px; margin-top: 4px; display: inline-block;\">Chủ đề: " + gv.lesson + "</span>" +
                "</li>";
            });
            lecturersHtml += "</ul>";
        }

        var htmlBody = "<div style=\"font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);\">" +
            "<div style=\"background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 25px 20px; text-align: center;\">" +
                "<h2 style=\"margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;\">Thông Báo Đánh Giá Dạy Thử</h2>" +
            "</div>" +
            "<div style=\"padding: 30px 25px;\">" +
                "<p style=\"font-size: 16px; margin-top: 0;\">Kính gửi <strong>" + member.name + "</strong>,</p>" +
                "<p style=\"font-size: 16px;\">Bạn đã được thêm vào Hội đồng chấm thi cho ca đánh giá:</p>" +
                
                "<div style=\"background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;\">" +
                    "<p style=\"margin: 8px 0; font-size: 16px;\"><span style=\"color: #64748b; display: inline-block; width: 90px;\">Tên ca:</span> <strong style=\"color: #4f46e5; font-size: 18px;\">" + data.scheduleName + "</strong></p>" +
                    "<p style=\"margin: 8px 0; font-size: 16px;\"><span style=\"color: #64748b; display: inline-block; width: 90px;\">Ngày:</span> <strong>" + data.date + "</strong></p>" +
                    "<p style=\"margin: 8px 0; font-size: 16px;\"><span style=\"color: #64748b; display: inline-block; width: 90px;\">Thời gian:</span> <strong>" + data.startTime + " - " + data.endTime + "</strong></p>" +
                    "<div style=\"margin-top: 15px; padding-top: 15px; border-top: 1px dashed #cbd5e1;\">" +
                        "<p style=\"margin: 0; font-size: 16px;\"><span style=\"color: #64748b; display: inline-block; width: 90px;\">Mã OTP:</span> <span style=\"background-color: #fef08a; padding: 6px 12px; border-radius: 6px; color: #854d0e; font-weight: bold; font-size: 20px; letter-spacing: 3px; display: inline-block; vertical-align: middle; box-shadow: 0 1px 2px rgba(0,0,0,0.05);\">" + member.accessCode + "</span></p>" +
                    "</div>" +
                "</div>" +
                
                lecturersHtml +
                
                (loginLink ? "<div style=\"text-align: center; margin: 35px 0;\"><a href=\"" + loginLink + "\" style=\"background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: all 0.3s ease;\">Đăng nhập & Chấm điểm ngay</a></div>" : "<p style=\"font-size: 16px;\">Vui lòng đăng nhập vào hệ thống và nhập mã này để tiến hành chấm điểm trong khung giờ quy định.</p>") +
                
                "<div style=\"background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 15px; margin-top: 20px; border-radius: 0 6px 6px 0;\">" +
                    "<p style=\"color: #b91c1c; font-style: italic; font-size: 14px; margin: 0;\">⚠️ Lưu ý: Mã OTP này là mã cá nhân bảo mật và chỉ có hiệu lực trong thời gian đánh giá.</p>" +
                "</div>" +
                
                "<hr style=\"border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;\">" +
                "<p style=\"margin: 0; font-size: 15px; color: #64748b;\">Trân trọng,</p>" +
                "<p style=\"margin: 5px 0 0 0; font-weight: bold; font-size: 16px; color: #334155;\">Ban Tổ Chức</p>" +
            "</div>" +
        "</div>";
                   
        if(member.email) {
          try {
             GmailApp.sendEmail(member.email, subject, body, { htmlBody: htmlBody });
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
6. Hoàn tất! Đừng quên copy lại **Web app URL** mới nhất.

## Bước 4: Tạo Form trên Lark và cấu hình Automation (Tự động hóa)

Để người dùng có thể điền Form trên Lark và tự động đẩy dữ liệu về Google Sheet danh sách Hội đồng, bạn làm theo các bước sau:

**1. Tạo Base và Form trên Lark:**
- Mở **Lark Base** (Bitable) và tạo một Base mới.
- Trong bảng dữ liệu (Table), tạo các trường sau:
  - **Mã ca**: Kiểu Text hoặc Dropdown (Dùng để người đăng ký chọn ID ca đánh giá).
  - **Họ và tên**: Kiểu Text.
  - **Email**: Kiểu Text (để lưu email liên hệ).
- Tạo một **Form view** (Chế độ xem biểu mẫu) từ bảng này và gửi link cho mọi người đăng ký.

**2. Cấu hình Automation (Quy trình tự động):**
- Trong Lark Base, chọn **Automations** (Tự động hóa) ở góc phải trên.
- **Tạo Rule mới**:
  - **Trigger (Trình kích hoạt)**: Chọn **Record added** (Khi có bản ghi được thêm mới).
  - **Action (Hành động)**: Chọn **Send web request** (Gửi yêu cầu web) hoặc **Webhook**.
- **Cấu hình Request (Yêu cầu)**:
  - **URL**: Dán `Web app URL` của Google Apps Script bạn vừa copy ở Bước 3.
  - **Method**: Chọn `POST`.
  - **Headers**: Bấm Add header, điền Key là `Content-Type` và Value là `application/json`.
  - **Body format**: Chọn `JSON`.
  - **Body**: Dán đoạn mã sau, và dùng nút "Insert field" (Chèn trường dữ liệu của Lark) để thay thế các biến cho đúng:

```json
{
  "type": "lark_webhook_add_committee",
  "scheduleId": "{{Mã ca}}",
  "name": "{{Họ và tên}}",
  "email": "{{Email}}"
}
```
*(Lưu ý: Thay thế `{{Mã ca}}`, `{{Họ và tên}}`, `{{Email}}` bằng các biến dữ liệu tương ứng trong Lark Base của bạn bằng cách click vào để chèn)*

**3. Kiểm tra:**
- Thử điền một form trên Lark.
- Mở Google Sheet -> Sheet 3 (Hội đồng) xem dữ liệu đã nhảy sang kèm theo mã truy cập 6 số ngẫu nhiên chưa nhé!
