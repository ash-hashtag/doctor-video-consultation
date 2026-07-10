FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package configurations
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source files
COPY . .

# Expose port
EXPOSE 5173

# Start development server
CMD ["pnpm", "run", "dev"]
