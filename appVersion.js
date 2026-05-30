/**
 * routes/appVersion.js
 *
 * GET /api/app/version
 *
 * Returns the current version configuration from config/appVersion.json.
 * To trigger a forced update for all users, simply edit appVersion.json —
 * no code deployment needed.
 *
 * Example: bump minimumVersion to "1.0.5" and set updateRequired: true
 * → all users on older versions will see the mandatory update screen.
 */

import express from 'express';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parses a semver string "major.minor.patch" → [major, minor, patch]
 */
const parseSemver = (v = '0.0.0') => {
  const parts = String(v).split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  return parts;
};

/**
 * Returns true if version A is strictly less than version B
 */
const isLessThan = (a, b) => {
  const [aMaj, aMin, aPatch] = parseSemver(a);
  const [bMaj, bMin, bPatch] = parseSemver(b);
  if (aMaj !== bMaj) return aMaj < bMaj;
  if (aMin !== bMin) return aMin < bMin;
  return aPatch < bPatch;
};

// ─── GET /api/app/version ─────────────────────────────────────────────────────
router.get('/version', (req, res) => {
  try {
    const configPath = resolve(__dirname, '..', 'config', 'appVersion.json');
    const fullConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Get packageId from header or query param, default to com.yashuarts.app
    const packageId =
      req.headers['x-app-package'] ||
      req.query.packageId ||
      'com.yashuarts.app';

    // Resolve app config based on packageId if it exists in the config, otherwise fallback to root
    const config = fullConfig[packageId] || fullConfig;

    // Read the requesting client's current version from header or query param
    const clientVersion =
      req.headers['x-app-version'] ||
      req.query.version ||
      '0.0.0';

    // Compute whether this client is below the minimum required version
    const belowMinimum = isLessThan(clientVersion, config.minimumVersion);
    // Compute whether a newer version is available (optional update)
    const updateAvailable = isLessThan(clientVersion, config.latestVersion);

    res.json({
      // Version info
      latestVersion: config.latestVersion,
      minimumVersion: config.minimumVersion,
      currentVersion: clientVersion,

      // Update flags
      updateRequired: belowMinimum || !!config.updateRequired,
      updateAvailable,

      // Play Store / App Store links
      playStoreUrl: config.playStoreUrl,
      appStoreUrl: config.appStoreUrl || null,

      // Release notes (shown in update dialog)
      releaseNotes: config.releaseNotes || [],

      // Server timestamp (for debugging)
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[appVersion] Failed to read version config:', err.message);
    res.status(500).json({
      message: 'Version check service temporarily unavailable.',
      updateRequired: false,
      updateAvailable: false,
    });
  }
});

export default router;
