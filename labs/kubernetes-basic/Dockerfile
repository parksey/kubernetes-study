FROM node:20-alpine

WORKDIR /app

# 의존성이 없으므로 server.js만 복사
COPY server.js .

ENV PORT=3000
EXPOSE 3000

# root가 아닌 node 사용자로 실행
USER node

# exec 형식: node가 PID 1이 되어 k8s의 SIGTERM을 직접 받는다
CMD ["node", "server.js"]
