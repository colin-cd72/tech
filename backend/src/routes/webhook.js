const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');

const router = express.Router();

// Verify GitHub webhook signature
function verifySignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

// GitHub webhook for auto-deploy
router.post('/github', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // Verify signature if secret is configured
  if (secret) {
    if (!verifySignature(req.body, signature, secret)) {
      console.log('Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // Only process push events
  if (event !== 'push') {
    return res.json({ message: `Ignored event: ${event}` });
  }

  const payload = JSON.parse(req.body.toString());
  const branch = payload.ref?.replace('refs/heads/', '');

  // Only deploy from master/main branch
  if (branch !== 'master' && branch !== 'main') {
    return res.json({ message: `Ignored branch: ${branch}` });
  }

  console.log(`Received push to ${branch} from ${payload.pusher?.name}`);

  // Run deploy script
  const deployScript = process.env.DEPLOY_SCRIPT || '/home/cloudpanel/htdocs/tech.4tmrw.net/deploy.sh';

  exec(deployScript, { cwd: process.env.APP_ROOT || '/home/cloudpanel/htdocs/tech.4tmrw.net' }, (error, stdout, stderr) => {
    if (error) {
      console.error('Deploy failed:', error);
      console.error('stderr:', stderr);
      return;
    }
    console.log('Deploy output:', stdout);
  });

  // Respond immediately, deploy runs in background
  res.json({
    message: 'Deploy triggered',
    branch,
    commit: payload.after?.substring(0, 7)
  });
});

module.exports = router;
