# Partol · ระบบจำหน่ายไฟฟ้า

แอปบันทึกงาน Patrol / Thermal / PD แล้วเก็บข้อมูลลง [Google Sheet Data](https://docs.google.com/spreadsheets/d/1-uyaYvEDLgl0yNn_cpoS1WxPhZCEvv9FlQIrkweeeTo/edit?gid=1374913182#gid=1374913182)

คอลัมน์ **ภาพถ่าย** จะแสดงรูปในชีต และกดแล้วดาวน์โหลดได้ทันที

## อย่าลากโฟลเดอร์ทั้งก้อนขึ้น GitHub

อย่าอัพโหลด `node_modules`, `.tools`, หรือ `.env`  
ไฟล์ที่ขึ้นต้นด้วย `.` เช่น `.gitignore` GitHub จะขึ้นว่า **This file is hidden** — ปล่อยไว้ได้ ไม่ต้องลบจุดออก

วิธีที่ถูก: ใช้ Git ตามขั้นตอนด้านล่าง ไม่ต้องลากไฟล์ในเว็บ

## 1) เชื่อม Google Sheet (ทำครั้งเดียว)

1. เปิด [สเปรดชีต](https://docs.google.com/spreadsheets/d/1-uyaYvEDLgl0yNn_cpoS1WxPhZCEvv9FlQIrkweeeTo/edit?gid=1374913182#gid=1374913182)
2. เมนู **ส่วนขยาย → Apps Script**
3. ลบโค้ดเดิม แล้ววางเนื้อหาจากไฟล์ `apps-script/Code.gs`
4. กด **บันทึก** แล้ว **ปรับใช้ → การติดตั้งใหม่**
   - ประเภท: **เว็บแอป**
   - เรียกใช้ในฐานะ: **ฉัน**
   - ผู้มีสิทธิ์เข้าถึง: **ทุกคน**
5. กด **ปรับใช้** แล้วคัดลอก URL ของเว็บแอป
6. อนุญาตสิทธิ์เมื่อ Google ถามครั้งแรก
7. ในแอป Partol เปิดเมนู ☰ แล้ววาง URL ลงช่อง **ลิงก์ Apps Script**

บันทึกรายการใหม่พร้อมรูปแล้ว ไปที่ชีต Data:

- คอลัมน์ **ภาพถ่าย** แสดงรูป และกดเพื่อดาวน์โหลด
- **ImageURL** / **แปลง_URLภาพ** คือลิงก์ดาวน์โหลดตรง
- **Link_ภาพ** เปิดดูใน Google Drive

## 2) ลง GitHub แล้วเปิดใช้งานบนเว็บ

อย่าลากโฟลเดอร์โปรเจกต์ทั้งก้อน ใช้คำสั่งนี้จากโฟลเดอร์แอป:

```bat
git init
git add .
git commit -m "Add Partol app"
git branch -M main
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

จากนั้นบน GitHub:

1. **Settings → Pages**
2. Source เลือก **GitHub Actions**
3. ถ้ามี URL ของ Apps Script ให้ใส่ที่ **Settings → Secrets → Actions** ชื่อ `VITE_APPS_SCRIPT_URL`

หลัง push ไป `main` แอปจะขึ้นที่ `https://USER.github.io/REPO/`

ถ้ายังไม่ได้ใส่ Secrets ก็วางลิงก์ Apps Script ในเมนูของแอปได้เหมือนกัน

## รันบนเครื่อง

ต้องมี Node.js แล้วเปิด `start.bat` หรือ:

```bat
npm install
npm run dev
```

เปิด [http://localhost:5173/](http://localhost:5173/)
