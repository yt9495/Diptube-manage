# 🧪 Dip Tube Inventory Management System

딥튜브 재고 관리 시스템 — Firebase + GitHub Pages

---

## 📋 기능

- **실시간 재고 현황** — Firebase Firestore 실시간 동기화
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
