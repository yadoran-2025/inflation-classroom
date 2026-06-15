# 인플레이션 인터랙티브 수업앱

React + Vite + TypeScript로 만든 교실용 인플레이션 수업앱입니다. 교사는 학교/학년 공간과 반을 만들고, 학생은 QR 또는 링크로 입장해 Scene/Beat 기반 수업과 활동에 참여합니다.

## 실행

```bash
npm install
npm run dev
```

## 검증

```bash
npm run lint
npm run test
npm run build
```

## Firebase 설정

Firebase 환경변수가 없으면 localStorage 기반 데모 저장소로 동작합니다. 배포 환경에서 Firestore를 사용하려면 Vercel 환경변수에 아래 값을 설정하세요.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## 주요 경로

- `/`: 교사용 학교/학년 입장
- `/space/:spaceId`: 반 목록 및 반 생성
- `/teacher/:classId`: 교사용 수업 진행판
- `/join/:classId`: 익명 학생 코드 발급·재입장
- `/student/:classId/:studentId`: 학생 수업 화면
- `/privacy`: 개인정보 처리방침

## 릴리스 정보

릴리스 정보는 `src/data/releases.json`에서 관리합니다. 최신 항목의 버전은 `package.json` 버전과 같아야 하며,
`npm run build`에서 자동 검증됩니다.
