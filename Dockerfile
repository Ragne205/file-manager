FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
# Tạo thư mục data nếu chưa có và đảm bảo file json tồn tại
RUN mkdir -p /app/data && \
    [ -f db.json ] || echo "[]" > db.json && \
    [ -f users.json ] || echo '[{"username":"admin","password":"admin123"}]' > users.json
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
