FROM node:20-alpine

WORKDIR /app

# Copiar apenas arquivos de dependências para cache
COPY package*.json ./
RUN npm install --production

# Copiar o restante do projeto
COPY . .

# Build do NestJS
RUN npm run build

# Comando de start
CMD ["node", "dist/main.js"]
