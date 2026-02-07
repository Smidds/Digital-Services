#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const DOCKER_COMPOSE_FILE = path.join(__dirname, '../infrastructure/docker-compose.dev.yml');

let dockerProcess = null;
let turboProcess = null;

/**
 * Gracefully shutdown both processes
 */
function cleanup() {
  console.log('\n\nShutting down services...');

  // Kill turbo dev first
  if (turboProcess) {
    turboProcess.kill();
  }

  // Kill docker compose
  if (dockerProcess) {
    dockerProcess.kill();
  }

  process.exit(0);
}

// Handle signals for graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

/**
 * Pull docker images
 */
function pullDockerImages() {
  return new Promise((resolve, reject) => {
    console.log('Pulling Docker images...');

    const pullProcess = spawn('docker-compose', ['-f', DOCKER_COMPOSE_FILE, 'pull'], {
      stdio: 'inherit',
      shell: true,
    });

    pullProcess.on('error', (error) => {
      console.error('Failed to pull Docker images:', error.message);
      reject(error);
    });

    pullProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Docker images pulled successfully');
        resolve();
      } else {
        console.error(`Docker image pull failed with code ${code}`);
        reject(new Error(`Docker pull failed with code ${code}`));
      }
    });
  });
}

/**
 * Start docker-compose in detached mode
 */
function startDockerCompose() {
  return new Promise((resolve, reject) => {
    console.log('Starting Docker Compose services...');

    dockerProcess = spawn('docker-compose', ['-f', DOCKER_COMPOSE_FILE, 'up', '-d'], {
      stdio: 'inherit',
      shell: true,
    });

    dockerProcess.on('error', (error) => {
      console.error('Failed to start Docker Compose:', error.message);
      reject(error);
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Docker Compose services started successfully');
        resolve();
      } else {
        console.error(`Docker Compose failed with code ${code}`);
        reject(new Error(`Docker Compose failed with code ${code}`));
      }
    });
  });
}

/**
 * Start turbo dev in the foreground
 */
function startTurboDev() {
  return new Promise((resolve) => {
    console.log('\nStarting Turbo dev...');

    turboProcess = spawn('bun', ['dev'], {
      stdio: 'inherit',
      shell: true,
    });

    turboProcess.on('error', (error) => {
      console.error('Failed to start Turbo dev:', error.message);
      cleanup();
    });

    turboProcess.on('close', (code) => {
      console.log(`Turbo dev exited with code ${code}`);
      resolve();
    });
  });
}

/**
 * Main function
 */
async function main() {
  // Prevent recursive execution when running under turbo
  if (process.env.TURBO_HASH) {
    console.log('Running under turbo context, skipping docker-compose startup');
    return;
  }

  try {
    await pullDockerImages();
    await startDockerCompose();
    await startTurboDev();
    cleanup();
  } catch (error) {
    console.error('Error starting services:', error.message);
    cleanup();
  }
}

main();
