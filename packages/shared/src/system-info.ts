import os from 'os';
import { execSync } from 'child_process';
import { SystemDetails } from './types';
export function getSystemInfo() : SystemDetails  {
  let npmVersion = '';
  try {
    npmVersion = execSync('npm -v').toString().trim();
  } catch (e) {
    npmVersion = 'unknown';
  }

  return {
    os: os.platform(),
    architecture: os.arch(),
    browser: 'unknown',
    framework: 'unknown',
    frameworkVersion: 'unknown',
    nodeVersion: process.version,
    npmVersion: npmVersion
  };
}
