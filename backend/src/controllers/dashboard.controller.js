'use strict';

const StudentModel        = require('../models/student.model');
const PredictionLogModel  = require('../models/prediction.model');

/**
 * GET /dashboard/stats
 * Hits the `dashboard_stats` VIEW which queries student_risk_summary.
 * Zero live table scans. Refresh the materialized view separately.
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await StudentModel.getStats() || {};

    res.json({
      success: true,
      data: {
        totalStudents     : parseInt(stats.total_students     || 0, 10),
        totalStudentsTrend: 4.2,                  // wire to time-series snapshot table later
        averageScore      : parseFloat(stats.average_score    || 0),
        averageScoreTrend : 1.8,
        atRiskStudents    : parseInt(stats.at_risk_students  || 0, 10),
        atRiskNew         : parseInt(stats.high_risk_count   || 0, 10),
        avgAttendance     : parseFloat(stats.avg_attendance  || 0),
        unscoredStudents  : parseInt(stats.unscored_students || 0, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/class-distribution
 * Student counts per major from the materialized view.
 */
exports.getClassDistribution = async (req, res, next) => {
  try {
    const COLORS = [
      'bg-indigo-500','bg-indigo-400','bg-indigo-300',
      'bg-purple-400','bg-purple-300','bg-amber-400',
    ];

    const rows = await StudentModel.getClassDistribution();

    const data = rows.map((row, i) => ({
      name    : row.name,
      students: row.students,
      percent : row.percent,
      color   : COLORS[i % COLORS.length],
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/risk-distribution
 * Breakdown of low / medium / high / unscored students.
 */
exports.getRiskDistribution = async (req, res, next) => {
  try {
    const rows = await StudentModel.getRiskDistribution();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /dashboard/refresh-cache
 * Manually trigger a materialized view refresh.
 * Typically called after a large batch prediction or bulk import.
 * Protected — admin only (enforced at route level).
 */
exports.refreshCache = async (req, res, next) => {
  try {
    await PredictionLogModel.refreshRiskCache();
    res.json({ success: true, message: 'Student risk cache refreshed' });
  } catch (err) {
    next(err);
  }
};
