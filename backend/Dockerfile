FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package configurations
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "run", "start"]
