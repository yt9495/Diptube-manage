# 🧪 Dip Tube Inventory Management System

딥튜브 재고 관리 시스템 — Firebase + GitHub Pages

---

## 📋 기능

- **실시간 재고 현황** — Firebase Firestore 실시간 동기화
- **입고 예정 관리 (Incoming)** — Packing Slip / 주문확정서(SOC) PDF를 올리면 자동으로 읽어 배송 건 단위로 등록
- **입고 / 사용 기록** — 날짜별 트랜잭션 기록
- **안전 재고 경고** — 설정된 레벨 이하 시 자동 경고
- **수동 재고 입력** — 현재 재고를 직접 수정 가능
- **이력 조회** — 날짜/항목/유형별 필터링
- **사용자 인증** — Firebase Authentication

### 기본 등록 화학물질

| # | Chemical | Model (Key Code) |
|---|----------|-----------------|
| 1 | HF (Hydrofluoric Acid) | Code 12 |
| 2 | HCl (Hydrochloric Acid) | Code 6 |
| 3 | KOH (Potassium hydroxide) | Code 17 |
| 4 | H₂O₂ (Hydrogen Peroxide) | Code 7 |
| 5 | HNO₃ (Nitric Acid) | Code 1 |
| 6 | H₂SO₄ (Sulfuric Acid) | Code 2 |
| + | Non-Key Code items | 직접 추가 가능 |

---

## 🚚 입고 예정 (Incoming)

출하됐지만 아직 도착하지 않은 물량을 **배송(Invoice) 단위**로 관리합니다.

### PDF 자동 등록

`Incoming` 탭에서 A.S. Plastics 문서 PDF를 끌어다 놓거나 버튼으로 선택하면 다음을 자동으로 읽습니다.

| 읽는 항목 | 예시 |
|---|---|
| 문서 번호 | `SOC-32364` (주문확정서) / `INV-52925` (Packing Slip) |
| Customer Order (PO) | `JAPO-260811AS` |
| 선적일 (Ship Date) | `10/23/2026` → `2026-10-23` |
| 도착 예정일 (ETA) | 선적일 + 3일로 자동 계산 (수정 가능) |
| 운송장 (Ship Via) | `FedEx#209646615` |
| 품목 / 수량 | `DT-G2"PE-007-1330-SP-001` × 12 |

- **텍스트 PDF**는 pdf.js로 바로 읽고, **이미지로 인쇄된 PDF**(Microsoft Print to PDF 등)는 자동으로 OCR(tesseract.js)로 넘어갑니다. OCR은 최초 1회 언어 데이터를 받느라 30초 정도 걸릴 수 있습니다.
- 품목은 파트넘버의 **케미컬 키 코드**(`DT-G2"PE-`**007**`-...` → Code 7)로 재고 항목과 자동 매칭됩니다. 항목에 `Part No.`를 등록해 두면 파트넘버 전체로 정확히 매칭합니다.
- 자동 인식 결과는 저장 전 **확인 모달**에서 모두 수정할 수 있고, 인식이 안 된 항목은 노란색으로 표시됩니다.
- PDF 없이 `+ 직접 입력`으로 등록해도 됩니다.

### 재고 반영 방식

입고 예정 수량은 **현재고에 더해지지 않습니다.** Dashboard와 Inventory에 별도 칼럼으로 표시됩니다.

- `입고예정` — 아직 도착하지 않은 잔량
- `가용재고` — 현재고 + 입고예정
- 안전재고 경고에는 `[입고예정 50 ea · 최단 2026-08-24 도착예정]`이 함께 표시됩니다

`입고확정` 버튼을 누르면 그때 현재고에 반영되고 History에 입고 내역이 남습니다. 일부만 도착한 경우 수량을 줄여 저장하면 상태가 **부분입고**로 바뀌고 잔량은 계속 예정으로 남습니다.

### 배송 상태

| 상태 | 의미 |
|---|---|
| 미도착 | 등록만 되고 아직 입고 처리 없음 |
| 부분입고 | 일부 수량만 입고됨 |
| 입고완료 | 전 품목 전량 입고됨 |

---

## 🚀 배포 방법

### Step 1: Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. **새 프로젝트 생성** (또는 기존 프로젝트 사용)
3. **Authentication** 활성화
   - Build → Authentication → Sign-in method
   - **Email/Password** 활성화
4. **Firestore Database** 생성
   - Build → Firestore Database → Create database
   - **Production mode** 선택
5. **Rules** 업데이트
   - `firestore.rules` 파일 내용을 Firestore Rules에 붙여넣기
6. **앱 등록**
   - Project Settings → Your apps → Web app (</>) 클릭
   - Firebase SDK snippet의 config 값 복사

### Step 2: Firebase Config 입력

`firebase-config.js` 파일을 본인의 Firebase 설정으로 수정:

```javascript
window.FIREBASE_CONFIG = {
  apiKey: "실제_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 3: GitHub 저장소 설정

```bash
# 새 저장소 생성 후
git init
git add .
git commit -m "Initial commit: Dip Tube IMS"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/diptube-inventory.git
git push -u origin main
```

### Step 4: GitHub Pages 활성화

1. GitHub 저장소 → **Settings** → **Pages**
2. Source: **GitHub Actions** 선택
3. 자동으로 `.github/workflows/deploy.yml`이 실행되어 배포됨

### Step 5: Firebase 도메인 허용

Firebase Console → Authentication → Settings → **Authorized domains**에
GitHub Pages 도메인 추가:
```
YOUR_USERNAME.github.io
```

---

## 📁 파일 구조

```
diptube-inventory/
├── index.html          # 메인 HTML
├── style.css           # 스타일시트
├── app.js              # Firebase 앱 로직 (ES Module)
├── firebase-config.js  # Firebase 설정 (⚠ 수정 필요)
├── firestore.rules     # Firestore 보안 규칙
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Pages 자동 배포
```

---

## 🔒 보안 주의사항

- `firebase-config.js`의 API 키는 GitHub에 공개되어도 괜찮습니다 (Firebase Web API 키는 클라이언트용)
- **Firestore Rules**를 반드시 설정하여 인증된 사용자만 접근하도록 제한하세요
- Firebase Console에서 **App Check** 활성화를 권장합니다
