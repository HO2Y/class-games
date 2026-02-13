# 배포 가이드

이 프로젝트는 정적 웹앱(PWA)이라 빌드 없이 바로 배포할 수 있습니다.

## 1) Vercel (추천)

1. GitHub 저장소에 이 프로젝트를 push
2. Vercel에서 `New Project` 선택 후 저장소 연결
3. Framework는 `Other`, Build Command 비워두기, Output Directory 비워두기
4. Deploy

설정 파일 `vercel.json`이 이미 포함되어 있어서 바로 동작합니다.

## 2) Netlify

1. GitHub 저장소 연결 후 `Add new site`
2. Build command 비움
3. Publish directory를 `.` 로 설정
4. Deploy

`netlify.toml`이 포함되어 있어 별도 라우팅 설정이 필요 없습니다.

## 3) GitHub Pages

1. 기본 브랜치를 `main`으로 사용
2. 저장소 `Settings > Pages`에서 Source를 `GitHub Actions`로 선택
3. `main` 브랜치에 push
4. `.github/workflows/deploy-pages.yml` 워크플로우가 자동 배포

## 설치 가능한 앱(PWA) 확인

배포 후 다음을 확인하세요.

1. `https://배포주소/index.html` 접속
2. 로비에서 `앱 설치` 버튼 또는 브라우저 설치 메뉴 확인
3. 최초 1회 온라인 접속 후 오프라인 플레이 동작 확인
