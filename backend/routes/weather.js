import express from 'express';

const router = express.Router();

// GET /api/weather/alert - Expose active weather telemetry warnings
router.get('/alert', (req, res) => {
  try {
    // Returns active telemetry weather warning
    res.json({
      station: 'pnbe',
      rainfall: 72,
      description: 'Severe monsoon precipitation'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
