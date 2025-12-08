# frontend/Dockerfile (prod용 예시)
FROM node:22-slim

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

# 프로덕션 빌드
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

# dev 서버가 아니라 production 서버 실행
CMD ["npm", "run", "start"]